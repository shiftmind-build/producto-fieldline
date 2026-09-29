import { defineConfig } from 'vitest/config'

/**
 * Los tests leen firestore.rules del raiz del proyecto, no de backend/, asi que el root
 * de vitest es el raiz y el patron apunta a backend/.
 *
 * `fileParallelism: false` no es una preferencia: los ficheros comparten un unico
 * emulador de Firestore, y el `clearFirestore()` del `beforeEach` de uno borra la fila
 * que otro acaba de sembrar. En paralelo la suite falla de forma intermitente, y una
 * puerta intermitente termina desactivada -- que es peor que no tenerla.
 */
export default defineConfig({
  test: {
    root: '.',
    include: ['backend/src/tests/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
  },
})
