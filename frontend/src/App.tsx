import { useEffect, useState } from 'react'
import { api, ErrorApi } from './api'
import { AvisoDemo, Dato, Estado as Pastilla, Marco, Panel, Pestanas, Tabla, Tarjeta } from './piezas'
import type { DetalleTurno, Entrada, EstadoTurno, Sitio, Tablero } from './tipos'

/**
 * El tablero de Fieldline.
 *
 * Un tablero de turnos es facil. Lo dificil, y lo que decide si esto sirve en campo, es
 * que hacer cuando un movil lleva seis horas sin cobertura y vuelve con todo de golpe
 * mientras la oficina ha movido turnos por su cuenta.
 *
 * La regla que gobierna la pantalla entera: un HECHO capturado por quien de verdad
 * estuvo alli no se tira nunca -- puede ser la unica prueba de un trabajo hecho. Lo que
 * no se acepta es que ese movil mueva el estado de un turno que ya no es suyo.
 *
 * Por eso el detalle de un turno ensena las entradas aceptadas Y las rechazadas con su
 * motivo. Un sistema que descarta en silencio es un sistema en el que nadie confia la
 * segunda vez que pasa.
 */

const VISTAS = [
  ['hoy', 'Today'],
  ['sitios', 'Sites'],
] as const

type Vista = (typeof VISTAS)[number][0]

