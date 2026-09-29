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
export const esquemaShifts = z
  .object({
  crew_id: z.unknown(),
  site_id: z.unknown(),
  inicio_previsto: z.unknown(),
  fin_previsto: z.unknown(),
  estado: z.unknown(),
  publicado_en: z.unknown(),
  })
  .strict()

export type Shifts = z.infer<typeof esquemaShifts>
