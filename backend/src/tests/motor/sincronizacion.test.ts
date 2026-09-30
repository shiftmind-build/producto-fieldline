import { describe, expect, it } from 'vitest'
import {
  MARGEN_MINUTOS,
  metrosEntre,
  sincroniza,
  turnosSinFichar,
  type Estado,
  type Evento,
  type Turno,
} from '../../motor/sincronizacion.js'

/**
 * El dia malo, escrito como test.
 *
 * Un operario pasa seis horas en un poligono sin senyal. Ficha, escribe informes. La
 * oficina, mientras tanto, le reasigna un turno y cancela otro. Su movil reintenta el
 * envio dos veces porque la primera se corto.
 *
 * Lo que se prueba aqui es que de todo eso no se pierde un solo hecho, no se aplica una
 * sola accion sobre algo que ya no es suyo, y reenviar el lote entero no rompe nada.
 */

const T = (id: string, extra: Partial<Turno> = {}): Turno => ({
  id,
  crew_id: 'uid-luis',
  site_id: 'nave-1',
  estado: 'publicado',
  ...extra,
})

const nuevoEstado = (turnos: Turno[]): Estado => ({
  turnos: new Map(turnos.map((t) => [t.id, t])),
  sitios: new Map([['nave-1', { id: 'nave-1', lat: 40.4168, lng: -3.7038, radio_metros: 150 }]]),
  yaRecibidos: new Set<string>(),
})

const checkin = (id: string, shift: string, momento: number, extra: Partial<Extract<Evento, { tipo: 'checkin' }>> = {}) =>
  ({
    tipo: 'checkin',
    id_local: id,
    shift_id: shift,
    crew_id: 'uid-luis',
    momento,
    lat: 40.4168,
    lng: -3.7038,
    subtipo: 'entrada',
    ...extra,
  }) as Evento

const informe = (id: string, shift: string, momento: number) =>
  ({
    tipo: 'informe',
    id_local: id,
    shift_id: shift,
    crew_id: 'uid-luis',
    momento,
    texto: 'limpieza completada, falta reponer papel',
    fotos: ['f1.jpg'],
  }) as Evento

const estadoTurno = (id: string, shift: string, momento: number, estado: 'en_curso' | 'terminado') =>
  ({ tipo: 'estado_turno', id_local: id, shift_id: shift, crew_id: 'uid-luis', momento, estado }) as Evento

