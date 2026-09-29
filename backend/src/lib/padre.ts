import { getFirestore } from 'firebase-admin/firestore'

/**
 * El documento del que una fila hereda su permiso.
 *
 * Algunas entidades no dicen por si mismas quien puede verlas: un fichaje lo puede leer
 * el operario de SU turno, y eso solo se sabe mirando el turno. La regla de Firestore
 * hace un get() equivalente; esto es su gemelo del lado del handler.
 */
export async function padre(coleccion: string, id: unknown) {
  if (typeof id !== 'string' || !id) return null
  const doc = await getFirestore().collection(coleccion).doc(id).get()
  return doc.exists ? (doc.data() as Record<string, unknown>) : null
}
