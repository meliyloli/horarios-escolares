import { eliminarArea, unirAreas } from '../../dominio/edicion'
import { esMediaTecnica, MAX_SEMANA, nivelDeGrado, nuevoId } from '../../dominio/tiempo'
import type { Area } from '../../dominio/tipos'
import { colorDeArea, PALETA_AREAS } from '../colores'
import { aNumero, Icono, Vacio } from '../componentes'
import { useEstado } from '../estado'
import { Importar } from '../Importar'
import { IntensidadDesdeAsignacion } from '../IntensidadDesdeAsignacion'
import { useState } from 'react'

const GRADOS = Array.from({ length: 11 }, (_, i) => i + 1)

export function Areas() {
  const { estado, cambiar, confirmar } = useEstado()
  const [importando, setImportando] = useState(false)
  const [leyendoIntensidad, setLeyendoIntensidad] = useState(false)
  const { areas, intensidad } = estado
  const areaCon = (id: string, c: Partial<Area>) => cambiar((e) => ({ ...e, areas: e.areas.map((a) => (a.id === id ? { ...a, ...c } : a)) }))
  const agregar = () =>
    cambiar((e) => {
      const usados = new Set(e.areas.map((a) => colorDeArea(e, a.id)))
      const color = PALETA_AREAS.find((c) => !usados.has(c)) ?? PALETA_AREAS[e.areas.length % PALETA_AREAS.length]
      return { ...e, areas: [...e.areas, { id: nuevoId(), nombre: 'Área nueva', afines: [], color }] }
    })
  const horasCon = (grado: number, areaId: string, horas: number) =>
    cambiar((e) => ({ ...e, intensidad: { ...e.intensidad, [grado]: { ...e.intensidad[grado], [areaId]: horas } } }))
  // La media técnica no cuenta en el máximo semanal: se suma aparte.
  const total = (grado: number) => areas.reduce((s, a) => s + (esMediaTecnica(estado, a.id) ? 0 : intensidad[grado]?.[a.id] ?? 0), 0)
  const tecnica = (grado: number) => areas.reduce((s, a) => s + (esMediaTecnica(estado, a.id) ? intensidad[grado]?.[a.id] ?? 0 : 0), 0)

  return (
    <>
      <header className="cabecera">
        <h2>Áreas e intensidad horaria</h2>
        {!leyendoIntensidad && estado.asignaciones.length > 0 && <button className="boton" onClick={() => setLeyendoIntensidad(true)}>Leer intensidad desde la asignación</button>}
        {!importando && <button className="boton" onClick={() => setImportando(true)}><Icono nombre="subir" />Importar Word o PDF</button>}
        <button className="boton primario" onClick={agregar}><Icono nombre="mas" />Agregar área</button>
        <p className="guia">Las áreas del plan del colegio, cuáles son afines entre sí y cuántas horas por semana tiene cada una en cada grado.</p>
      </header>
      {importando && <Importar alCerrar={() => setImportando(false)} />}
      {leyendoIntensidad && <IntensidadDesdeAsignacion alCerrar={() => setLeyendoIntensidad(false)} />}

      {areas.length === 0 ? (
        <Vacio titulo="Todavía no hay áreas">
          <p>Agrega las áreas del colegio (Matemáticas, Lengua Castellana, Inglés…). Luego podrás decir cuáles son afines y cuántas horas tiene cada una.</p>
        </Vacio>
      ) : (
        <>
          <section className="pila">
            <h3>Áreas y áreas afines</h3>
            <p className="suave">Un docente puede completar su carga en las áreas afines a la suya cuando no hay horas suficientes en su área.</p>
            <div className="tabla-caja">
              <table className="datos">
                <thead>
                  <tr><th>Color</th><th>Área</th><th title="Sus horas no cuentan en el máximo de 30 horas por semana del grupo">Media técnica</th><th>Áreas afines: lo que puede dictar un docente nombrado en esta área</th><th>Unir con</th><th /></tr>
                </thead>
                <tbody>
                  {areas.map((a) => {
                    const disponibles = areas.filter((x) => x.id !== a.id && !a.afines.includes(x.id))
                    return (
                      <tr key={a.id}>
                        <td><input type="color" aria-label={`Color de ${a.nombre}`} value={colorDeArea(estado, a.id)} onChange={(ev) => areaCon(a.id, { color: ev.target.value })} /></td>
                        <td><input type="text" aria-label="Nombre del área" value={a.nombre} onChange={(ev) => areaCon(a.id, { nombre: ev.target.value })} /></td>
                        <td className="num">
                          <input type="checkbox" aria-label={`${a.nombre} es media técnica`} checked={esMediaTecnica(estado, a.id)} onChange={(ev) => areaCon(a.id, { mediaTecnica: ev.target.checked })} />
                        </td>
                        <td>
                          <div className="fila">
                            {a.afines.map((id) => (
                              <span key={id} className="ficha">
                                <span className="muestra" style={{ background: colorDeArea(estado, id) }} />
                                {areas.find((x) => x.id === id)?.nombre}
                                <button aria-label={`Quitar ${areas.find((x) => x.id === id)?.nombre} de las afines de ${a.nombre}`} onClick={() => areaCon(a.id, { afines: a.afines.filter((x) => x !== id) })}>
                                  <Icono nombre="cerrar" tamano={14} />
                                </button>
                              </span>
                            ))}
                            {disponibles.length > 0 && (
                              <select aria-label={`Agregar área afín a ${a.nombre}`} value="" onChange={(ev) => ev.target.value && areaCon(a.id, { afines: [...a.afines, ev.target.value] })} style={{ minHeight: 34 }}>
                                <option value="">Agregar afín…</option>
                                {disponibles.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                              </select>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            aria-label={`Unir ${a.nombre} con otra área`} value="" style={{ minHeight: 34, maxWidth: 170 }}
                            title="Si esta área es en realidad otra con distinto nombre, únela: todo lo suyo pasa a la otra"
                            onChange={(ev) => {
                              const destino = areas.find((x) => x.id === ev.target.value)
                              if (!destino) return
                              confirmar({
                                titulo: `¿Unir ${a.nombre} con ${destino.nombre}?`,
                                mensaje: `Las horas, la intensidad, los docentes y las clases de ${a.nombre} pasan a ${destino.nombre}, y el área ${a.nombre} desaparece. Se puede deshacer.`,
                                boton: 'Sí, unir', accion: () => cambiar((e) => unirAreas(e, a.id, destino.id)),
                              })
                            }}
                          >
                            <option value="">Unir con…</option>
                            {areas.filter((x) => x.id !== a.id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                          </select>
                        </td>
                        <td>
                          <button
                            className="boton chico icono peligro" aria-label={`Borrar el área ${a.nombre}`}
                            onClick={() =>
                              confirmar({
                                titulo: `¿Borrar ${a.nombre}?`,
                                mensaje: 'Se borra también de la intensidad horaria, de la asignación y del horario. Los docentes nombrados en esta área quedan sin área.',
                                boton: 'Sí, borrar', peligro: true, accion: () => cambiar((e) => eliminarArea(e, a.id)),
                              })
                            }
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
          </section>

          <section className="pila">
            <h3>Intensidad horaria: horas por semana en cada grado</h3>
            <p className="suave">
              La app comprueba que cada grupo reciba exactamente estas horas. El total por semana no puede pasar de 25 en primaria ni de 30 en bachillerato; las áreas
              marcadas como media técnica no cuentan en ese máximo y se suman aparte («+6 MT»). En ciclo de 10 días se cuentan dobles y se aceptan medias horas
              (1,5 por semana son 3 en el ciclo).
            </p>
            <div className="tabla-caja">
              <table className="datos">
                <thead>
                  <tr>
                    <th>Área</th>
                    {GRADOS.map((g) => <th key={g} className="num">{g}.º</th>)}
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.id}>
                      <td><span className="fila" style={{ flexWrap: 'nowrap' }}><span className="muestra" style={{ background: colorDeArea(estado, a.id) }} />{a.nombre}</span></td>
                      {GRADOS.map((g) => (
                        <td key={g} className="num">
                          <input
                            type="number" min={0} max={30} step={0.5} style={{ width: '4.2em' }} aria-label={`Horas de ${a.nombre} en grado ${g}`}
                            value={intensidad[g]?.[a.id] ?? 0} onChange={(ev) => horasCon(g, a.id, aNumero(ev.target.value))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total por semana</td>
                    {GRADOS.map((g) => (
                      <td key={g} className="num">
                        <span className={`ficha ${total(g) > MAX_SEMANA[nivelDeGrado(g)] ? 'error' : ''}`} title={total(g) > MAX_SEMANA[nivelDeGrado(g)] ? `Pasa del máximo de ${MAX_SEMANA[nivelDeGrado(g)]} horas por semana en ${nivelDeGrado(g)}` : undefined}>{total(g)}</span>
                        {tecnica(g) > 0 && <span className="suave" style={{ display: 'block', fontSize: '0.8125rem' }} title="Media técnica: no cuenta en el máximo">+{tecnica(g)} MT</span>}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
