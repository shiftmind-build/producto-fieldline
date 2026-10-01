import type { ReactNode } from 'react'
import { esDemo } from './api'

/**
 * Las piezas compartidas. Aqui no hay ningun color escrito: todo sale de los tokens.
 *
 * Un `#2563EB` suelto en un componente sobrevive al cambio de tokens y rompe el
 * producto siguiente sin que nadie se entere hasta que lo mira.
 */

export function Estado({ tipo, children }: { tipo: 'bien' | 'aviso' | 'mal' | 'neutro'; children: ReactNode }) {
  return <span className={`estado ${tipo}`}>{children}</span>
}

export function Tarjeta({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="tarjeta">
      {titulo && <p className="etiqueta">{titulo}</p>}
      {children}
    </div>
  )
}

/**
 * Una tabla que nunca deja la pagina en blanco.
 *
 * Los tres estados -- cargando, error y vacio -- se resuelven aqui una vez. Dejarlo a
 * cada pantalla garantiza que en alguna se olvide el vacio, y el usuario vea una tabla
 * sin filas sin saber si esta cargando o si no hay nada.
 */
export function Tabla<T>({
  columnas,
  filas,
  fila,
  cargando,
  error,
  vacio,
}: {
  columnas: string[]
  filas: T[] | undefined
  fila: (f: T) => ReactNode
  cargando?: boolean
  error?: string | null
  vacio: string
}) {
  if (error) return <div className="error">{error}</div>
  if (cargando) return <div className="cargando">Loading…</div>
  if (!filas || filas.length === 0) return <div className="vacio">{vacio}</div>
  return (
    <div className="tabla-envoltorio">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{filas.map(fila)}</tbody>
      </table>
    </div>
  )
}

/**
 * Que los datos son inventados, dicho en la pantalla y no en una nota al pie.
 *
 * Una demo que no se identifica como demo es una captura de pantalla falsa con botones.
 */
export function AvisoDemo({ children }: { children?: ReactNode }) {
  if (!esDemo()) return null
  return (
    <div className="aviso-demo">
      <strong>Demo data.</strong>{' '}
      {children ?? 'Nothing here is real and nothing you click is saved.'}
    </div>
  )
}

/**
 * La navegacion entre pantallas, sin router.
 *
 * Cuatro pantallas no justifican una dependencia mas: lo que si justifica es que el
 * enlace activo se vea, porque un panel donde no sabes en que pantalla estas se navega
 * a base de probar.
 */
export function Pestanas<T extends string>({
  vistas,
  activa,
  onCambio,
}: {
  vistas: ReadonlyArray<readonly [T, string]>
  activa: T
  onCambio: (v: T) => void
}) {
  return (
    <>
      {vistas.map(([clave, etiqueta]) => (
        <a
          key={clave}
          href={`#${clave}`}
          {...(clave === activa ? { 'aria-current': 'page' as const } : {})}
          onClick={(e) => {
            e.preventDefault()
            onCambio(clave)
          }}
        >
          {etiqueta}
        </a>
      ))}
    </>
  )
}

/**
 * El detalle de una fila, al lado y no en otra pagina.
 *
 * En un panel de trabajo se abre una fila, se mira y se vuelve. Si eso es una pagina
 * nueva, se pierde el sitio en la tabla y la posicion del scroll en cada ida y vuelta.
 */
export function Panel({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  return (
    <aside className="panel" role="dialog" aria-label={titulo}>
      <div className="panel-cabecera">
        <h3>{titulo}</h3>
        <button type="button" className="boton secundario" onClick={onCerrar}>
          Close
        </button>
      </div>
      <div className="panel-cuerpo">{children}</div>
    </aside>
  )
}

/** Dato con su etiqueta. Se repite en todas las fichas, asi que vive aqui una vez. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <p className="etiqueta" style={{ margin: 0 }}>
        {etiqueta}
      </p>
      <p style={{ margin: '2px 0 0' }}>{children}</p>
    </div>
  )
}

export function Marco({ nombre, nav, children }: { nombre: string; nav: ReactNode; children: ReactNode }) {
  return (
    <div className="marco">
      <aside className="lateral">
        <h2>{nombre}</h2>
        <nav className="nav" style={{ marginTop: 'var(--hueco)' }}>
          {nav}
        </nav>
      </aside>
      <main className="principal">{children}</main>
    </div>
  )
}
