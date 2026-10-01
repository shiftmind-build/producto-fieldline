/**
 * Las formas que viajan entre el backend y las pantallas.
 *
 * El seed de la demo se escribe contra estos mismos tipos: un campo que cambie en el
 * backend rompe la compilacion de la demo, no la cara de quien la abre.
 */

export type Marca = { _seconds: number }

export type EstadoTurno = 'publicado' | 'en_curso' | 'terminado' | 'cancelado'

export type Sitio = {
  id: string
  nombre: string
  direccion: string
  radio_metros: number
}

export type Turno = {
  id: string
  site_id: string
  site_nombre: string
  crew_id: string
  crew_nombre: string
  estado: EstadoTurno
  empieza: Marca
  termina: Marca
  /** Hora real de entrada. Vacio = todavia no ha fichado. */
  fichado_en?: Marca
  /** El fichaje cayo fuera del radio del sitio. No se rechaza: se marca. */
  fuera_del_radio?: boolean
  /** La oficina se lo paso a otra persona mientras el movil estaba sin cobertura. */
  reasignado_desde?: string
  informes: number
}

export type Alerta = {
  id: string
  shift_id: string
  tipo: 'sin_fichar' | 'fuera_de_radio' | 'sin_sincronizar'
  detalle: string
  creada_en: Marca
  crew_nombre: string
  site_nombre: string
}

export type Tablero = {
  alertas: Alerta[]
  turnos: Turno[]
  /** Dispositivos que llevan horas sin aparecer. Lo normal en campo, no una averia. */
  sin_sincronizar: Array<{ crew_nombre: string; ultima_vez: Marca; eventos_en_cola: number }>
}

export type Entrada = {
  id: string
  tipo: 'checkin' | 'informe' | 'estado_turno'
  momento: Marca
  resultado: 'aplicado' | 'repetido' | 'rechazado'
  motivo?: string
  dentro_del_radio?: boolean
  texto?: string
  fotos?: number
}

export type DetalleTurno = {
  turno: Turno
  entradas: Entrada[]
}
