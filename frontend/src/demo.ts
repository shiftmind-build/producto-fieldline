import type { Alerta, DetalleTurno, Sitio, Tablero, Turno } from './tipos'

/**
 * Los datos de la demo publica. Inventados, y la pantalla lo dice.
 *
 * Elegidos para ensenar lo unico que distingue a este producto de una hoja de turnos:
 * que pasa cuando el movil lleva seis horas sin cobertura y la oficina ha movido cosas
 * mientras tanto.
 *
 *   - Un turno reasignado con un fichaje de la persona ANTERIOR. El fichaje se guarda
 *     (puede ser la unica prueba de que estuvo alli) y el cambio de estado se rechaza.
 *   - Un fichaje fuera del radio. No se rechaza: el GPS falla en naves y sotanos, y
 *     rechazarlo dejaria a la persona sin poder demostrar que fue.
 *   - Un turno cancelado mientras el dispositivo estaba sin cobertura.
 *   - Un reenvio del mismo lote marcado como repetido, que es lo que hace que reenviar
 *     sea inofensivo y pasa todos los dias.
 */

/**
 * La demo se ancla al momento en que se abre, no a una fecha escrita.
 *
 * Con una fecha fija la demo envejece sola: en diciembre un turno "de hoy" sale con
 * fecha de octubre y un reintento "manyana" sale pasado hace dos meses. Una demo con
 * fechas rancias dice de la empresa exactamente lo contrario de lo que queremos.
 *
 * Redondeado a la hora en punto: un turno de 07:54 a 15:54 no existe en ningun cuadrante
 * del mundo, y ese detalle es lo primero que ve alguien que trabaja con turnos.
 */
const AHORA = Math.floor(Date.now() / 3_600_000) * 3600
const horas = (n: number) => ({ _seconds: AHORA + n * 3600 })

const SITIOS: Sitio[] = [
  { id: 'site_1', nombre: 'Kestrel Yard', direccion: 'Unit 4, Kestrel Industrial Estate', radio_metros: 150 },
  { id: 'site_2', nombre: 'Harbour Works', direccion: 'Dock Road, Bay 7', radio_metros: 200 },
  { id: 'site_3', nombre: 'Elm Court', direccion: '14 Elm Court, basement plant room', radio_metros: 100 },
]

const TURNOS: Turno[] = [
  {
    id: 'sh_1',
    site_id: 'site_1',
    site_nombre: 'Kestrel Yard',
    crew_id: 'c_1',
    crew_nombre: 'Danny Reeve',
    estado: 'en_curso',
    empieza: horas(-2),
    termina: horas(6),
    fichado_en: horas(-2),
    informes: 1,
  },
  {
    // El caso que explica el producto: fichaje de quien de verdad estuvo alli, guardado
    // aunque la oficina ya se lo hubiera pasado a otro.
    id: 'sh_2',
    site_id: 'site_3',
    site_nombre: 'Elm Court',
    crew_id: 'c_3',
    crew_nombre: 'Omar Salah',
    estado: 'en_curso',
    empieza: horas(-5),
    termina: horas(3),
    fichado_en: horas(-5),
    reasignado_desde: 'Priya Dunn',
    informes: 2,
  },
  {
    // Sotano. El GPS no llega y el fichaje cae fuera del radio.
    id: 'sh_3',
    site_id: 'site_3',
    site_nombre: 'Elm Court',
    crew_id: 'c_4',
    crew_nombre: 'Marta Lind',
    estado: 'en_curso',
    empieza: horas(-1),
    termina: horas(7),
    fichado_en: horas(-1),
    fuera_del_radio: true,
    informes: 0,
  },
  {
    id: 'sh_4',
    site_id: 'site_2',
    site_nombre: 'Harbour Works',
    crew_id: 'c_5',
    crew_nombre: 'Ben Arrowsmith',
    estado: 'publicado',
    empieza: horas(-1),
    termina: horas(7),
    informes: 0,
  },
  {
    id: 'sh_5',
    site_id: 'site_2',
    site_nombre: 'Harbour Works',
    crew_id: 'c_6',
    crew_nombre: 'Kirsty Nolan',
    estado: 'terminado',
    empieza: horas(-11),
    termina: horas(-3),
    fichado_en: horas(-11),
    informes: 3,
  },
  {
    id: 'sh_6',
    site_id: 'site_1',
    site_nombre: 'Kestrel Yard',
    crew_id: 'c_7',
    crew_nombre: 'Tess Okoro',
    estado: 'cancelado',
    empieza: horas(-4),
    termina: horas(4),
    informes: 0,
  },
]

