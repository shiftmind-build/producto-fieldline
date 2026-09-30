/**
 * La sincronizacion de lo capturado sin cobertura. Es el motor de este producto y la
 * unica parte que puede salir mal de forma cara.
 *
 * El caso real: un operario pasa seis horas en un poligono sin senyal, ficha en cinco
 * sitios, escribe tres informes con fotos. Cuando vuelve a tener cobertura manda todo
 * de golpe -- y mientras tanto la oficina ha reasignado dos de esos turnos a otra
 * persona, ha cancelado uno, y su movil ha reintentado el envio dos veces porque la
 * primera se corto a la mitad.
 *
 * Casi todos los sistemas resuelven esto con "gana el ultimo que escribe". Aqui no,
 * porque no todo lo que llega es del mismo tipo:
 *
 *   HECHOS        Un fichaje o un informe son cosas que PASARON. "Estuve alli a las
 *                 10:42" no se puede sobrescribir desde una oficina, y perderlo es
 *                 perder la prueba de un trabajo hecho -- que es justo lo que el
 *                 cliente del cliente esta pagando. Se anyaden, nunca se pisan, y
 *                 llegan tarde sin dejar de ser validos.
 *
 *   ASIGNACIONES  A quien le toca un turno lo decide la oficina, y un movil que estuvo
 *                 seis horas a oscuras tiene una version vieja del mundo. Una accion
 *                 sobre un turno que ya no es suyo se RECHAZA con motivo, no se aplica
 *                 en silencio ni se descarta callando.
 *
 * Y todo idempotente por el identificador que genera el movil: reenviar el mismo lote
 * entero tiene que ser inofensivo, porque va a pasar todos los dias.
 */

export type Evento =
  | {
      tipo: 'checkin'
      /** Lo genera el movil antes de guardar en local. Es la clave de idempotencia. */
      id_local: string
      shift_id: string
      crew_id: string
      momento: number
      lat: number
      lng: number
      subtipo: 'entrada' | 'salida'
    }
  | {
      tipo: 'informe'
      id_local: string
      shift_id: string
      crew_id: string
      momento: number
      texto: string
      fotos: string[]
    }
  | {
      tipo: 'estado_turno'
      id_local: string
      shift_id: string
      crew_id: string
      momento: number
      estado: 'en_curso' | 'terminado'
    }

export type Turno = {
  id: string
  /** Puede haber cambiado mientras el movil estaba sin cobertura. */
  crew_id: string
  site_id: string
  estado: 'publicado' | 'en_curso' | 'terminado' | 'cancelado'
}

export type Sitio = { id: string; lat: number; lng: number; radio_metros: number }

export type Aplicado = {
  id_local: string
  resultado: 'aplicado' | 'repetido' | 'rechazado'
  motivo?: string
  /** Solo en fichajes: si cayo dentro del radio del sitio. */
  dentro_del_radio?: boolean
}

export type Estado = {
  turnos: Map<string, Turno>
  sitios: Map<string, Sitio>
  /** id_local de todo lo ya recibido. Es lo que hace el reenvio inofensivo. */
  yaRecibidos: Set<string>
}

/** Metros entre dos puntos. Haversine; a estas distancias sobra de precision. */
export function metrosEntre(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Aplica un lote llegado del movil.
 *
 * Se procesa en orden de captura, no de llegada: el movil pudo mandarlos desordenados
 * y una salida antes que su entrada dejaria el turno en un estado imposible.
 */
export function sincroniza(lote: Evento[], estado: Estado): Aplicado[] {
  const enOrden = lote.slice().sort((a, b) => a.momento - b.momento)
  const salida: Aplicado[] = []

  for (const ev of enOrden) {
    if (estado.yaRecibidos.has(ev.id_local)) {
      salida.push({ id_local: ev.id_local, resultado: 'repetido' })
      continue
    }

    const turno = estado.turnos.get(ev.shift_id)
    if (!turno) {
      salida.push({ id_local: ev.id_local, resultado: 'rechazado', motivo: 'el turno no existe' })
      continue
    }

    // Reasignado mientras estaba sin cobertura. Un hecho capturado por quien de verdad
    // estuvo alli no se tira -- se guarda y se marca, porque puede ser la unica prueba
    // de un trabajo hecho. Lo que no se acepta es que mueva el estado del turno.
    const yaNoEsSuyo = turno.crew_id !== ev.crew_id

    if (turno.estado === 'cancelado') {
      salida.push({
        id_local: ev.id_local,
        resultado: 'rechazado',
        motivo: 'el turno se cancelo mientras el dispositivo estaba sin cobertura',
      })
      continue
    }

    if (ev.tipo === 'estado_turno') {
      if (yaNoEsSuyo) {
        salida.push({
          id_local: ev.id_local,
          resultado: 'rechazado',
          motivo: 'el turno se reasigno a otra persona',
        })
        continue
      }
      // Nunca hacia atras: un movil con una version vieja no puede devolver a "en curso"
      // un turno que la oficina ya dio por terminado.
      const orden = { publicado: 0, en_curso: 1, terminado: 2, cancelado: 3 }
      if (orden[ev.estado] <= orden[turno.estado]) {
        salida.push({
          id_local: ev.id_local,
          resultado: 'rechazado',
          motivo: `el turno ya estaba en ${turno.estado}`,
        })
        continue
      }
      estado.turnos.set(turno.id, { ...turno, estado: ev.estado })
      estado.yaRecibidos.add(ev.id_local)
      salida.push({ id_local: ev.id_local, resultado: 'aplicado' })
      continue
    }

    if (ev.tipo === 'checkin') {
      const sitio = estado.sitios.get(turno.site_id)
      const dentro = sitio
        ? metrosEntre(ev.lat, ev.lng, sitio.lat, sitio.lng) <= sitio.radio_metros
        : false
      estado.yaRecibidos.add(ev.id_local)
      // Fuera del radio NO se rechaza. El GPS falla en naves y sotanos, y rechazar el
      // fichaje dejaria a la persona sin poder demostrar que fue. Se guarda marcado y
      // que lo mire el dispatcher.
      salida.push({
        id_local: ev.id_local,
        resultado: 'aplicado',
        dentro_del_radio: dentro,
        ...(yaNoEsSuyo ? { motivo: 'capturado antes de reasignar el turno' } : {}),
      })
      continue
    }

    estado.yaRecibidos.add(ev.id_local)
    salida.push({
      id_local: ev.id_local,
      resultado: 'aplicado',
      ...(yaNoEsSuyo ? { motivo: 'capturado antes de reasignar el turno' } : {}),
    })
  }

  return salida
}

/**
 * Turnos empezados sin que nadie fiche. Esta es la alerta que vende el producto.
 *
 * El duenyo no quiere un informe a final de mes: quiere enterarse de que un sitio esta
 * sin cubrir mientras todavia puede llamar a alguien.
 */
export const MARGEN_MINUTOS = 15

export function turnosSinFichar(
  turnos: Turno[],
  inicios: Map<string, number>,
  fichados: Set<string>,
  ahora: number,
  margenMinutos = MARGEN_MINUTOS,
) {
  const margen = margenMinutos * 60 * 1000
  return turnos.filter((t) => {
    if (t.estado !== 'publicado') return false
    const inicio = inicios.get(t.id)
    if (inicio === undefined) return false
    if (ahora < inicio + margen) return false
    return !fichados.has(t.id)
  })
}