function hora(t?: { _seconds?: number }) {
  if (!t?._seconds) return '—'
  return new Date(t._seconds * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function hace(t?: { _seconds?: number }) {
  if (!t?._seconds) return '—'
  const h = Math.round((Date.now() / 1000 - t._seconds) / 3600)
  return h <= 0 ? 'just now' : `${h}h ago`
}

const ESTADOS: Record<EstadoTurno, { texto: string; tipo: 'bien' | 'aviso' | 'mal' | 'neutro' }> = {
  publicado: { texto: 'not started', tipo: 'neutro' },
  en_curso: { texto: 'on site', tipo: 'bien' },
  terminado: { texto: 'finished', tipo: 'neutro' },
  cancelado: { texto: 'cancelled', tipo: 'mal' },
}

const ENTRADAS: Record<Entrada['tipo'], string> = {
  checkin: 'check-in',
  informe: 'report',
  estado_turno: 'shift status',
}

function useCarga<T>(ruta: string | null, token: string) {
  const [dato, setDato] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(ruta !== null)

  useEffect(() => {
    if (!ruta) {
      setDato(undefined)
      setCargando(false)
      return
    }
    let vivo = true
    setCargando(true)
    setError(null)
    ;(async () => {
      try {
        const r = await api<T>(ruta, { token })
        if (vivo) setDato(r)
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'Could not reach the server.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [ruta, token])

  return { dato, error, cargando }
}

function Fallo({ texto }: { texto: string }) {
  return (
    <div className="error" style={{ marginTop: 'var(--hueco)' }}>
      <strong>{texto}</strong>
      <p style={{ margin: '8px 0 0' }}>
        <button className="boton secundario" onClick={() => location.reload()}>
          Try again
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ pantallas */

function HoyVista({ token, abre }: { token: string; abre: (id: string) => void }) {
  const { dato, error, cargando } = useCarga<Tablero>('/tablero', token)
  const enSitio = (dato?.turnos ?? []).filter((t) => t.estado === 'en_curso').length

  return (
    <>
      <h1>Today</h1>
      <p style={{ color: 'var(--tinta-suave)', maxWidth: '58ch' }}>
        Who is where, and what needs a phone call. A device that has not synced for hours is
        normal in the field — it only becomes a problem when nobody is told.
      </p>

      {error && <Fallo texto={error} />}

      <div className="fila" style={{ alignItems: 'stretch', marginTop: 'var(--hueco-l)' }}>
        <Tarjeta titulo="Needs a call">
          <p
            className="cifra"
            style={{
              fontSize: '2.6rem',
              fontFamily: 'var(--fuente-titular)',
              fontWeight: 'var(--peso-titular)',
              margin: '4px 0 0',
              color: (dato?.alertas.length ?? 0) > 0 ? 'var(--aviso)' : 'var(--tinta)',
            }}
          >
            {cargando ? '—' : (dato?.alertas.length ?? 0)}
          </p>
          <p style={{ margin: 0, color: 'var(--tinta-suave)', fontSize: '0.85rem' }}>
            open alerts
          </p>
        </Tarjeta>

        <Tarjeta titulo="On site right now">
          <p
            className="cifra"
            style={{
              fontSize: '2.6rem',
              fontFamily: 'var(--fuente-titular)',
              fontWeight: 'var(--peso-titular)',
              margin: '4px 0 0',
              color: 'var(--bien)',
            }}
          >
            {cargando ? '—' : enSitio}
          </p>
          <p style={{ margin: 0, color: 'var(--tinta-suave)', fontSize: '0.85rem' }}>
            checked in and working
          </p>
        </Tarjeta>

        <Tarjeta titulo="Phones out of signal">
          <div className="columna" style={{ gap: 4, marginTop: 4 }}>
            {(dato?.sin_sincronizar ?? []).map((s) => (
              <p key={s.crew_nombre} style={{ margin: 0, fontSize: '0.85rem' }}>
                {s.crew_nombre} · <span style={{ color: 'var(--tinta-suave)' }}>{hace(s.ultima_vez)}</span>{' '}
                <Pastilla tipo="neutro">{s.eventos_en_cola} queued</Pastilla>
              </p>
            ))}
            {!cargando && (dato?.sin_sincronizar.length ?? 0) === 0 && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--tinta-suave)' }}>
                Everybody is up to date.
              </p>
            )}
          </div>
        </Tarjeta>
      </div>

      {(dato?.alertas.length ?? 0) > 0 && (
        <>
          <h2 style={{ marginTop: 'var(--hueco-l)' }}>Alerts</h2>
          <div className="columna" style={{ marginTop: 'var(--hueco-s)', gap: 'var(--hueco-s)' }}>
            {(dato?.alertas ?? []).map((a) => (
              <div key={a.id} className="tarjeta">
                <div className="fila" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {a.crew_nombre} · {a.site_nombre}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--tinta-suave)' }}>
                      {a.detalle}
                    </p>
                  </div>
                  <button className="boton secundario" onClick={() => abre(a.shift_id)}>
                    Open shift
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 style={{ marginTop: 'var(--hueco-l)' }}>Shifts</h2>
      <div style={{ marginTop: 'var(--hueco-s)' }}>
        <Tabla
          columnas={['Crew', 'Site', 'Window', 'Status', 'Checked in', 'Reports', '']}
          filas={dato?.turnos}
          cargando={cargando}
          error={null}
          vacio="No shifts today. Published shifts show up here the moment dispatch creates them."
          fila={(t) => (
            <tr key={t.id}>
              <td>
                {t.crew_nombre}
                {/* La reasignacion se dice en la fila. Es la causa de casi todo lo raro
                    que un dispatcher ve despues, y buscarla en el detalle es tarde. */}
                {t.reasignado_desde && (
                  <span style={{ color: 'var(--aviso)' }}> · was {t.reasignado_desde}</span>
                )}
              </td>
              <td>{t.site_nombre}</td>
              <td className="cifra">
                {hora(t.empieza)}–{hora(t.termina)}
              </td>
              <td>
                <Pastilla tipo={ESTADOS[t.estado].tipo}>{ESTADOS[t.estado].texto}</Pastilla>
              </td>
              <td className="cifra">
                {t.fichado_en ? hora(t.fichado_en) : '—'}
                {t.fuera_del_radio && (
                  <>
                    {' '}
                    <Pastilla tipo="aviso">off site</Pastilla>
                  </>
                )}
              </td>
              <td className="cifra">{t.informes}</td>
              <td>
                <button className="boton secundario" onClick={() => abre(t.id)}>
                  Open
                </button>
              </td>
            </tr>
          )}
        />
      </div>
    </>
  )
}

function SitiosVista({ token }: { token: string }) {
  const { dato, error, cargando } = useCarga<{ sitios: Sitio[] }>('/sitios', token)

  return (
    <>
      <h1>Sites</h1>
      <p style={{ color: 'var(--tinta-suave)', maxWidth: '58ch' }}>
        The radius is how far from the site a check-in still counts as on site. A check-in
        outside it is never rejected — it is flagged, because GPS fails in warehouses and
        basements and rejecting it would leave somebody unable to prove they turned up.
      </p>
      {error && <Fallo texto={error} />}
      <div style={{ marginTop: 'var(--hueco-l)' }}>
        <Tabla
          columnas={['Site', 'Address', 'Radius']}
          filas={dato?.sitios}
          cargando={cargando}
          error={null}
          vacio="No sites yet."
          fila={(s) => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>{s.direccion}</td>
              <td className="cifra">{s.radio_metros} m</td>
            </tr>
          )}
        />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ detalle */

function DetalleTurnoPanel({ id, token, cierra }: { id: string; token: string; cierra: () => void }) {
  const { dato, error, cargando } = useCarga<DetalleTurno>(`/turnos/${id}`, token)

  return (
    <Panel titulo={dato?.turno.crew_nombre ?? 'Shift'} onCerrar={cierra}>
      {cargando && <div className="cargando">Loading…</div>}
      {error && <div className="error">{error}</div>}
      {dato && (
        <>
          <div className="fila">
            <Dato etiqueta="Site">{dato.turno.site_nombre}</Dato>
            <Dato etiqueta="Status">
              <Pastilla tipo={ESTADOS[dato.turno.estado].tipo}>
                {ESTADOS[dato.turno.estado].texto}
              </Pastilla>
            </Dato>
          </div>
          <div className="fila">
            <Dato etiqueta="Window">
              {hora(dato.turno.empieza)}–{hora(dato.turno.termina)}
            </Dato>
            <Dato etiqueta="Checked in">{hora(dato.turno.fichado_en)}</Dato>
          </div>

          {dato.turno.reasignado_desde && (
            <div className="aviso-demo" style={{ margin: 0 }}>
              <strong>Reassigned from {dato.turno.reasignado_desde}.</strong> What they captured
              before the change is kept — it may be the only record that the work was done.
              What is not accepted is their phone moving this shift along.
            </div>
          )}

          <div>
            <p className="etiqueta" style={{ margin: '0 0 6px' }}>
              What the phone sent
            </p>
            <ol className="escalera">
              {dato.entradas.map((e) => (
                <li key={e.id}>
                  <time>{hora(e.momento)}</time>
                  <span>
                    <Pastilla
                      tipo={
                        e.resultado === 'aplicado'
                          ? 'bien'
                          : e.resultado === 'rechazado'
                            ? 'mal'
                            : 'neutro'
                      }
                    >
                      {ENTRADAS[e.tipo]}
                      {e.resultado === 'repetido' && ' · already had it'}
                      {e.resultado === 'rechazado' && ' · rejected'}
                    </Pastilla>
                    {e.dentro_del_radio === false && (
                      <>
                        {' '}
                        <Pastilla tipo="aviso">off site</Pastilla>
                      </>
                    )}
                    {e.texto && (
                      <span style={{ display: 'block', color: 'var(--tinta-suave)' }}>
                        {e.texto}
                        {e.fotos ? ` · ${e.fotos} photo${e.fotos > 1 ? 's' : ''}` : ''}
                      </span>
                    )}
                    {e.motivo && (
                      <span style={{ display: 'block', color: 'var(--tinta-suave)' }}>
                        {e.motivo}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {/*
              Lo rechazado se ensena con su motivo. Un sistema que descarta en silencio
              es un sistema en el que nadie confia la segunda vez que pasa.
            */}
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--tinta-suave)' }}>
              Rejected entries stay on the record with the reason. Resending the same batch is
              harmless — the phone numbers every entry, so a repeat is recognised, not doubled.
            </p>
          </div>
        </>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ app */

export default function App() {
  const [vista, setVista] = useState<Vista>('hoy')
  const [abierto, setAbierto] = useState<string | null>(null)

  const token = new URLSearchParams(location.search).get('t') ?? ''

  return (
    <Marco
      nombre="Fieldline"
      nav={<Pestanas vistas={VISTAS} activa={vista} onCambio={setVista} />}
    >
      <AvisoDemo>
        An invented day on three sites. One shift was reassigned while the phone was offline,
        one check-in landed outside the site radius — open those two to see what happens.
      </AvisoDemo>

      <div className="con-detalle">
        <div>
          {vista === 'hoy' && <HoyVista token={token} abre={setAbierto} />}
          {vista === 'sitios' && <SitiosVista token={token} />}
        </div>
        {abierto && <DetalleTurnoPanel id={abierto} token={token} cierra={() => setAbierto(null)} />}
      </div>
    </Marco>
  )
}
