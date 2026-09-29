import { z } from 'zod'

/**
 * Los campos declarados en el blueprint, y solo esos.
 *
 * `.strict()` no es cosmetico: sin el, un cliente puede colar un campo extra --
 * `role`, `owner_id`, `estado` -- que ninguna regla mira porque nadie sabia que
 * existia. Rechazar lo no declarado es lo que hace que la lista de campos signifique
 * algo.
 *
 * Los tipos concretos se afinan al escribir el motor de este producto; lo que esta
 * fijado desde el blueprint es QUE campos existen.
 */
export const esquemaReports = z
  .object({
  shift_id: z.unknown(),
  texto: z.unknown(),
  fotos_urls: z.unknown(),
  incidencia: z.unknown(),
  creado_en: z.unknown(),
  sincronizado_en: z.unknown(),
  cliente_id_local: z.unknown(),
  })
  .strict()

export type Reports = z.infer<typeof esquemaReports>
