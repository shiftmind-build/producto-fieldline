import type { NextFunction, Request, Response, RequestHandler } from 'express'

/**
 * Envuelve un handler asincrono para que un rechazo llegue al manejador de errores.
 *
 * Express 4 no captura las promesas rechazadas: sin esto, un `await` que falla dentro
 * de una ruta se convierte en un unhandledRejection y tumba el proceso -- para todos
 * los usuarios, no solo para el que provoco el fallo. Paso una vez, con un
 * PERMISSION_DENIED de Firestore, y por eso toda ruta pasa por aqui sin excepcion.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
