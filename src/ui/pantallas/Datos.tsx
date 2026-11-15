import { useState } from 'react'
import { esTitular, horasDocente, horasSemanaGrupo } from '../../dominio/asignacion'
import { cambiarCicloGrupo, eliminarAula, eliminarDocente, eliminarGrupo, unirDocentes } from '../../dominio/edicion'
import { cargaEnCiclo, claveDocente, dictaEn, diasHorario, esMediaTecnica, tieneMediaTecnica, FRANJAS, franjasDisponibles, jornadasDe, MAX_SEMANA, nivelDeGrado, nombreDia, nombreGrupo, nuevoId } from '../../dominio/tiempo'
import type { Aula, Ciclo, Docente, Grupo, Jornada } from '../../dominio/tipos'
import { colorDeArea } from '../colores'
import { aNumero, Campo, Icono, Pestanas, Vacio } from '../componentes'
import { useEstado } from '../estado'

type Pestana = 'grupos' | 'docentes' | 'aulas'
const FRANJAS_LISTA = Array.from({ length: FRANJAS }, (_, i) => i + 1)

export function Datos() {
  const { estado } = useEstado()
  const [pestana, setPestana] = useState<Pestana>('grupos')
  return (
    <>
      <header className="cabecera">
        <h2>Grupos, docentes y aulas</h2>
        <p className="guia">Lo que tiene el colegio. Todo se puede agregar, cambiar y borrar aquí; al borrar algo, la app quita también lo que dependía de eso.</p>
      </header>
      <Pestanas
        etiqueta="Qué editar" valor={pestana} alCambiar={setPestana}
        opciones={[['grupos', `Grupos (${estado.grupos.filter((g) => !g.de).length})`], ['docentes', `Docentes (${estado.docentes.length})`], ['aulas', `Aulas (${estado.aulas.length})`]]}
      />
      {pestana === 'grupos' && <Grupos />}
      {pestana === 'docentes' && <Docentes />}
      {pestana === 'aulas' && <Aulas />}
    </>
  )
}

