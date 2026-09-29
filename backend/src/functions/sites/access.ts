import type { Quien } from '../../lib/auth.js'

/**
 * La misma condicion que la regla de Firestore, aplicada tambien aqui.
 *
 * Las reglas son la ultima barrera, no la unica: el handler nunca confia en que el
 * cliente ya filtro. Si estas dos cosas divergen, manda la mas permisiva -- por eso
 * las genera la fabrica desde el mismo bloque `acceso` del blueprint.
 */
export function puedeLeer(quien: Quien, doc: Record<string, unknown>) {
  return (doc.client_id === quien.uid || ['dispatcher'].includes(quien.role))
}

export function puedeEscribir(quien: Quien, doc: Record<string, unknown>) {
  return (['dispatcher'].includes(quien.role))
}

export function puedeBorrar(quien: Quien, doc: Record<string, unknown>) {
  return (false)
}
