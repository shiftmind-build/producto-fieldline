import type { Express, Request, Response } from 'express'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { asyncHandler } from './lib/asyncHandler.js'
import { montaPanel } from './panel.js'
import { requireRole, verificarAuth } from './lib/auth.js'
import {
  sincroniza,
  turnosSinFichar,
  type Estado,
  type Evento,
  type Sitio,
  type Turno,
} from './motor/sincronizacion.js'

/**
 * Las rutas de Fieldline.
 *
 * La de sincronizar es la unica que importa de verdad, y tiene una obligacion que las
 * demas no: **nunca puede fallar entera.** Un movil que vuelve con seis horas de
 * trabajo y recibe un 500 se queda con todo dentro y lo reintenta en bucle. Por eso
 * cada evento se responde por separado, y un evento malo no tumba el lote.
 */

function secretoValido(req: Request) {
  const esperado = process.env['CRON_SECRET']
  if (!esperado) return false
  return req.header('x-cron-secret') === esperado
}

export function montaRutas(app: Express) {
  app.post(
    '/sincronizar',
    asyncHandler(async (req: Request, res: Response) => {
      const quien = await verificarAuth(req)
      const lote = (req.body as { eventos?: Evento[] })?.eventos
      if (!Array.isArray(lote)) {
        res.status(400).json({ error: 'falta eventos[]' })
        return
      }
      if (lote.length > 500) {
        res.status(413).json({ error: 'lote demasiado grande, partelo' })
        return
      }

      const db = getFirestore()

      // El movil dice de quien es cada evento, pero eso no se cree: se sustituye por el
      // uid del token. Si no, cualquiera podria fichar en nombre de otro.
      const eventos = lote.map((e) => ({ ...e, crew_id: quien.uid }))

      const idsTurno = [...new Set(eventos.map((e) => e.shift_id))].slice(0, 100)
      const turnos = new Map<string, Turno>()
      const sitios = new Map<string, Sitio>()
      for (const id of idsTurno) {
        const t = await db.collection('shifts').doc(id).get()
        if (!t.exists) continue
        const d = t.data()!
        turnos.set(id, {
          id,
          crew_id: String(d['crew_id']),
          site_id: String(d['site_id']),
          estado: d['estado'] as Turno['estado'],
        })
        if (!sitios.has(String(d['site_id']))) {
          const s = await db.collection('sites').doc(String(d['site_id'])).get()
          if (s.exists) {
            sitios.set(s.id, {
              id: s.id,
              lat: Number(s.data()!['lat']),
              lng: Number(s.data()!['lng']),
              radio_metros: Number(s.data()!['radio_metros'] ?? 150),
            })
          }
        }
      }

      const yaRecibidos = new Set<string>()
      const previos = await db
        .collection('reports')
        .where('cliente_id_local', 'in', eventos.map((e) => e.id_local).slice(0, 30))
        .get()
        .catch(() => null)
      previos?.docs.forEach((d) => yaRecibidos.add(String(d.data()['cliente_id_local'])))

      const estado: Estado = { turnos, sitios, yaRecibidos }
      const resultados = sincroniza(eventos, estado)

      // Se escribe lo aplicado. Un fallo al guardar uno no cancela los demas: el movil
      // reintentara solo ese, y el id_local hace el reintento inofensivo.
      for (const [i, r] of resultados.entries()) {
        if (r.resultado !== 'aplicado') continue
        const ev = eventos.find((e) => e.id_local === r.id_local)
        if (!ev) continue
        try {
          if (ev.tipo === 'checkin') {
            await db.collection('checkins').add({
              shift_id: ev.shift_id,
              tipo: ev.subtipo,
              momento: Timestamp.fromMillis(ev.momento),
              lat: ev.lat,
              lng: ev.lng,
              dentro_del_radio: r.dentro_del_radio ?? false,
              capturado_offline: true,
            })
          } else if (ev.tipo === 'informe') {
            await db.collection('reports').add({
              shift_id: ev.shift_id,
              texto: ev.texto,
              fotos_urls: ev.fotos,
              incidencia: false,
              creado_en: Timestamp.fromMillis(ev.momento),
              sincronizado_en: Timestamp.now(),
              cliente_id_local: ev.id_local,
            })
          } else {
            await db.collection('shifts').doc(ev.shift_id).update({ estado: ev.estado })
          }
        } catch (error) {
          console.error(`[sincronizar] fallo guardando ${r.id_local}`, error)
          resultados[i] = { id_local: r.id_local, resultado: 'rechazado', motivo: 'error al guardar, reintenta' }
        }
      }

      const aplicados = resultados.filter((r) => r.resultado === 'aplicado').length
      console.log(`[sincronizar] ${quien.uid}: ${aplicados}/${resultados.length} aplicados`)
      res.status(200).json({ resultados })
    }),
  )

  /** La alerta que vende el producto: un sitio sin cubrir, mientras aun se puede llamar a alguien. */
  app.post(
    '/tareas/alertas',
    asyncHandler(async (req: Request, res: Response) => {
      if (!secretoValido(req)) {
        res.status(401).json({ error: 'no autorizado' })
        return
      }
      const db = getFirestore()
      const desde = Timestamp.fromMillis(Date.now() - 12 * 60 * 60 * 1000)
      const turnos = await db
        .collection('shifts')
        .where('inicio_previsto', '>=', desde)
        .limit(500)
        .get()

      const inicios = new Map<string, number>()
      const lista: Turno[] = turnos.docs.map((d) => {
        inicios.set(d.id, (d.data()['inicio_previsto'] as { toMillis: () => number }).toMillis())
        return {
          id: d.id,
          crew_id: String(d.data()['crew_id']),
          site_id: String(d.data()['site_id']),
          estado: d.data()['estado'] as Turno['estado'],
        }
      })

      const fichados = new Set<string>()
      const checks = await db.collection('checkins').where('momento', '>=', desde).limit(1000).get()
      checks.docs.forEach((d) => fichados.add(String(d.data()['shift_id'])))

      const sinCubrir = turnosSinFichar(lista, inicios, fichados, Date.now())

      for (const t of sinCubrir) {
        const ya = await db
          .collection('alerts')
          .where('shift_id', '==', t.id)
          .where('resuelta_en', '==', null)
          .limit(1)
          .get()
        // Una alerta por turno. Repetirla cada cinco minutos ensenya al dispatcher a
        // ignorarlas, y entonces la alerta deja de servir para nada.
        if (!ya.empty) continue
        await db.collection('alerts').add({
          shift_id: t.id,
          tipo: 'sin_fichar',
          disparada_en: Timestamp.now(),
          resuelta_en: null,
          resuelta_por: null,
        })
      }

      console.log(`[alertas] ${sinCubrir.length} turnos sin cubrir`)
      res.status(200).json({ sin_cubrir: sinCubrir.length, turnos: sinCubrir.map((t) => t.id) })
    }),
  )

  // El tablero, los sitios y el detalle de un turno viven en panel.ts. El tablero
  // devolvia solo las alertas: util cuando algo ya ha fallado, inservible para saber
  // quien esta donde ahora mismo.
  montaPanel(app)
}
