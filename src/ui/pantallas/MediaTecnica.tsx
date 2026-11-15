import { useState } from 'react'
import { horasDocente, horasRequeridas } from '../../dominio/asignacion'
import { eliminarArea, eliminarDocente, eliminarGrupo } from '../../dominio/edicion'
import { asignarMediaTecnica, elegirPrograma, grupoMezcladoNuevo, horasPrograma, programasMT } from '../../dominio/mediaTecnica'
import { cargaEnCiclo, diasHorario, jornadaDeAsignacion, nombreGrupo, nuevoId, tieneMediaTecnica } from '../../dominio/tiempo'
import type { Grupo, Id, Jornada } from '../../dominio/tipos'
import type { Pantalla } from '../App'
import { colorDeArea, PALETA_AREAS } from '../colores'
import { aNumero, Aviso, Icono, Vacio } from '../componentes'
import { useEstado } from '../estado'

const GRADOS_MT = [10, 11]
const JORNADA: Record<Jornada, string> = { manana: 'mañana', tarde: 'tarde' }

export function MediaTecnica({ alIr }: { alIr: (p: Pantalla) => void }) {
  const { estado, cambiar, confirmar } = useEstado()
  const [instructor, setInstructor] = useState('')
  const programas = programasMT(estado)
  const dias = diasHorario(estado)
  const regulares = estado.grupos.filter((g) => !g.de && GRADOS_MT.includes(g.grado)).sort((a, b) => a.grado - b.grado || a.numero - b.numero)
  const mezclados = estado.grupos.filter((g) => g.de)
  const conPrograma = [...regulares.filter((g) => g.programaMT), ...mezclados.filter((g) => g.programaMT)]
  const planta = estado.docentes.filter((d) => !d.externo).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const externos = estado.docentes.filter((d) => d.externo)
  const nombrePrograma = (id?: Id) => programas.find((p) => p.id === id)?.nombre ?? 'Sin programa'
  const grupoCon = (id: Id, c: Partial<Grupo>) => cambiar((e) => ({ ...e, grupos: e.grupos.map((g) => (g.id === id ? { ...g, ...c } : g)) }))

  const agregarPrograma = () =>
    cambiar((e) => {
      const usados = new Set(e.areas.map((a) => colorDeArea(e, a.id)))
      const color = PALETA_AREAS.find((c) => !usados.has(c)) ?? PALETA_AREAS[e.areas.length % PALETA_AREAS.length]
      const id = nuevoId()
      return {
        ...e,
        colegio: { ...e.colegio, mediaTecnica: true },
        areas: [...e.areas, { id, nombre: programasMT(e).length ? 'Programa nuevo' : 'Media técnica', afines: [], color, mediaTecnica: true }],
        intensidad: Object.fromEntries([...new Set([...Object.keys(e.intensidad), ...GRADOS_MT.map(String)])].map((g) => [g, { ...e.intensidad[Number(g)], ...(GRADOS_MT.includes(Number(g)) ? { [id]: 6 } : {}) }])),
      }
    })
  const agregarInstructor = () => {
    const nombre = instructor.trim()
    if (!nombre) return
    cambiar((e) => ({
      ...e,
      docentes: [...e.docentes, { id: nuevoId(), nombre, areaId: programas[0]?.id ?? '', nivel: 'bachillerato', jornada: 'ambas', cargaSemanal: 0, noDisponible: [], externo: true }],
    }))
    setInstructor('')
  }

  if (!tieneMediaTecnica(estado))
    return (
      <>
        <header className="cabecera"><h2>Media técnica</h2></header>
        <Vacio titulo="Este colegio no tiene media técnica">
          <p>La media técnica es opcional. Si tu colegio la tiene, actívala para armar sus programas aparte del plan de estudios.</p>
          <button className="boton primario" onClick={() => cambiar((e) => ({ ...e, colegio: { ...e.colegio, mediaTecnica: true } }))}>Sí, este colegio tiene media técnica</button>
        </Vacio>
      </>
    )

  return (
    <>
      <header className="cabecera">
        <h2>Media técnica</h2>
        <button className="boton primario" onClick={agregarPrograma}><Icono nombre="mas" />Agregar programa</button>
        <p className="guia">
          Programas propios del colegio, por fuera del plan de estudios. Se dictan en la jornada contraria, no cuentan en las 30 horas por semana y no tienen
          máximo de horas por día. Cada docente de media técnica atiende un solo grupo por día.
        </p>
      </header>

      <section className="panel" aria-labelledby="titulo-programas">
        <h3 id="titulo-programas">1. Programas</h3>
        {programas.length === 0 ? (
          <p className="suave">Agrega el primer programa, por ejemplo Sistemas, Contabilidad o Agropecuaria.</p>
        ) : (
          <div className="tabla-caja">
            <table className="datos">
              <thead><tr><th>Programa</th>{GRADOS_MT.map((g) => <th key={g} className="num">Horas por semana en {g}.°</th>)}<th /></tr></thead>
              <tbody>
                {programas.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="fila" style={{ flexWrap: 'nowrap' }}>
                        <span className="muestra" style={{ background: colorDeArea(estado, p.id) }} />
                        <input type="text" aria-label="Nombre del programa" value={p.nombre} onChange={(ev) => cambiar((e) => ({ ...e, areas: e.areas.map((a) => (a.id === p.id ? { ...a, nombre: ev.target.value } : a)) }))} />
                      </span>
                    </td>
                    {GRADOS_MT.map((g) => (
                      <td key={g} className="num">
                        <input
                          type="number" min={0} max={30} style={{ width: '4.2em' }} aria-label={`Horas de ${p.nombre} en ${g}.°`}
                          value={estado.intensidad[g]?.[p.id] ?? 0} onChange={(ev) => cambiar((e) => horasPrograma(e, p.id, g, aNumero(ev.target.value)))}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="boton chico icono peligro" aria-label={`Borrar el programa ${p.nombre}`}
                        onClick={() => confirmar({
                          titulo: `¿Borrar ${p.nombre}?`, mensaje: 'Se borran también sus grupos mezclados, lo asignado y sus clases. Se puede deshacer.',
                          boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarArea(e, p.id)),
                        })}
                      >
                        <Icono nombre="borrar" tamano={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {programas.length > 0 && (
        <section className="panel" aria-labelledby="titulo-quien-ve">
          <h3 id="titulo-quien-ve">2. Qué grupos la ven</h3>
          <p className="suave">
            Un grupo completo puede ver un programa. Si los estudiantes de varios grupos eligen programas distintos, deja el grupo en «No va completo» y arma abajo
            los grupos mezclados.
          </p>
          {regulares.length === 0 ? (
            <p className="suave">Todavía no hay grupos de 10.° ni de 11.°. Agrégalos en «Grupos, docentes y aulas».</p>
          ) : (
            <div className="tabla-caja">
              <table className="datos">
                <thead><tr><th>Grupo</th><th>Programa del grupo completo</th><th>Está en los grupos mezclados</th></tr></thead>
                <tbody>
                  {regulares.map((g) => {
                    const en = mezclados.filter((m) => m.de?.includes(g.id))
                    return (
                      <tr key={g.id}>
                        <td><b>{nombreGrupo(g)}</b> <span className="suave">· jornada de la {JORNADA[g.jornada]}</span></td>
                        <td>
                          <select aria-label={`Programa de ${nombreGrupo(g)}`} value={g.programaMT ?? ''} onChange={(ev) => cambiar((e) => elegirPrograma(e, g.id, ev.target.value))}>
                            <option value="">No va completo</option>
                            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </td>
                        <td>{en.length ? en.map((m) => nombreGrupo(m)).join(', ') : <span className="suave">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="fila" style={{ marginTop: 6 }}>
            <h4 style={{ margin: 0 }}>Grupos mezclados</h4>
            <button
              className="boton chico"
              onClick={() => cambiar((e) => ({ ...e, grupos: [...e.grupos, grupoMezcladoNuevo(e, programas[0].id, GRADOS_MT.find((g) => e.grupos.some((x) => x.grado === g && !x.de)) ?? 10)] }))}
            >
              <Icono nombre="mas" tamano={18} />Agregar grupo mezclado
            </button>
          </div>
          <p className="suave">Estudiantes de varios grupos que eligieron el mismo programa. Es un grupo aparte, con su propio horario en la jornada que elijas.</p>
          {mezclados.length > 0 && (
            <div className="tabla-caja">
              <table className="datos">
                <thead><tr><th>Nombre</th><th>Programa</th><th>Grado</th><th>Estudiantes de</th><th>Jornada</th>{estado.colegio.modeloAula !== 'ninguna' && <th>Aula</th>}<th /></tr></thead>
                <tbody>
                  {mezclados.map((m) => {
                    const delGrado = regulares.filter((g) => g.grado === m.grado)
                    return (
                      <tr key={m.id}>
                        <td><input type="text" aria-label="Nombre del grupo mezclado" value={m.nombre ?? ''} onChange={(ev) => grupoCon(m.id, { nombre: ev.target.value })} style={{ minWidth: '10rem' }} /></td>
                        <td>
                          <select aria-label={`Programa de ${nombreGrupo(m)}`} value={m.programaMT ?? ''} onChange={(ev) => cambiar((e) => elegirPrograma(e, m.id, ev.target.value))}>
                            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </td>
                        <td>
                          <select aria-label={`Grado de ${nombreGrupo(m)}`} value={m.grado} onChange={(ev) => {
                            const grado = Number(ev.target.value)
                            // Si el nombre era el automático («10.° Sistemas»), sigue al grado.
                            const nombre = m.nombre?.startsWith(`${m.grado}.° `) ? m.nombre.replace(`${m.grado}.° `, `${grado}.° `) : m.nombre
                            grupoCon(m.id, { grado, de: [], nombre })
                          }}>
                            {GRADOS_MT.map((g) => <option key={g} value={g}>{g}.°</option>)}
                          </select>
                        </td>
                        <td>
                          <div className="fila" style={{ gap: '4px 12px' }}>
                            {delGrado.map((g) => (
                              <label key={g.id} className="marca" style={{ margin: 0 }}>
                                <input
                                  type="checkbox" checked={!!m.de?.includes(g.id)}
                                  onChange={(ev) => grupoCon(m.id, { de: ev.target.checked ? [...(m.de ?? []), g.id] : (m.de ?? []).filter((x) => x !== g.id) })}
                                />
                                {nombreGrupo(g)}
                              </label>
                            ))}
                            {delGrado.length === 0 && <span className="suave">No hay grupos de {m.grado}.°</span>}
                          </div>
                        </td>
                        <td>
                          <select aria-label={`Jornada de ${nombreGrupo(m)}`} value={m.jornada} onChange={(ev) => grupoCon(m.id, { jornada: ev.target.value as Jornada })}>
                            <option value="manana">Mañana</option><option value="tarde">Tarde</option>
                          </select>
                        </td>
                        {estado.colegio.modeloAula !== 'ninguna' && (
                          <td>
                            <select aria-label={`Aula de ${nombreGrupo(m)}`} value={m.aulaId ?? ''} onChange={(ev) => grupoCon(m.id, { aulaId: ev.target.value || undefined })}>
                              <option value="">Sin aula</option>
                              {estado.aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </select>
                          </td>
                        )}
                        <td>
                          <button
                            className="boton chico icono peligro" aria-label={`Borrar ${nombreGrupo(m)}`}
                            onClick={() => confirmar({
                              titulo: `¿Borrar ${nombreGrupo(m)}?`, mensaje: 'Se borra también lo asignado y sus clases.',
                              boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarGrupo(e, m.id)),
                            })}
                          >
                            <Icono nombre="borrar" tamano={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {programas.length > 0 && (
        <section className="panel" aria-labelledby="titulo-quien-dicta">
          <h3 id="titulo-quien-dicta">3. Quién la dicta</h3>
          <p className="suave">
            Un docente de planta suma estas horas a su carga de 22. Si es de la otra jornada, pasa a «mañana y tarde». Un instructor externo (SENA u otra
            entidad) no tiene carga ni acompaña descansos: en su ficha de «Grupos, docentes y aulas» se marcan los días que viene.
          </p>
          {conPrograma.length === 0 ? (
            <p className="suave">Primero elige qué grupos ven cada programa.</p>
          ) : (
            <div className="tabla-caja">
              <table className="datos">
                <thead><tr><th>Grupo</th><th>Programa</th><th className="num">Horas</th><th>Jornada</th><th>Docente o instructor</th></tr></thead>
                <tbody>
                  {conPrograma.map((g) => {
                    const asignada = estado.asignaciones.find((a) => a.grupoId === g.id && a.areaId === g.programaMT)
                    const horas = horasRequeridas(estado, g, g.programaMT!)
                    const jornada = jornadaDeAsignacion(estado, { grupoId: g.id, areaId: g.programaMT! })
                    return (
                      <tr key={g.id}>
                        <td><b>{nombreGrupo(g)}</b></td>
                        <td><span className="fila" style={{ flexWrap: 'nowrap' }}><span className="muestra" style={{ background: colorDeArea(estado, g.programaMT!) }} />{nombrePrograma(g.programaMT)}</span></td>
                        <td className="num">{horas}</td>
                        <td>{JORNADA[jornada]}</td>
                        <td>
                          <select aria-label={`Quién dicta ${nombrePrograma(g.programaMT)} a ${nombreGrupo(g)}`} value={asignada?.docenteId ?? ''} onChange={(ev) => cambiar((e) => asignarMediaTecnica(e, g.id, ev.target.value))}>
                            <option value="">Sin asignar</option>
                            {externos.length > 0 && (
                              <optgroup label="Instructores externos">
                                {externos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                              </optgroup>
                            )}
                            <optgroup label="Docentes de planta">
                              {planta.map((d) => <option key={d.id} value={d.id}>{d.nombre} · {horasDocente(estado, d.id).total} de {cargaEnCiclo(d, dias)} h</option>)}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h4>Instructores externos</h4>
          <form className="fila" onSubmit={(ev) => { ev.preventDefault(); agregarInstructor() }}>
            <input type="text" aria-label="Nombre del instructor externo" placeholder="Nombre del instructor" value={instructor} onChange={(ev) => setInstructor(ev.target.value)} />
            <button className="boton" type="submit" disabled={!instructor.trim()}><Icono nombre="mas" tamano={18} />Agregar instructor</button>
          </form>
          {externos.length > 0 && (
            <ul className="pila" style={{ margin: 0, paddingLeft: 0, listStyle: 'none', gap: 6 }}>
              {externos.map((d) => (
                <li key={d.id} className="fila">
                  <b>{d.nombre}</b>
                  <span className="suave">{horasDocente(estado, d.id).total} h asignadas</span>
                  <button
                    className="boton chico icono peligro" aria-label={`Borrar a ${d.nombre}`}
                    onClick={() => confirmar({ titulo: `¿Borrar a ${d.nombre}?`, mensaje: 'Se borra también lo que tenía asignado y sus clases.', boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarDocente(e, d.id)) })}
                  >
                    <Icono nombre="borrar" tamano={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {conPrograma.length > 0 && (
        <Aviso tipo="info" acciones={<button className="boton chico" onClick={() => alIr('horario')}>Ir a Horario<Icono nombre="flecha" tamano={18} /></button>}>
          Cuando esté asignada, en <b>Horario</b> toca «Generar horario» u «Organizar la media técnica» para ubicarla sin mover lo demás.
        </Aviso>
      )}
    </>
  )
}
