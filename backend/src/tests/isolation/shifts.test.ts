import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'

/**
 * Aislamiento de shifts. Obligatorio y bloqueante: corre en el hook pre-push.
 *
 * Lo que comprueba no es que la aplicacion funcione, es que NO funciona para quien no
 * debe. Un usuario que consigue leer la fila de otro es el fallo mas caro de un MVP y
 * el que no da ninguna senyal hasta que alguien lo descubre.
 *
 * Generado desde el bloque `acceso` de blueprint.yaml -- no se edita a mano: se cambia
 * el blueprint y se vuelve a generar, o la regla y el test dejan de hablar de lo mismo.
 */
describe('aislamiento: shifts', () => {
  let ctx: RulesTestEnvironment

  beforeAll(async () => {
    ctx = await initializeTestEnvironment({
      projectId: 'shiftmind-fieldline',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
  })

  afterAll(async () => {
    await ctx.cleanup()
  })

  beforeEach(async () => {
    await ctx.clearFirestore()
    await ctx.withSecurityRulesDisabled(async (libre) => {
      await libre.firestore().doc('shifts/d1').set({
      'crew_id': 'uid-a',
      'site_id': 'x',
      'inicio_previsto': 'x',
      'fin_previsto': 'x',
      'estado': 'x',
      'publicado_en': 'x'
})
    })
  })

  it('el duenyo lee su propia fila', async () => {
    const a = ctx.authenticatedContext('uid-a', { role: 'dispatcher' })
    await assertSucceeds(a.firestore().doc('shifts/d1').get())
  })

  it('sin sesion no se lee nada', async () => {
    const fuera = ctx.unauthenticatedContext()
    await assertFails(fuera.firestore().doc('shifts/d1').get())
  })

  it('dispatcher SI lee la fila, como declara el blueprint', async () => {
    const rol = ctx.authenticatedContext('uid-b', { role: 'dispatcher' })
    await assertSucceeds(rol.firestore().doc('shifts/d1').get())
  })

  it('client NO lee la fila de otro', async () => {
    const otro = ctx.authenticatedContext('uid-b', { role: 'client' })
    await assertFails(otro.firestore().doc('shifts/d1').get())
  })

  it('crew NO lee la fila de otro', async () => {
    const otro = ctx.authenticatedContext('uid-b', { role: 'crew' })
    await assertFails(otro.firestore().doc('shifts/d1').get())
  })

  it('un tercero no puede modificar ni borrar la fila de otro', async () => {
    const otro = ctx.authenticatedContext('uid-c', { role: 'client' })
    await assertFails(otro.firestore().doc('shifts/d1').update({ estado: 'pirateado' }))
    await assertFails(otro.firestore().doc('shifts/d1').delete())
  })
})