const ALERTAS: Alerta[] = [
  {
    id: 'al_1',
    shift_id: 'sh_4',
    tipo: 'sin_fichar',
    detalle: 'started 1h ago, nobody checked in',
    creada_en: horas(-0.75),
    crew_nombre: 'Ben Arrowsmith',
    site_nombre: 'Harbour Works',
  },
  {
    id: 'al_2',
    shift_id: 'sh_3',
    tipo: 'fuera_de_radio',
    detalle: 'checked in 380m from the site — basement plant room, GPS is unreliable there',
    creada_en: horas(-1),
    crew_nombre: 'Marta Lind',
    site_nombre: 'Elm Court',
  },
]

const DETALLES: Record<string, DetalleTurno> = {
  sh_2: {
    turno: TURNOS[1]!,
    entradas: [
      {
        id: 'e_1',
        tipo: 'checkin',
        momento: horas(-5),
        resultado: 'aplicado',
        dentro_del_radio: true,
        motivo: 'captured before the shift was reassigned',
      },
      {
        id: 'e_2',
        tipo: 'informe',
        momento: horas(-4.5),
        resultado: 'aplicado',
        texto: 'Pump 2 leaking at the gland. Isolated it, parts ordered.',
        fotos: 2,
      },
      {
        // El hecho se guarda; mover el turno, no.
        id: 'e_3',
        tipo: 'estado_turno',
        momento: horas(-4),
        resultado: 'rechazado',
        motivo: 'the shift was reassigned to somebody else',
      },
      {
        id: 'e_4',
        tipo: 'checkin',
        momento: horas(-5),
        resultado: 'repetido',
        motivo: 'same batch resent when the signal came back',
      },
      {
        id: 'e_5',
        tipo: 'informe',
        momento: horas(-2),
        resultado: 'aplicado',
        texto: 'Replacement seal fitted, pump back on. Second photo is the pressure reading.',
        fotos: 1,
      },
    ],
  },
  sh_3: {
    turno: TURNOS[2]!,
    entradas: [
      {
        id: 'e_6',
        tipo: 'checkin',
        momento: horas(-1),
        resultado: 'aplicado',
        dentro_del_radio: false,
      },
    ],
  },
  sh_6: {
    turno: TURNOS[5]!,
    entradas: [
      {
        id: 'e_7',
        tipo: 'checkin',
        momento: horas(-4),
        resultado: 'rechazado',
        motivo: 'the shift was cancelled while the device was offline',
      },
    ],
  },
  sh_1: {
    turno: TURNOS[0]!,
    entradas: [
      { id: 'e_8', tipo: 'checkin', momento: horas(-2), resultado: 'aplicado', dentro_del_radio: true },
      {
        id: 'e_9',
        tipo: 'informe',
        momento: horas(-1),
        resultado: 'aplicado',
        texto: 'Gate motor tested, all three bays cycling normally.',
        fotos: 0,
      },
    ],
  },
}

const TABLERO: Tablero = {
  alertas: ALERTAS,
  turnos: TURNOS,
  sin_sincronizar: [
    { crew_nombre: 'Omar Salah', ultima_vez: horas(-6), eventos_en_cola: 5 },
    { crew_nombre: 'Marta Lind', ultima_vez: horas(-1), eventos_en_cola: 1 },
  ],
}

export const DEMO: Record<string, unknown> = {
  '/tablero': TABLERO,
  '/sitios': { sitios: SITIOS },
  ...Object.fromEntries(Object.entries(DETALLES).map(([id, d]) => [`/turnos/${id}`, d])),
}