describe('sincronizacion de lo capturado sin cobertura', () => {
  it('un lote normal entra entero', () => {
    const e = nuevoEstado([T('t1')])
    const r = sincroniza([checkin('c1', 't1', 100), informe('i1', 't1', 200)], e)
    expect(r.every((x) => x.resultado === 'aplicado')).toBe(true)
  })

  it('reenviar el mismo lote no duplica nada', () => {
    const e = nuevoEstado([T('t1')])
    const lote = [checkin('c1', 't1', 100), informe('i1', 't1', 200)]
    sincroniza(lote, e)
    const segunda = sincroniza(lote, e)
    expect(segunda.every((x) => x.resultado === 'repetido')).toBe(true)
  })

  it('se procesa en orden de captura, no de llegada', () => {
    // El movil manda la salida antes que la entrada. Aplicarlo asi dejaria el turno
    // en un estado imposible.
    const e = nuevoEstado([T('t1')])
    const r = sincroniza(
      [estadoTurno('s2', 't1', 900, 'terminado'), estadoTurno('s1', 't1', 100, 'en_curso')],
      e,
    )
    expect(r.map((x) => x.id_local)).toEqual(['s1', 's2'])
    expect(e.turnos.get('t1')!.estado).toBe('terminado')
  })

  it('un hecho de un turno reasignado NO se pierde', () => {
    // Lo mas importante del fichero: el operario estuvo alli. Tirar esa prueba es
    // tirar justo lo que el cliente del cliente esta pagando.
    const e = nuevoEstado([T('t1', { crew_id: 'uid-otra-persona' })])
    const r = sincroniza([checkin('c1', 't1', 100), informe('i1', 't1', 200)], e)
    expect(r.every((x) => x.resultado === 'aplicado')).toBe(true)
    expect(r[0]!.motivo).toContain('reasignar')
  })

  it('pero una accion sobre un turno reasignado SI se rechaza, con motivo', () => {
    const e = nuevoEstado([T('t1', { crew_id: 'uid-otra-persona' })])
    const r = sincroniza([estadoTurno('s1', 't1', 100, 'en_curso')], e)
    expect(r[0]!.resultado).toBe('rechazado')
    expect(r[0]!.motivo).toContain('reasigno')
    expect(e.turnos.get('t1')!.estado).toBe('publicado')
  })

  it('un turno cancelado rechaza todo, y lo dice', () => {
    const e = nuevoEstado([T('t1', { estado: 'cancelado' })])
    const r = sincroniza([checkin('c1', 't1', 100)], e)
    expect(r[0]!.resultado).toBe('rechazado')
    expect(r[0]!.motivo).toContain('cancelo')
  })

  it('un movil con una version vieja no puede echar el turno hacia atras', () => {
    const e = nuevoEstado([T('t1', { estado: 'terminado' })])
    const r = sincroniza([estadoTurno('s1', 't1', 100, 'en_curso')], e)
    expect(r[0]!.resultado).toBe('rechazado')
    expect(e.turnos.get('t1')!.estado).toBe('terminado')
  })

  it('un turno que no existe se rechaza en vez de reventar', () => {
    const e = nuevoEstado([])
    const r = sincroniza([checkin('c1', 'fantasma', 100)], e)
    expect(r[0]!.resultado).toBe('rechazado')
  })

  it('un fichaje fuera del radio se guarda marcado, NO se rechaza', () => {
    // El GPS falla en naves y sotanos. Rechazarlo dejaria a la persona sin poder
    // demostrar que fue.
    const e = nuevoEstado([T('t1')])
    const r = sincroniza([checkin('c1', 't1', 100, { lat: 40.5, lng: -3.9 })], e)
    expect(r[0]!.resultado).toBe('aplicado')
    expect(r[0]!.dentro_del_radio).toBe(false)
  })

  it('dentro del radio se marca como dentro', () => {
    const e = nuevoEstado([T('t1')])
    const r = sincroniza([checkin('c1', 't1', 100, { lat: 40.4169, lng: -3.7039 })], e)
    expect(r[0]!.dentro_del_radio).toBe(true)
  })

  it('el dia malo entero, de una vez', () => {
    const e = nuevoEstado([
      T('t1'),
      T('t2', { crew_id: 'uid-otra-persona' }),
      T('t3', { estado: 'cancelado' }),
    ])
    const lote = [
      checkin('c1', 't1', 100),
      estadoTurno('s1', 't1', 150, 'en_curso'),
      checkin('c2', 't2', 300),
      estadoTurno('s2', 't2', 350, 'en_curso'),
      checkin('c3', 't3', 500),
      informe('i1', 't1', 600),
    ]
    const r = sincroniza(lote, e)
    const por = Object.fromEntries(r.map((x) => [x.id_local, x.resultado]))

    expect(por['c1']).toBe('aplicado')
    expect(por['s1']).toBe('aplicado')
    expect(por['c2']).toBe('aplicado') // su fichaje se guarda aunque ya no sea suyo
    expect(por['s2']).toBe('rechazado') // pero no mueve el turno de otro
    expect(por['c3']).toBe('rechazado') // turno cancelado
    expect(por['i1']).toBe('aplicado')

    // Y reenviarlo entero no cambia nada de lo aplicado.
    const otra = sincroniza(lote, e)
    expect(otra.filter((x) => x.resultado === 'repetido')).toHaveLength(4)
  })
})

describe('la alerta de turno sin cubrir', () => {
  const inicios = new Map([['t1', 1_000_000]])

  it('no avisa dentro del margen', () => {
    const justo = 1_000_000 + (MARGEN_MINUTOS - 1) * 60_000
    expect(turnosSinFichar([T('t1')], inicios, new Set(), justo)).toHaveLength(0)
  })

  it('avisa pasado el margen si nadie ficho', () => {
    const tarde = 1_000_000 + (MARGEN_MINUTOS + 1) * 60_000
    expect(turnosSinFichar([T('t1')], inicios, new Set(), tarde)).toHaveLength(1)
  })

  it('no avisa si ya ficho', () => {
    const tarde = 1_000_000 + 60 * 60_000
    expect(turnosSinFichar([T('t1')], inicios, new Set(['t1']), tarde)).toHaveLength(0)
  })

  it('no avisa de un turno cancelado ni de uno ya en curso', () => {
    const tarde = 1_000_000 + 60 * 60_000
    const turnos = [T('t1', { estado: 'cancelado' }), T('t1', { estado: 'en_curso' })]
    expect(turnosSinFichar(turnos, inicios, new Set(), tarde)).toHaveLength(0)
  })
})

describe('la distancia', () => {
  it('el mismo punto son cero metros', () => {
    expect(metrosEntre(40.4168, -3.7038, 40.4168, -3.7038)).toBeCloseTo(0, 5)
  })

  it('un grado de latitud son unos 111 km', () => {
    expect(metrosEntre(40, 0, 41, 0)).toBeGreaterThan(110_000)
    expect(metrosEntre(40, 0, 41, 0)).toBeLessThan(112_000)
  })
})
