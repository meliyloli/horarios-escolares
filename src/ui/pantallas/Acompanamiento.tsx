import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { avisosAcompanamiento, cargaAcompanamiento, parejaDe, repartirAcompanamiento, zonaNueva } from '../../dominio/acompanamiento'
import { diasHorario, dictaEn, nombreDia, nuevoId } from '../../dominio/tiempo'
import type { Descanso, Estado, Id, Jornada, Turno, Zona } from '../../dominio/tipos'
import type { Pantalla } from '../App'
import { Aviso, Icono, Vacio } from '../componentes'
import { useEstado } from '../estado'

const COMUNES: [string, boolean][] = [['Patio principal', false], ['Cancha', false], ['Baños', true], ['Tienda escolar', true], ['Pasillos y escaleras', false]]
const NOMBRE_DESCANSO: Record<Descanso, string> = { 1: '1.er descanso', 2: '2.º descanso' }

/** Las zonas cambiaron desde el último reparto: hay turnos que faltan o sobran. */
const desactualizado = (e: Estado): boolean => {
  const a = e.acompanamiento
  if (!a || a.turnos.length === 0) return false
  const pedidos = new Set(a.zonas.flatMap((z) => z.descansos.map((k) => `${z.id}|${k}`)))
  const hechos = new Set(a.turnos.map((t) => `${t.zonaId}|${t.descanso}`))
  return pedidos.size !== hechos.size || [...pedidos].some((x) => !hechos.has(x))
}

