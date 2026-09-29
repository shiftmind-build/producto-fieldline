import { padre } from '../../lib/padre'
import type { Quien } from '../../lib/auth.js'

/**
 * La misma condicion que la regla de Firestore, aplicada tambien aqui.
 *
 * Las reglas son la ultima barrera, no la unica: el handler nunca confia en que el
 * cliente ya filtro. Si estas dos cosas divergen, manda la mas permisiva -- por eso
 * las genera la fabrica desde el mismo bloque `acceso` del blueprint.
 */
export async function puedeLeer(quien: Quien, doc: Record<string, unknown>) {
  return await (doc.crew_id === quien.uid || (await padre('sites', doc.site_id))?.client_id === quien.uid || ['dispatcher'].includes(quien.role))
}

export async function puedeEscribir(quien: Quien, doc: Record<string, unknown>) {
  return await (['dispatcher'].includes(quien.role))
}

export async function puedeBorrar(quien: Quien, doc: Record<string, unknown>) {
  return await (false)
}
