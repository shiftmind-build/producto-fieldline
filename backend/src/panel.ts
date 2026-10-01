import type { Express, Request, Response } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { asyncHandler } from './lib/asyncHandler.js'
import { requireRole } from './lib/auth.js'

/**
 * Las lecturas del tablero del dispatcher.
 *
 * Lo que compone este fichero es el estado de hoy: quien esta donde, quien no ha
 * fichado, y que telefonos llevan horas sin aparecer. Lo ultimo es lo que distingue
 * este producto de un cuadrante: un movil sin cobertura seis horas es lo normal en
 * campo, y solo se convierte en un problema cuando nadie lo sabe.
 *
 * Una cosa que NO se inventa aqui: los eventos rechazados. El motor de sincronizacion
 * devuelve el motivo al movil pero no lo guarda en ninguna parte, asi que el detalle de
 * un turno ensena lo que de verdad hay guardado. Lo que esta guardado se aplico -- esa
 * es la unica lectura honesta hoy. Anotado para /retro: un registro de rechazos es la
 * pieza que falta, y es util justo cuando algo va mal.
 */

function texto(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function segundos(t: unknown): number {
  if (t && typeof t === 'object') {
    const o = t as { _seconds?: number; seconds?: number; toMillis?: () => number }
    if (typeof o.toMillis === 'function') return Math.floor(o.toMillis() / 1000)
    if (typeof o._seconds === 'number') return o._seconds
    if (typeof o.seconds === 'number') return o.seconds
  }
  return 0
}

async function nombresDe(uids: string[]): Promise<Map<string, string>> {
  const nombres = new Map<string, string>()
  const unicos = [...new Set(uids.filter(Boolean))]
  for (let i = 0; i < unicos.length; i += 100) {
    try {
      const { users } = await getAuth().getUsers(unicos.slice(i, i + 100).map((uid) => ({ uid })))
      for (const u of users) nombres.set(u.uid, u.displayName || u.email || u.uid)
    } catch (err) {
      console.error('[panel] no se pudieron leer los nombres de la cuadrilla', err)
    }
  }
  for (const uid of unicos) if (!nombres.has(uid)) nombres.set(uid, uid)
  return nombres
}

/** Lo que significa cada alerta, en una frase. El tipo solo no se lee de un vistazo. */
const DETALLE_ALERTA: Record<string, string> = {
  sin_fichar: 'the shift started and nobody checked in',
  fuera_de_radio: 'checked in outside the site radius',
  sin_sincronizar: 'the phone has not been heard from for hours',
}

const TOPE_TURNOS = 300
/** A partir de aqui, un movel callado deja de ser normal y pasa a ser un aviso. */
const HORAS_SIN_SINCRONIZAR = 3

export function montaPanel(app: Express) {
  /** Hoy: alertas abiertas, turnos y telefonos callados. */
  app.get(
    '/tablero',
    requireRole(['dispatcher']),
    asyncHandler(async (_req: Request, res: Response) => {
      const db = getFirestore()
      const inicioDelDia = new Date()
      inicioDelDia.setHours(0, 0, 0, 0)

      const [alertasSnap, turnosSnap, sitiosSnap] = await Promise.all([
        db.collection('alerts').where('resuelta_en', '==', null).limit(100).get(),
        db.collection('shifts').where('inicio_previsto', '>=', inicioDelDia).limit(TOPE_TURNOS).get(),
        db.collection('sites').limit(200).get(),
      ])

      const nombreSitio = new Map(
        sitiosSnap.docs.map((d) => [d.id, texto(d.data()['nombre']) || d.id]),
      )
      const nombres = await nombresDe(turnosSnap.docs.map((d) => texto(d.data()['crew_id'])))

      // Los fichajes de los turnos de hoy, de un tiron. Una consulta por turno serian
      // trescientos viajes para pintar una columna.
      const idsTurno = turnosSnap.docs.map((d) => d.id)
      const fichajes = new Map<string, Array<Record<string, unknown>>>()
      const informes = new Map<string, number>()
      for (let i = 0; i < idsTurno.length; i += 30) {
        const tanda = idsTurno.slice(i, i + 30)
        if (tanda.length === 0) continue
        const [ch, re] = await Promise.all([
          db.collection('checkins').where('shift_id', 'in', tanda).limit(500).get(),
          db.collection('reports').where('shift_id', 'in', tanda).limit(500).get(),
        ])
        for (const d of ch.docs) {
          const id = texto(d.data()['shift_id'])
          fichajes.set(id, [...(fichajes.get(id) ?? []), { id: d.id, ...d.data() }])
        }
        for (const d of re.docs) {
          const id = texto(d.data()['shift_id'])
          informes.set(id, (informes.get(id) ?? 0) + 1)
        }
      }

      const turnos = turnosSnap.docs
        .map((d) => {
          const t = d.data()
          const crew = texto(t['crew_id'])
          const entradas = (fichajes.get(d.id) ?? [])
            .filter((c) => c['tipo'] === 'entrada')
            .sort((a, b) => segundos(a['momento']) - segundos(b['momento']))
          const primera = entradas[0]
          return {
            id: d.id,
            site_id: texto(t['site_id']),
            site_nombre: nombreSitio.get(texto(t['site_id'])) ?? texto(t['site_id']),
            crew_id: crew,
            crew_nombre: nombres.get(crew) ?? crew,
            estado: texto(t['estado']) || 'publicado',
            empieza: t['inicio_previsto'],
            termina: t['fin_previsto'],
            fichado_en: primera?.['momento'],
            fuera_del_radio: primera ? primera['dentro_del_radio'] === false : undefined,
            informes: informes.get(d.id) ?? 0,
          }
        })
        .sort((a, b) => segundos(a.empieza) - segundos(b.empieza))

      /*
       * Telefonos callados.
       *
       * Se mide con el ultimo fichaje o informe que llego de esa persona hoy, que es lo
       * unico que prueba que su movil hablo con nosotros. Una cuadrilla sin nada
       * enviado hoy no sale aqui: esa no esta callada, es que todavia no ha empezado, y
       * mezclarlas convierte la lista en ruido que se deja de mirar.
       */
      const ultimoDe = new Map<string, number>()
      const enColaDe = new Map<string, number>()
      for (const t of turnos) {
        for (const c of fichajes.get(t.id) ?? []) {
          const cuando = segundos(c['momento'])
          if (cuando > (ultimoDe.get(t.crew_id) ?? 0)) ultimoDe.set(t.crew_id, cuando)
          if (c['capturado_offline'] === true) {
            enColaDe.set(t.crew_id, (enColaDe.get(t.crew_id) ?? 0) + 1)
          }
        }
      }
      const ahora = Math.floor(Date.now() / 1000)
      const sin_sincronizar = [...ultimoDe.entries()]
        .filter(([, cuando]) => ahora - cuando > HORAS_SIN_SINCRONIZAR * 3600)
        .map(([crew, cuando]) => ({
          crew_nombre: nombres.get(crew) ?? crew,
          ultima_vez: { _seconds: cuando },
          eventos_en_cola: enColaDe.get(crew) ?? 0,
        }))
        .sort((a, b) => a.ultima_vez._seconds - b.ultima_vez._seconds)

      const alertas = alertasSnap.docs.map((d) => {
        const a = d.data()
        const turno = turnos.find((t) => t.id === texto(a['shift_id']))
        return {
          id: d.id,
          shift_id: texto(a['shift_id']),
          tipo: texto(a['tipo']) || 'sin_fichar',
          // `alerts` guarda el tipo, no una frase. Se compone aqui en vez de leer un
          // campo que no existe y dejar la alerta sin texto.
          detalle: DETALLE_ALERTA[texto(a['tipo'])] ?? 'needs a look',
          creada_en: a['disparada_en'],
          crew_nombre: turno?.crew_nombre ?? '',
          site_nombre: turno?.site_nombre ?? '',
        }
      })

      res.status(200).json({ alertas, turnos, sin_sincronizar })
    }),
  )

  /** Los sitios y su radio. El radio explica por que un fichaje sale marcado. */
  app.get(
    '/sitios',
    requireRole(['dispatcher']),
    asyncHandler(async (_req: Request, res: Response) => {
      const db = getFirestore()
      const snap = await db.collection('sites').limit(200).get()
      res.status(200).json({
        sitios: snap.docs
          .filter((d) => d.data()['activo'] !== false)
          .map((d) => ({
            id: d.id,
            nombre: texto(d.data()['nombre']) || d.id,
            direccion: texto(d.data()['direccion']),
            radio_metros: Number(d.data()['radio_metros'] ?? 150),
          })),
      })
    }),
  )

  /** Un turno entero: lo que el movil mando y quedo guardado, en orden. */
  app.get(
    '/turnos/:id',
    requireRole(['dispatcher']),
    asyncHandler(async (req: Request, res: Response) => {
      const db = getFirestore()
      const id = String(req.params['id'])
      const turno = await db.collection('shifts').doc(id).get()
      if (!turno.exists) {
        res.status(404).json({ error: 'ese turno no existe' })
        return
      }
      const t = turno.data()!
      const crew = texto(t['crew_id'])

      const [ch, re, sitio, nombres] = await Promise.all([
        db.collection('checkins').where('shift_id', '==', id).limit(100).get(),
        db.collection('reports').where('shift_id', '==', id).limit(100).get(),
        db.collection('sites').doc(texto(t['site_id'])).get(),
        nombresDe([crew]),
      ])

      const entradas = [
        ...ch.docs.map((d) => {
          const c = d.data()
          return {
            id: d.id,
            tipo: 'checkin' as const,
            momento: c['momento'],
            // Guardado significa aplicado. Lo rechazado no llega a escribirse, asi que
            // aqui no hay nada que marcar como rechazado sin inventarlo.
            resultado: 'aplicado' as const,
            dentro_del_radio: c['dentro_del_radio'] === true,
          }
        }),
        ...re.docs.map((d) => {
          const r = d.data()
          const fotos = Array.isArray(r['fotos_urls']) ? r['fotos_urls'].length : 0
          return {
            id: d.id,
            tipo: 'informe' as const,
            momento: r['creado_en'],
            resultado: 'aplicado' as const,
            texto: texto(r['texto']),
            fotos,
          }
        }),
      ].sort((a, b) => segundos(a.momento) - segundos(b.momento))

      const primera = ch.docs
        .map((d) => d.data())
        .filter((c) => c['tipo'] === 'entrada')
        .sort((a, b) => segundos(a['momento']) - segundos(b['momento']))[0]

      res.status(200).json({
        turno: {
          id: turno.id,
          site_id: texto(t['site_id']),
          site_nombre: texto(sitio.data()?.['nombre']) || texto(t['site_id']),
          crew_id: crew,
          crew_nombre: nombres.get(crew) ?? crew,
          estado: texto(t['estado']) || 'publicado',
          empieza: t['inicio_previsto'],
          termina: t['fin_previsto'],
          fichado_en: primera?.['momento'],
          fuera_del_radio: primera ? primera['dentro_del_radio'] === false : undefined,
          informes: re.size,
        },
        entradas,
      })
    }),
  )
}