export function Acompanamiento({ alIr }: { alIr: (p: Pantalla) => void }) {
  const { estado, cambiar, confirmar, avisar } = useEstado()
  const [imprimiendo, setImprimiendo] = useState(false)
  const zonas = estado.acompanamiento?.zonas ?? []
  const turnos = estado.acompanamiento?.turnos ?? []
  const dias = diasHorario(estado)
  const dosJornadas = new Set(estado.grupos.map((g) => g.jornada)).size > 1 || estado.docentes.some((d) => d.jornada === 'ambas')
  const nombre = (id: Id) => estado.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  const avisos = avisosAcompanamiento(estado)
  const conAcompanamiento = (f: (a: NonNullable<Estado['acompanamiento']>) => NonNullable<Estado['acompanamiento']>) =>
    cambiar((e) => ({ ...e, acompanamiento: f(e.acompanamiento ?? { zonas: [], turnos: [] }) }))
  const zonaCon = (id: Id, c: Partial<Zona>) => conAcompanamiento((a) => ({ ...a, zonas: a.zonas.map((z) => (z.id === id ? { ...z, ...c } : z)) }))
  const turnoCon = (t: Turno, docenteIds: Id[]) => conAcompanamiento((a) => ({ ...a, turnos: a.turnos.map((x) => (x === t || (x.zonaId === t.zonaId && x.dia === t.dia && x.descanso === t.descanso) ? { ...x, docenteIds } : x)) }))
  const repartir = () => {
    cambiar((e) => repartirAcompanamiento(e))
    avisar('Turnos repartidos entre los docentes que cada día están en el colegio, en proporción a su espacio libre.')
  }

  useEffect(() => {
    if (!imprimiendo) return
    const terminar = () => setImprimiendo(false)
    addEventListener('afterprint', terminar)
    const t = setTimeout(() => (typeof print === 'function' ? print() : terminar()), 80)
    return () => {
      removeEventListener('afterprint', terminar)
      clearTimeout(t)
    }
  }, [imprimiendo])

  /** La tabla de turnos de una jornada: filas zona × descanso, columnas días. `editable` agrega los selectores. */
  const tablaTurnos = (jornada: Jornada, editable: boolean) => {
    const filas = zonas.filter((z) => z.jornada === jornada).flatMap((z) => z.descansos.slice().sort().map((k) => ({ z, k })))
    if (filas.length === 0) return null
    const posibles = estado.docentes.filter((d) => !d.externo && dictaEn(d, jornada))
    return (
      <div className="tabla-caja" key={jornada}>
        <table className="datos tabla-turnos">
          <thead>
            <tr><th>Zona</th>{Array.from({ length: dias }, (_, i) => <th key={i}>{nombreDia(i + 1, dias)}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map(({ z, k }) => (
              <tr key={`${z.id}|${k}`}>
                <th scope="row">
                  {z.nombre}{z.algida && <span className="ficha aviso-ficha" style={{ marginLeft: 6 }}>Álgida</span>}
                  <span className="detalle">{NOMBRE_DESCANSO[k]}{parejaDe(z) ? ` · pareja: ${parejaDe(z)!.map(nombre).join(' y ')}` : ''}</span>
                </th>
                {Array.from({ length: dias }, (_, i) => {
                  const t = turnos.find((x) => x.zonaId === z.id && x.dia === i + 1 && x.descanso === k)
                  if (!t) return <td key={i} className="suave">—</td>
                  return (
                    <td key={i}>
                      {editable ? (
                        <span className="pila" style={{ gap: 4 }}>
                          {Array.from({ length: Math.max(z.personas, t.docenteIds.length) }, (_, n) => (
                            <select
                              key={n} aria-label={`${z.nombre}, ${nombreDia(i + 1, dias)}, ${NOMBRE_DESCANSO[k]}${n ? `, docente ${n + 1}` : ''}`}
                              value={t.docenteIds[n] ?? ''}
                              onChange={(ev) => {
                                const ids = [...t.docenteIds]
                                ids[n] = ev.target.value
                                turnoCon(t, ids.filter(Boolean))
                              }}
                            >
                              <option value="">Sin asignar</option>
                              {posibles.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                            </select>
                          ))}
                        </span>
                      ) : (
                        t.docenteIds.map(nombre).join(', ') || 'Sin asignar'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const jornadas: Jornada[] = (['manana', 'tarde'] as const).filter((j) => zonas.some((z) => z.jornada === j))

  return (
    <>
      <header className="cabecera">
        <h2>Acompañamiento en descansos</h2>
        {turnos.length > 0 && <button className="boton" onClick={() => setImprimiendo(true)}><Icono nombre="imprimir" />Imprimir o PDF</button>}
        {zonas.length > 0 && estado.clases.length > 0 && (
          <button className="boton primario" onClick={() => (turnos.length ? confirmar({ titulo: '¿Repartir los turnos de nuevo?', mensaje: 'Se pierden los cambios hechos a mano en los turnos.', boton: 'Sí, repartir de nuevo', accion: repartir }) : repartir())}>
            <Icono nombre="varita" />{turnos.length ? 'Repartir de nuevo' : 'Repartir turnos'}
          </button>
        )}
        <p className="guia">
          Las zonas del colegio que se acompañan en los descansos. La app reparte los turnos entre los docentes que ese día están en el colegio,
          en proporción a su espacio libre: quien tiene menos horas de clase acompaña más. Nadie cuida dos zonas a la vez.
        </p>
      </header>

      <section className="panel" aria-labelledby="titulo-zonas">
        <div className="fila">
          <h3 id="titulo-zonas">Zonas</h3>
          <span className="fila empuja">
            {zonas.length === 0 && (
              // Sin zonas, lo que conviene primero es partir de las comunes: esa es la acción principal.
              <button className="boton chico primario" onClick={() => conAcompanamiento((a) => ({ ...a, zonas: COMUNES.map(([n, algida]) => ({ ...zonaNueva(nuevoId(), n), ...(algida ? { algida } : {}) })) }))}>
                Agregar zonas comunes
              </button>
            )}
            <button className={`boton chico ${zonas.length ? 'primario' : ''}`} onClick={() => conAcompanamiento((a) => ({ ...a, zonas: [...a.zonas, zonaNueva(nuevoId(), `Zona ${a.zonas.length + 1}`)] }))}>
              <Icono nombre="mas" tamano={18} />Agregar zona
            </button>
          </span>
        </div>
        {zonas.length === 0 ? (
          <p className="suave">Todavía no hay zonas. «Agregar zonas comunes» pone patio, cancha, baños, tienda escolar y pasillos; luego las cambias como quieras.</p>
        ) : (
          <div className="tabla-caja">
            <table className="datos">
              <thead>
                <tr>
                  <th>Zona</th><th className="num">Docentes por turno</th><th>Descansos</th>{dosJornadas && <th>Jornada</th>}
                  <th title="Quien la cuida un día no la repite el día anterior ni el siguiente">Álgida</th>
                  <th title="Solo estos dos docentes la cuidan durante el ciclo">Pareja fija</th><th />
                </tr>
              </thead>
              <tbody>
                {zonas.map((z) => (
                  <tr key={z.id}>
                    <td><input type="text" style={{ minWidth: '12rem' }} aria-label="Nombre de la zona" value={z.nombre} onChange={(ev) => zonaCon(z.id, { nombre: ev.target.value })} /></td>
                    <td className="num">
                      <input type="number" min={1} max={4} style={{ width: '4em' }} aria-label={`Docentes por turno en ${z.nombre}`} value={z.personas}
                        onChange={(ev) => zonaCon(z.id, { personas: Math.min(4, Math.max(1, Math.round(Number(ev.target.value) || 1))) })} />
                    </td>
                    <td>
                      <span className="fila" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        {([1, 2] as Descanso[]).map((k) => (
                          <label key={k} className="marca" style={{ margin: 0, gap: 6 }}>
                            <input
                              type="checkbox" aria-label={`${z.nombre} en el ${k === 1 ? 'primer' : 'segundo'} descanso`} checked={z.descansos.includes(k)}
                              onChange={(ev) => zonaCon(z.id, { descansos: ev.target.checked ? [...z.descansos, k].sort() as Descanso[] : z.descansos.filter((x) => x !== k) })}
                            />
                            {k === 1 ? '1.º' : '2.º'}
                          </label>
                        ))}
                      </span>
                    </td>
                    {dosJornadas && (
                      <td>
                        <select aria-label={`Jornada de ${z.nombre}`} value={z.jornada} onChange={(ev) => zonaCon(z.id, { jornada: ev.target.value as Jornada, pareja: undefined })}>
                          <option value="manana">Mañana</option><option value="tarde">Tarde</option>
                        </select>
                      </td>
                    )}
                    <td className="num"><input type="checkbox" aria-label={`${z.nombre} es álgida`} checked={!!z.algida} onChange={(ev) => zonaCon(z.id, { algida: ev.target.checked || undefined })} /></td>
                    <td>
                      <span className="fila" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {[0, 1].map((n) => (
                          <select
                            key={n} aria-label={`Pareja de ${z.nombre}, docente ${n + 1}`} style={{ maxWidth: 170 }}
                            value={z.pareja?.[n] ?? ''}
                            onChange={(ev) => {
                              // Se guarda cada docente al elegirlo; la pareja cuenta cuando están los dos.
                              const otro = z.pareja?.[1 - n] ?? ''
                              const par: [Id, Id] = n === 0 ? [ev.target.value, otro] : [otro, ev.target.value]
                              zonaCon(z.id, { pareja: par[0] || par[1] ? par : undefined })
                              if (ev.target.value && !otro) avisar('Elige también el segundo docente de la pareja.')
                              if (par[0] && par[0] === par[1]) avisar('La pareja tiene que ser de dos docentes distintos.')
                            }}
                          >
                            <option value="">{n === 0 ? 'Sin pareja' : '—'}</option>
                            {estado.docentes.filter((d) => !d.externo && dictaEn(d, z.jornada)).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                          </select>
                        ))}
                      </span>
                    </td>
                    <td>
                      <button className="boton chico icono peligro" aria-label={`Borrar la zona ${z.nombre}`} title="Borrar"
                        onClick={() => conAcompanamiento((a) => ({ zonas: a.zonas.filter((x) => x.id !== z.id), turnos: a.turnos.filter((t) => t.zonaId !== z.id) }))}>
                        <Icono nombre="borrar" tamano={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="suave">
          <b>Álgida:</b> una zona difícil; quien la cuida un día no la repite el día anterior ni el siguiente. <b>Pareja fija:</b> solo esos dos docentes
          la cuidan durante el ciclo; con 1 docente por turno se turnan en proporción a su espacio libre, y con 2 van juntos.
        </p>
      </section>

      {zonas.length > 0 && estado.clases.length === 0 && (
        <Vacio titulo="Primero genera el horario">
          <p>Los turnos se reparten entre los docentes que cada día tienen clase, así que hace falta el horario.</p>
          <button className="boton primario" onClick={() => alIr('horario')}>Ir al horario<Icono nombre="flecha" /></button>
        </Vacio>
      )}

      {turnos.length > 0 && (
        <section className="panel" aria-labelledby="titulo-turnos">
          <h3 id="titulo-turnos">Turnos</h3>
          {desactualizado(estado) && <Aviso tipo="info">Cambiaste las zonas o sus descansos: toca «Repartir de nuevo» para actualizar los turnos.</Aviso>}
          {avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
          <p className="suave">Puedes cambiar a mano quién acompaña cada turno; la app avisa si algo no cuadra.</p>
          {jornadas.map((j) => (
            <div key={j} className="pila" style={{ gap: 6 }}>
              {jornadas.length > 1 && <h4 style={{ margin: 0 }}>{j === 'manana' ? 'Jornada de la mañana' : 'Jornada de la tarde'}</h4>}
              {tablaTurnos(j, true)}
            </div>
          ))}
        </section>
      )}

      {turnos.length > 0 && (
        <section className="panel" aria-labelledby="titulo-carga-acompanamiento">
          <h3 id="titulo-carga-acompanamiento">Turnos por docente</h3>
          <p className="suave">«Le tocarían» es lo proporcional a su espacio libre en el colegio (franjas disponibles menos sus clases).</p>
          <div className="tabla-caja">
            <table className="datos">
              <thead><tr><th>Docente</th><th className="num">Horas de clase</th><th className="num">Turnos</th><th className="num">Le tocarían</th></tr></thead>
              <tbody>
                {cargaAcompanamiento(estado).sort((a, b) => nombre(a.docenteId).localeCompare(nombre(b.docenteId))).map((c) => (
                  <tr key={c.docenteId}>
                    <td>{nombre(c.docenteId)}</td>
                    <td className="num">{c.horas}</td>
                    <td className="num"><span className={`ficha ${Math.abs(c.turnos - c.proporcional) > 1.5 ? 'aviso-ficha' : 'bien'}`}>{c.turnos}</span></td>
                    <td className="num">{c.proporcional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {imprimiendo && createPortal(
        <div className="solo-impresion">
          {jornadas.map((j) => (
            <section key={j} className="hoja">
              <div className="hoja-cabeza">
                <h2>Acompañamiento en descansos{jornadas.length > 1 ? ` · ${j === 'manana' ? 'mañana' : 'tarde'}` : ''}</h2>
                <span className="colegio">{estado.colegio.nombre}</span>
              </div>
              {tablaTurnos(j, false)}
            </section>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
