/**
 * La unica puerta al backend. Ningun componente llama a fetch por su cuenta.
 *
 * Dos cosas que se resuelven aqui y no en cada pantalla:
 *
 *   - El token va en todas las peticiones. Si se pone a mano en cada llamada, tarde o
 *     temprano falta en una y esa pantalla falla solo para el usuario que no es admin.
 *   - Un error trae SIEMPRE un texto que se puede ensenar. "algo salio mal" obliga a
 *     la persona a llamar por telefono, y ese telefono es el del cliente.
 */

const BASE = import.meta.env['VITE_API'] ?? ''

/**
 * El modo demo.
 *
 * Un panel vacio no se puede ensenar a nadie: una cola de moderacion sin nada que
 * moderar y un tablero sin turnos parecen un producto roto, no un producto nuevo. Y una
 * demo con backend detras exige una base de datos encendida, con datos sembrados, para
 * que un desconocido haga clic un martes a las tres de la manana.
 *
 * Asi que la demo son las mismas pantallas contra respuestas fijas. No hay una segunda
 * version del producto que pueda quedarse atras: es este codigo, con la red sustituida.
 * Lo dice en la propia pantalla -- ver `AvisoDemo` -- porque ensenar datos inventados
 * sin decirlo es exactamente lo que no vamos a hacer.
 */
let respuestasDemo: Record<string, unknown> | null = null

export function modoDemo(respuestas: Record<string, unknown>) {
  respuestasDemo = respuestas
}

export function esDemo() {
  return respuestasDemo !== null
}

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

function explica(estado: number, cuerpo: unknown): string {
  const delServidor =
    typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo
      ? String((cuerpo as { error: unknown }).error)
      : ''
  if (estado === 401) return 'Your session expired. Sign in again.'
  if (estado === 403) return 'Your account does not have access to this.'
  if (estado === 404) return 'That is not here any more.'
  if (estado === 409) return delServidor || 'Somebody changed this while you were looking at it.'
  if (estado === 429) return 'Too many requests at once. Give it a minute.'
  if (estado >= 500) return 'The server had a problem. Nothing you did caused it; try again shortly.'
  return delServidor || `Request failed (${estado}).`
}

export async function api<T>(ruta: string, opciones: RequestInit & { token?: string } = {}) {
  if (respuestasDemo) {
    const clave = ruta.split('?')[0] ?? ruta
    const guardada = respuestasDemo[clave]
    if (guardada === undefined) throw new ErrorApi(404, 'That is not part of the demo data.')
    // Una espera corta a proposito: sin ella el estado de carga no se ve nunca y nadie
    // se entera de que existe hasta que falla en produccion.
    await new Promise((listo) => setTimeout(listo, 220))
    return guardada as T
  }

  const { token, ...resto } = opciones
  const r = await fetch(`${BASE}${ruta}`, {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...resto.headers,
    },
  })
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new ErrorApi(r.status, explica(r.status, cuerpo))
  return cuerpo as T
}
