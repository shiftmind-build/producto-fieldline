import type { NextFunction, Request, Response } from 'express'
import { getAuth } from 'firebase-admin/auth'

/**
 * La unica puerta de entrada. Ningun handler llama a Firebase Admin por su cuenta.
 *
 * Si hubiera dos formas de comprobar quien eres, una de las dos acabaria siendo la
 * floja, y seria la que alguien copie y pegue con prisa un viernes.
 */
export type Quien = { uid: string; role: string }

declare module 'express-serve-static-core' {
  interface Request {
    quien?: Quien
  }
}

export async function verificarAuth(req: Request): Promise<Quien> {
  const cabecera = req.header('authorization') ?? ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!token) throw Object.assign(new Error('sin token'), { status: 401 })

  try {
    const decodificado = await getAuth().verifyIdToken(token)
    // El rol vive en el custom claim, puesto por on-user-create. Un token sin rol es un
    // token que no ha pasado por ahi: se rechaza en vez de asumir el rol mas bajo, que
    // seria adivinar sobre permisos.
    const role = typeof decodificado['role'] === 'string' ? (decodificado['role'] as string) : ''
    if (!role) throw new Error('sin rol')
    return { uid: decodificado.uid, role }
  } catch {
    throw Object.assign(new Error('token invalido'), { status: 401 })
  }
}

/** 401 si no hay sesion, 403 si el rol no es uno de los permitidos. En ese orden. */
export function requireRole(roles: string | string[]) {
  const permitidos = Array.isArray(roles) ? roles : [roles]
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const quien = await verificarAuth(req)
      if (!permitidos.includes(quien.role)) {
        throw Object.assign(new Error('rol no autorizado'), { status: 403 })
      }
      req.quien = quien
      next()
    } catch (error) {
      next(error)
    }
  }
}