function Grupos() {
  const { estado, cambiar, confirmar } = useEstado()
  // Los grupos mezclados de media técnica se arman en su propio apartado.
  const grupos = estado.grupos.filter((g) => !g.de).sort((a, b) => a.grado - b.grado || a.numero - b.numero)
  const grupoCon = (id: string, c: Partial<Grupo>) => cambiar((e) => ({ ...e, grupos: e.grupos.map((g) => (g.id === id ? { ...g, ...c } : g)) }))
  const agregar = () =>
    cambiar((e) => {
      const ultimo = [...e.grupos].sort((a, b) => a.grado - b.grado || a.numero - b.numero).at(-1)
      const grado = ultimo?.grado ?? 6
      const numero = Math.max(0, ...e.grupos.filter((g) => g.grado === grado).map((g) => g.numero)) + 1
      return { ...e, grupos: [...e.grupos, { id: nuevoId(), grado, numero, jornada: ultimo?.jornada ?? 'manana' }] }
    })
  const cicloCon = (g: Grupo, ciclo: Ciclo | undefined) => {
    const aplicar = () => cambiar((e) => cambiarCicloGrupo(e, g.id, ciclo))
    if (!estado.clases.length) return aplicar()
    confirmar({
      titulo: `¿Cambiar el ciclo de ${nombreGrupo(g)}?`, mensaje: 'Sus horas en la asignación se duplican o se dividen entre dos, y habrá que generar el horario de nuevo.',
      boton: 'Sí, cambiar el ciclo', accion: aplicar,
    })
  }
  const sinAula = grupos.filter((g) => !g.aulaId)
  const crearAulas = () =>
    cambiar((e) => {
      const aulas = [...e.aulas]
      const grupos = e.grupos.map((g) => {
        if (g.aulaId || g.de) return g
        const aula: Aula = { id: nuevoId(), nombre: `Aula ${nombreGrupo(g)}` }
        aulas.push(aula)
        return { ...g, aulaId: aula.id }
      })
      return { ...e, aulas, grupos }
    })

  return (
    <>
      <div className="fila">
        <button className="boton primario" onClick={agregar}><Icono nombre="mas" />Agregar grupo</button>
        {sinAula.length > 0 && (estado.colegio.modeloAula === 'grupo' || estado.colegio.modeloAula === 'mixto') && (
          <button className="boton" onClick={crearAulas}><Icono nombre="varita" />Crear un aula para cada grupo sin aula ({sinAula.length})</button>
        )}
      </div>
      {grupos.length === 0 ? (
        <Vacio titulo="Todavía no hay grupos">
          <p>Agrega los grupos del colegio, por ejemplo 6-1, 6-2 y 7-1. Primaria son los grados 1 a 5 y bachillerato los grados 6 a 11.</p>
        </Vacio>
      ) : (
        <div className="tabla-caja">
          <table className="datos">
            <thead><tr><th>Grupo</th><th>Grado</th><th>Número</th><th>Jornada</th><th>Ciclo</th>{estado.colegio.modeloAula !== 'ninguna' && <th>Aula del grupo</th>}<th className="num" title="Horas asignadas a docentes por semana / máximo">Horas por semana</th><th /></tr></thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td><b>{nombreGrupo(g)}</b> <span className="suave">{nivelDeGrado(g.grado)}</span></td>
                  <td>
                    <select aria-label={`Grado del grupo ${nombreGrupo(g)}`} value={g.grado} onChange={(ev) => grupoCon(g.id, { grado: Number(ev.target.value) })}>
                      {Array.from({ length: 11 }, (_, i) => <option key={i} value={i + 1}>{i + 1}.º</option>)}
                    </select>
                  </td>
                  <td><input type="number" min={1} max={20} aria-label={`Número del grupo ${nombreGrupo(g)}`} value={g.numero} onChange={(ev) => grupoCon(g.id, { numero: Math.max(1, Math.round(aNumero(ev.target.value))) })} /></td>
                  <td>
                    <select aria-label={`Jornada del grupo ${nombreGrupo(g)}`} value={g.jornada} onChange={(ev) => grupoCon(g.id, { jornada: ev.target.value as Jornada })}>
                      <option value="manana">Mañana</option><option value="tarde">Tarde</option>
                    </select>
                  </td>
                  <td>
                    <select aria-label={`Ciclo del grupo ${nombreGrupo(g)}`} value={g.ciclo ?? ''} onChange={(ev) => cicloCon(g, ev.target.value ? (Number(ev.target.value) as Ciclo) : undefined)}>
                      <option value="">El del colegio ({estado.colegio.ciclo} días)</option><option value="5">5 días</option><option value="10">10 días</option>
                    </select>
                  </td>
                  {estado.colegio.modeloAula !== 'ninguna' && <td>
                    <select aria-label={`Aula del grupo ${nombreGrupo(g)}`} value={g.aulaId ?? ''} onChange={(ev) => grupoCon(g.id, { aulaId: ev.target.value || undefined })}>
                      <option value="">Sin aula</option>
                      {estado.aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </td>}
                  <td className="num">
                    {(() => {
                      const { cuentan: semana, mediaTecnica } = horasSemanaGrupo(estado, g)
                      const maximo = MAX_SEMANA[nivelDeGrado(g.grado)]
                      return (
                        <>
                          <span className={`ficha ${semana > maximo ? 'error' : semana === maximo ? 'bien' : ''}`} title={semana > maximo ? `Pasa del máximo de ${maximo} horas por semana` : undefined}>{semana}/{maximo}</span>
                          {mediaTecnica > 0 && <span className="suave" style={{ marginLeft: 6 }} title="Media técnica: no cuenta en el máximo">+{mediaTecnica} MT</span>}
                        </>
                      )
                    })()}
                  </td>
                  <td>
                    <button
                      className="boton chico icono peligro" aria-label={`Borrar el grupo ${nombreGrupo(g)}`}
                      onClick={() =>
                        confirmar({
                          titulo: `¿Borrar el grupo ${nombreGrupo(g)}?`,
                          mensaje: 'Se borran también sus horas en la asignación académica y sus clases en el horario.',
                          boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarGrupo(e, g.id)),
                        })
                      }
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
    </>
  )
}

function Aulas() {
  const { estado, cambiar, confirmar } = useEstado()
  const aulaCon = (id: string, c: Partial<Aula>) => cambiar((e) => ({ ...e, aulas: e.aulas.map((a) => (a.id === id ? { ...a, ...c } : a)) }))
  const uso = (id: string) =>
    [...estado.grupos.filter((g) => g.aulaId === id).map((g) => `grupo ${nombreGrupo(g)}`), ...estado.docentes.filter((d) => d.aulaId === id).map((d) => d.nombre)].join(', ')
  return (
    <>
      <div className="fila">
        <button className="boton primario" onClick={() => cambiar((e) => ({ ...e, aulas: [...e.aulas, { id: nuevoId(), nombre: `Aula ${e.aulas.length + 1}` }] }))}>
          <Icono nombre="mas" />Agregar aula
        </button>
      </div>
      {estado.aulas.length === 0 ? (
        <Vacio titulo="Todavía no hay aulas"><p>Agrega las aulas del colegio. Cada clase del horario lleva una.</p></Vacio>
      ) : (
        <div className="tabla-caja">
          <table className="datos">
            <thead><tr><th>Nombre</th><th>Capacidad (opcional)</th><th>Quién la tiene asignada</th><th /></tr></thead>
            <tbody>
              {estado.aulas.map((a) => (
                <tr key={a.id}>
                  <td><input type="text" aria-label="Nombre del aula" value={a.nombre} onChange={(ev) => aulaCon(a.id, { nombre: ev.target.value })} /></td>
                  <td><input type="number" min={0} aria-label={`Capacidad de ${a.nombre}`} value={a.capacidad ?? ''} onChange={(ev) => aulaCon(a.id, { capacidad: aNumero(ev.target.value) || undefined })} /></td>
                  <td className="suave">{uso(a.id) || 'Nadie todavía'}</td>
                  <td>
                    <button
                      className="boton chico icono peligro" aria-label={`Borrar ${a.nombre}`}
                      onClick={() =>
                        confirmar({
                          titulo: `¿Borrar ${a.nombre}?`, mensaje: 'Los grupos, docentes y clases que la usaban quedan sin aula.',
                          boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarAula(e, a.id)),
                        })
                      }
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
    </>
  )
}

function Docentes() {
  const { estado, cambiar, confirmar } = useEstado()
  const [elegido, setElegido] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [unirCon, setUnirCon] = useState('')
  const dias = diasHorario(estado)
  const docente = estado.docentes.find((d) => d.id === elegido)
  const docenteCon = (c: Partial<Docente>) => cambiar((e) => ({ ...e, docentes: e.docentes.map((d) => (d.id === elegido ? { ...d, ...c } : d)) }))
  const agregar = () => {
    const id = nuevoId()
    cambiar((e) => ({
      ...e,
      docentes: [...e.docentes, { id, nombre: 'Docente nuevo', areaId: e.areas[0]?.id ?? '', nivel: 'bachillerato', jornada: 'manana', cargaSemanal: 22, noDisponible: [] }],
    }))
    setElegido(id)
  }
  /** Marca como no disponibles las franjas que cumplan la condición, sin quitar las que ya estaban. */
  const dosJornadas = docente?.jornada === 'ambas'
  const bloquear = (cual: (dia: number, franja: number) => boolean, j: Jornada) => {
    if (!docente) return
    const nuevas = diasLista(dias).flatMap((dia) => FRANJAS_LISTA.filter((f) => cual(dia, f)).map((f) => claveDocente(docente, dia, f, j)))
    docenteCon({ noDisponible: [...new Set([...docente.noDisponible, ...nuevas])] })
  }
  const visibles = estado.docentes.filter((d) => d.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <div className="maestro">
      <div className="pila">
        <div className="fila">
          <button className="boton primario" onClick={agregar}><Icono nombre="mas" />Agregar docente</button>
        </div>
        {estado.docentes.length > 6 && (
          <input type="search" placeholder="Buscar por nombre" aria-label="Buscar docente" value={busqueda} onChange={(ev) => setBusqueda(ev.target.value)} />
        )}
        {estado.docentes.length === 0 ? (
          <Vacio titulo="Todavía no hay docentes"><p>Agrega cada docente con su área de nombramiento, nivel, jornada y carga.</p></Vacio>
        ) : (
          <div className="panel lista-alta" style={{ padding: 8 }}>
            <div className="lista">
              {visibles.map((d) => {
                const horas = horasDocente(estado, d.id).total
                const carga = cargaEnCiclo(d, dias)
                return (
                  <button key={d.id} aria-current={d.id === elegido} onClick={() => { setElegido(d.id); setUnirCon('') }}>
                    <span className="muestra" style={{ background: esTitular(d) ? 'var(--linea-fuerte)' : colorDeArea(estado, d.areaId) }} />
                    <span style={{ minWidth: 0 }}>
                      {d.nombre}
                      <span className="detalle">{d.externo ? 'Instructor externo · media técnica' : esTitular(d) ? 'Titular de primaria' : `${estado.areas.find((a) => a.id === d.areaId)?.nombre ?? 'Sin área'} · ${d.nivel}`}</span>
                      {d.noDisponible.length > 0 && <span className="ficha" style={{ marginTop: 3 }} title="Tiene franjas en las que no puede dictar">Horario limitado</span>}
                    </span>
                    {d.externo ? <span className="ficha empuja" title="Horas de media técnica asignadas">{horas} h</span> : <span className={`ficha empuja ${horas === carga ? 'bien' : 'aviso-ficha'}`} title="Horas asignadas de su carga">{horas}/{carga}</span>}
                  </button>
                )
              })}
              {visibles.length === 0 && <p className="suave" style={{ padding: 10 }}>Ningún docente coincide con «{busqueda}».</p>}
            </div>
          </div>
        )}
      </div>

      {!docente ? (
        estado.docentes.length > 0 && <Vacio titulo="Elige un docente"><p>Toca un nombre de la lista para ver y cambiar sus datos y su disponibilidad.</p></Vacio>
      ) : (
        <section className="panel">
          <div className="fila">
            <h3>{docente.nombre}</h3>
            <button
              className="boton chico peligro empuja"
              onClick={() =>
                confirmar({
                  titulo: `¿Borrar a ${docente.nombre}?`, mensaje: 'Se borran también su asignación académica, sus clases en el horario y sus ausencias y reemplazos.',
                  boton: 'Sí, borrar', peligro: true,
                  accion: () => {
                    cambiar((e) => eliminarDocente(e, docente.id))
                    setElegido(null)
                  },
                })
              }
            >
              <Icono nombre="borrar" tamano={18} />Borrar docente
            </button>
          </div>
          <div className="rejilla-campos">
            <Campo etiqueta="Nombre"><input type="text" value={docente.nombre} onChange={(ev) => docenteCon({ nombre: ev.target.value })} /></Campo>
            {(docente.externo || tieneMediaTecnica(estado)) && (
              <Campo etiqueta="Tipo" ayuda={docente.externo ? 'Dicta media técnica. No tiene carga de 22 horas ni acompaña descansos.' : undefined}>
                <select value={docente.externo ? 'externo' : 'planta'} onChange={(ev) => docenteCon(ev.target.value === 'externo' ? { externo: true, jornada: 'ambas', cargaSemanal: 0, horasExtra: undefined, direccionGrupoId: undefined } : { externo: undefined, cargaSemanal: 22 })}>
                  <option value="planta">Docente de planta</option><option value="externo">Instructor externo (media técnica)</option>
                </select>
              </Campo>
            )}
            {!esTitular(docente) && !docente.externo && (
              <Campo etiqueta="Área de nombramiento">
                <select value={docente.areaId} onChange={(ev) => docenteCon({ areaId: ev.target.value })}>
                  {!estado.areas.some((a) => a.id === docente.areaId) && <option value="">Sin área: elige una</option>}
                  {estado.areas.filter((a) => a.id === docente.areaId || !esMediaTecnica(estado, a.id)).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Campo>
            )}
            {!docente.externo && <Campo etiqueta="Nivel">
              <select
                value={docente.nivel}
                onChange={(ev) => {
                  const nivel = ev.target.value as Docente['nivel']
                  docenteCon({ nivel, cargaSemanal: nivel === 'primaria' ? 25 : 22, rolPrimaria: nivel === 'primaria' ? 'titular' : undefined })
                }}
              >
                <option value="bachillerato">Bachillerato</option><option value="primaria">Primaria</option>
              </select>
            </Campo>}
            {docente.nivel === 'primaria' && !docente.externo && (
              <Campo etiqueta="Rol en primaria" ayuda="El titular dicta casi todo a su grupo; el especialista dicta un área a varios grupos.">
                <select value={docente.rolPrimaria ?? 'titular'} onChange={(ev) => docenteCon({ rolPrimaria: ev.target.value as Docente['rolPrimaria'] })}>
                  <option value="titular">Titular</option><option value="especialista">Especialista</option>
                </select>
              </Campo>
            )}
            <Campo etiqueta="Jornada">
              <select
                value={docente.jornada}
                onChange={(ev) => {
                  const jornada = ev.target.value as Docente['jornada']
                  // Al dejar de dictar en la tarde, su disponibilidad de la tarde ya no aplica.
                  docenteCon({ jornada, noDisponible: jornada === 'ambas' ? docente.noDisponible : docente.noDisponible.filter((k) => !k.endsWith('-t')) })
                }}
              >
                <option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="ambas">Mañana y tarde (horario intermedio)</option>
              </select>
            </Campo>
            {!docente.externo && <>
            <Campo etiqueta="Carga por semana" ayuda={dias === 10 ? `En el ciclo de 10 días son ${docente.cargaSemanal * 2} horas.` : '22 en bachillerato y 25 en primaria.'}>
              <input type="number" min={0} max={30} value={docente.cargaSemanal} onChange={(ev) => docenteCon({ cargaSemanal: aNumero(ev.target.value) })} />
            </Campo>
            <Campo etiqueta="Horas extra por semana" ayuda="Adicionales a su carga. Sin horas extra, la regla de 22 (o 25) horas se mantiene.">
              <input type="number" min={0} max={8} value={docente.horasExtra ?? 0} onChange={(ev) => docenteCon({ horasExtra: aNumero(ev.target.value) || undefined })} />
            </Campo>
            <Campo etiqueta="Dirección de grupo" ayuda="No suma horas. Sirve para decidir con qué grupos completa su carga.">
              <select value={docente.direccionGrupoId ?? ''} onChange={(ev) => docenteCon({ direccionGrupoId: ev.target.value || undefined })}>
                <option value="">Ninguna</option>
                {estado.grupos.filter((g) => !g.de && dictaEn(docente, g.jornada)).map((g) => <option key={g.id} value={g.id}>{nombreGrupo(g)}</option>)}
              </select>
            </Campo>
            </>}
            {estado.colegio.modeloAula !== 'grupo' && estado.colegio.modeloAula !== 'ninguna' && (
              <Campo etiqueta="Aula fija" ayuda="Si la tiene, los grupos van a su aula.">
                <select value={docente.aulaId ?? ''} onChange={(ev) => docenteCon({ aulaId: ev.target.value || undefined })}>
                  <option value="">No tiene aula fija</option>
                  {estado.aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Campo>
            )}
          </div>

          <section className="subpanel" aria-labelledby="titulo-disponibilidad">
            <h4 id="titulo-disponibilidad">Disponibilidad</h4>
            <p>Disponible en {franjasDisponibles(docente, dias).reduce((n, x) => n + x, 0)} de {dias * FRANJAS * jornadasDe(docente).length} franjas.</p>
            <p className="suave">Marca cuándo no puede dictar clase: desde o hasta cierta franja, días completos o franjas sueltas. El generador y los reemplazos nunca lo ponen ahí.</p>
            <div className="fila">
              <Campo etiqueta={dosJornadas ? 'Entra desde la franja (mañana)' : 'Entra desde la franja'}>
                <select value="" onChange={(ev) => ev.target.value && bloquear((_, f) => f < Number(ev.target.value), jornadasDe(docente)[0])}>
                  <option value="">Elegir…</option>
                  {FRANJAS_LISTA.slice(1).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Campo>
              <Campo etiqueta={dosJornadas ? 'Sale después de la franja (tarde)' : 'Sale después de la franja'}>
                <select value="" onChange={(ev) => ev.target.value && bloquear((_, f) => f > Number(ev.target.value), jornadasDe(docente).at(-1)!)}>
                  <option value="">Elegir…</option>
                  {FRANJAS_LISTA.slice(0, -1).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Campo>
              {docente.noDisponible.length > 0 && (
                <button className="boton chico" style={{ alignSelf: 'flex-end' }} onClick={() => docenteCon({ noDisponible: [] })}>Dejarlo disponible siempre</button>
              )}
            </div>
            <fieldset className="fila" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, padding: 0, marginBottom: 4 }}>Días que no viene</legend>
              {diasLista(dias).map((dia) => {
                const delDia = jornadasDe(docente).flatMap((j) => FRANJAS_LISTA.map((f) => claveDocente(docente, dia, f, j)))
                const todo = delDia.every((k) => docente.noDisponible.includes(k))
                return (
                  <label key={dia} className="marca" style={{ gap: 6, fontWeight: 500 }}>
                    <input
                      type="checkbox" aria-label={`No viene el ${nombreDia(dia, dias).toLowerCase()}`} checked={todo}
                      onChange={() => docenteCon({ noDisponible: todo ? docente.noDisponible.filter((k) => !delDia.includes(k)) : [...new Set([...docente.noDisponible, ...delDia])] })}
                    />
                    {nombreDia(dia, dias)}
                  </label>
                )
              })}
            </fieldset>
            {jornadasDe(docente).map((j) => (
              <div key={j} className="pila" style={{ gap: 6 }}>
                {dosJornadas && <h5 style={{ margin: 0 }}>{j === 'manana' ? 'Mañana' : 'Tarde'}</h5>}
                <div style={{ overflowX: 'auto' }}>
                  <table className="disponibilidad">
                    <thead>
                      <tr><th>Franja</th>{diasLista(dias).map((dia) => <th key={dia}>{nombreDia(dia, dias)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {FRANJAS_LISTA.map((f) => (
                        <tr key={f}>
                          <th>{f}</th>
                          {diasLista(dias).map((dia) => {
                            const k = claveDocente(docente, dia, f, j)
                            const bloqueada = docente.noDisponible.includes(k)
                            const donde = `${nombreDia(dia, dias)}, franja ${f}${dosJornadas ? (j === 'tarde' ? ' de la tarde' : ' de la mañana') : ''}`
                            return (
                              <td key={dia}>
                                <button
                                  aria-pressed={bloqueada} aria-label={`${bloqueada ? 'No disponible' : 'Disponible'}: ${donde}`}
                                  title={bloqueada ? 'No disponible' : 'Disponible'}
                                  onClick={() => docenteCon({ noDisponible: bloqueada ? docente.noDisponible.filter((x) => x !== k) : [...docente.noDisponible, k] })}
                                >
                                  <Icono nombre={bloqueada ? 'cerrar' : 'bien'} tamano={16} />
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
          <section className="subpanel">
          <div className="fila" style={{ alignItems: 'flex-end' }}>
            <Campo etiqueta="Unir con otro docente" ayuda="Si es la misma persona escrita con otro nombre: sus horas y clases pasan al docente que elijas, que conserva su nombre y su carga.">
              <select value={unirCon} onChange={(ev) => setUnirCon(ev.target.value)}>
                <option value="">Elige un docente…</option>
                {estado.docentes.filter((d) => d.id !== docente.id).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </Campo>
            <button
              className="boton chico" disabled={!unirCon}
              onClick={() => {
                const destino = estado.docentes.find((d) => d.id === unirCon)
                if (!destino) return
                confirmar({
                  titulo: `¿Unir a ${docente.nombre} con ${destino.nombre}?`,
                  mensaje: `Las horas, las clases y las ausencias de «${docente.nombre}» pasan a «${destino.nombre}», que conserva su nombre, carga y disponibilidad. «${docente.nombre}» se borra. Se puede deshacer.`,
                  boton: 'Sí, unir',
                  accion: () => {
                    cambiar((e) => unirDocentes(e, docente.id, destino.id))
                    setElegido(destino.id)
                    setUnirCon('')
                  },
                })
              }}
            >
              Unir
            </button>
          </div>
          </section>
        </section>
      )}
    </div>
  )
}

const diasLista = (dias: number) => Array.from({ length: dias }, (_, i) => i + 1)
