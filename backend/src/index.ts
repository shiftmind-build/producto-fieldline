import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { initializeApp } from 'firebase-admin/app'
import type { ErrorRequestHandler } from 'express'
import { asyncHandler } from './lib/asyncHandler.js'
import { montaRutas } from './rutas.js'

/**
 * Fieldline -- API.
 *
 * Los imports relativos llevan `.js` a proposito: Node en modo ESM no resuelve
 * extensiones, asi que sin ella compila sin una queja y revienta al arrancar con
 * ERR_MODULE_NOT_FOUND. Solo se ve ejecutandolo, nunca en el typecheck.
 *
 * El orden importa: helmet, cors y json ANTES de cualquier ruta, y el manejador de
 * errores DESPUES de todas. Un manejador de errores declarado antes de las rutas no
 * captura nada y da una falsa sensacion de estar cubierto.
 */
initializeApp()

const app = express()

// cors() desde el primer commit, nunca opcional: el frontend (Lovable) y este backend
// (Cloud Run) son siempre origenes distintos. Sin esto funciona en curl y falla solo en
// un navegador real, que es la peor forma de descubrirlo.
app.use(cors())
app.use(helmet())
app.use(express.json({ limit: '1mb' }))

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.status(200).json({ ok: true })
  }),
)

montaRutas(app)

const alFallar: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = typeof error?.status === 'number' ? error.status : 500
  // Al cliente, lo justo. El detalle al log: un mensaje de error detallado en la
  // respuesta le cuenta a un atacante como esta montado esto por dentro.
  if (status >= 500) console.error('[Fieldline] sin capturar', error)
  res.status(status).json({ error: status >= 500 ? 'error interno' : error.message })
}
app.use(alFallar)

// Ultima red. Si algo escapa igualmente, queda escrito antes de que el proceso muera;
// sin esto, Cloud Run reinicia el contenedor y no queda rastro de por que.
process.on('unhandledRejection', (razon) => {
  console.error('[Fieldline] promesa sin capturar', razon)
})

const puerto = Number(process.env['PORT'] ?? 8080)
app.listen(puerto, () => console.log(`[Fieldline] escuchando en ${puerto}`))
