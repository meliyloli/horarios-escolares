import { useState } from 'react'
import { esTitular, horasDocente, horasRequeridas, horasSinAsignar, sugerirParaDocente, validarAsignacion, type Sugerencia, horasSemanaGrupo, intensidadSemanaGrado } from '../../dominio/asignacion'
import { cargaEnCiclo, dictaEn, jornadaDeAsignacion, diasHorario, MAX_SEMANA, nivelDeGrado, nombreGrupo, nuevoId } from '../../dominio/tiempo'
import type { Asignacion as Fila, Docente, Jornada } from '../../dominio/tipos'
import { colorDeArea } from '../colores'
import { aNumero, Aviso, CampoNumero, Icono, Pestanas, Renombrar, Vacio } from '../componentes'
import { useEstado } from '../estado'
import { Borradores } from '../Borradores'
import { Repetidos } from '../Repetidos'
import { Importar } from '../Importar'
import { IntensidadDesdeAsignacion, sinIntensidad } from '../IntensidadDesdeAsignacion'

const MOTIVO: Record<Sugerencia['motivo'], string> = {
  areaGrupoPropio: 'Su área, en un grupo donde ya dicta',
  areaDireccion: 'Su área, en su dirección de grupo',
  areaNivel: 'Su área, en otro grupo de su nivel',
  afinGrupoPropio: 'Área afín, en un grupo donde ya dicta',
  afinDireccion: 'Área afín, en su dirección de grupo',
  afinNivel: 'Área afín, en otro grupo de su nivel',
}

export function Asignacion() {
  const { estado } = useEstado()
  const [vista, setVista] = useState<'docente' | 'grupo'>('docente')
  const [importando, setImportando] = useState(false)
  const [leyendoIntensidad, setLeyendoIntensidad] = useState(false)
  const materiasSinIntensidad = sinIntensidad(estado)
  const avisos = validarAsignacion(estado)
  const errores = avisos.filter((a) => a.gravedad === 'error')
  const excepciones = avisos.length - errores.length

  return (
    <>
      <header className="cabecera">
        <h2>Asignación académica</h2>
        {!leyendoIntensidad && estado.asignaciones.length > 0 && materiasSinIntensidad === 0 && <button className="boton" onClick={() => setLeyendoIntensidad(true)}>Leer intensidad desde la asignación</button>}
        {!importando && <button className="boton" onClick={() => setImportando(true)}><Icono nombre="subir" />Importar Word o PDF</button>}
        <p className="guia">Quién dicta qué: las horas de cada área que cada docente da a cada grupo. La app revisa la carga, el mínimo en el área de nombramiento y que cada grupo reciba sus horas.</p>
      </header>
      {(estado.asignaciones.length > 0 || (estado.borradores?.length ?? 0) > 0) && <Borradores />}
      <Repetidos />
      {importando && <Importar alCerrar={() => setImportando(false)} />}
      {leyendoIntensidad && <IntensidadDesdeAsignacion alCerrar={() => setLeyendoIntensidad(false)} />}
      {!leyendoIntensidad && materiasSinIntensidad > 0 && (
        <Aviso acciones={<button className="boton chico" onClick={() => setLeyendoIntensidad(true)}>Leer intensidad desde la asignación</button>}>
          {materiasSinIntensidad === 1 ? '1 materia tiene' : `${materiasSinIntensidad} materias tienen`} horas asignadas pero su intensidad horaria está en 0, así que aparecen como si sobraran horas.
          La app puede tomar la intensidad de lo asignado.
        </Aviso>
      )}
      {estado.docentes.length === 0 || estado.grupos.length === 0 ? (
        !importando && (
          <Vacio titulo="Primero agrega docentes y grupos">
            <p>La asignación reparte las horas de los grupos entre los docentes. Agrégalos en «Grupos, docentes y aulas», o importa un Word o PDF que ya los tenga.</p>
            <button className="boton primario" onClick={() => setImportando(true)}><Icono nombre="subir" />Importar Word o PDF</button>
          </Vacio>
        )
      ) : (
        <>
          {errores.length === 0 ? (
            <Aviso tipo="bien">
              <b>La asignación está completa y cumple las reglas.</b>
              {excepciones > 0 && ` Hay ${excepciones} ${excepciones === 1 ? 'excepción marcada' : 'excepciones marcadas'} de nivel.`} Ya puedes generar el horario.
            </Aviso>
          ) : (
            <Aviso><b>Hay {errores.length} {errores.length === 1 ? 'aviso' : 'avisos'} por resolver.</b> Se puede generar el horario así, pero quedará con cargas o grupos incompletos.</Aviso>
          )}
          <Pestanas etiqueta="Cómo ver la asignación" valor={vista} alCambiar={setVista} opciones={[['docente', 'Por docente'], ['grupo', 'Por grupo']]} />
          {vista === 'docente' ? <PorDocente /> : <PorGrupo />}
        </>
      )}
    </>
  )
}

function PorDocente() {
  const { estado, cambiar, confirmar, avisar } = useEstado()
  const [elegido, setElegido] = useState<string | null>(null)
  /** Fila para agregar una materia o un grupo nuevo al docente elegido ('' = lo que se propone). */
  const [nueva, setNueva] = useState<{ areaId: string; grupoId: string; horas: string; jornada?: Jornada }>({ areaId: '', grupoId: '', horas: '' })
  const [renombrando, setRenombrando] = useState(false)
  const dias = diasHorario(estado)
  const avisos = validarAsignacion(estado)
  const docente = estado.docentes.find((d) => d.id === elegido)

  return (
    <div className="maestro">
      <div className="panel lista-alta" style={{ padding: 8 }}>
        <div className="lista">
          {estado.docentes.map((d) => {
            const horas = horasDocente(estado, d.id).total
            const carga = cargaEnCiclo(d, dias)
            const pendientes = avisos.filter((a) => a.docenteId === d.id && a.gravedad === 'error').length
            return (
              <button key={d.id} aria-current={d.id === elegido} onClick={() => { setElegido(d.id); setNueva({ areaId: '', grupoId: '', horas: '' }); setRenombrando(false) }}>
                <span className="muestra" style={{ background: esTitular(d) ? 'var(--linea-fuerte)' : colorDeArea(estado, d.areaId) }} />
                <span style={{ minWidth: 0 }}>
                  {d.nombre}
                  <span className="detalle">{esTitular(d) ? 'Titular de primaria' : estado.areas.find((a) => a.id === d.areaId)?.nombre ?? 'Sin área'}</span>
                </span>
                <span className={`ficha empuja ${pendientes ? 'error' : horas === carga ? 'bien' : 'aviso-ficha'}`}>{horas}/{carga}</span>
              </button>
            )
          })}
        </div>
      </div>
      {docente ? fichaDocente(docente) : <Vacio titulo="Elige un docente"><p>Toca un nombre para ver y cambiar sus horas. El número de la derecha es su carga: asignadas / total.</p></Vacio>}
    </div>
  )

  // Función y no componente: así los campos no se desmontan (ni pierden el foco) en cada cambio.
  function fichaDocente(docente: Docente) {
    const h = horasDocente(estado, docente.id)
    const carga = cargaEnCiclo(docente, dias)
    const minimo = (estado.colegio.reglas.minimoAreaNombramiento * dias) / 5
    const filas = estado.asignaciones.filter((a) => a.docenteId === docente.id)
    const suyos = avisos.filter((a) => a.docenteId === docente.id)
    const sugerencias = sugerirParaDocente(estado, docente.id)
    // Los grupos que puede recibir en esa materia: depende de la jornada en que se dicta (la media técnica va en la otra jornada del grupo).
    const gruposPara = (areaId: string) =>
      estado.grupos.filter((g) => dictaEn(docente, jornadaDeAsignacion(estado, { grupoId: g.id, areaId }))).sort((a, b) => a.grado - b.grado || a.numero - b.numero)
    const nombreArea = (id: string) => estado.areas.find((a) => a.id === id)?.nombre ?? 'Área borrada'
    const grupo = (id: string) => estado.grupos.find((g) => g.id === id)
    const filaCon = (id: string, c: Partial<Fila>) => cambiar((e) => ({ ...e, asignaciones: e.asignaciones.map((a) => (a.id === id ? { ...a, ...c } : a)) }))
    // En horario intermedio, la misma materia en el mismo grupo puede ir una parte en la mañana y otra en la tarde.
    const intermedio = docente.jornada === 'ambas'
    const jornadaDeFila = (a: Pick<Fila, 'grupoId' | 'areaId' | 'jornada'>) => jornadaDeAsignacion(estado, a)
    const agregar = (s: Pick<Fila, 'grupoId' | 'areaId' | 'horas' | 'jornada'>[]) =>
      cambiar((e) => {
        const asignaciones = [...e.asignaciones]
        for (const n of s) {
          const i = asignaciones.findIndex((a) => a.docenteId === docente.id && a.grupoId === n.grupoId && a.areaId === n.areaId && jornadaDeFila(a) === jornadaDeFila(n))
          if (i >= 0) asignaciones[i] = { ...asignaciones[i], horas: asignaciones[i].horas + n.horas }
          else asignaciones.push({ id: nuevoId(), docenteId: docente.id, ...n })
        }
        return { ...e, asignaciones }
      })
    const quitarFila = (a: Fila) => {
      const quitar = () => cambiar((e) => ({ ...e, asignaciones: e.asignaciones.filter((x) => x.id !== a.id) }))
      const clases = estado.clases.filter((c) => c.asignacionId === a.id).length
      if (clases === 0) return quitar()
      confirmar({
        titulo: '¿Quitar estas horas?',
        mensaje: `Con ellas ${clases === 1 ? 'también se quita su clase del horario' : `también se quitan sus ${clases} clases del horario`}.`,
        boton: 'Sí, quitar', peligro: true, accion: quitar,
      })
    }
    // Lo propuesto en la fila de agregar: su área y el primer grupo de su nivel donde aún no la dicta.
    const areaNueva = nueva.areaId || (estado.areas.some((a) => a.id === docente.areaId) ? docente.areaId : estado.areas[0]?.id ?? '')
    const gruposPosibles = gruposPara(areaNueva)
    const delNivel = gruposPosibles.filter((g) => nivelDeGrado(g.grado) === docente.nivel)
    const grupoNuevo = nueva.grupoId || ((delNivel.length ? delNivel : gruposPosibles).find((g) => !filas.some((a) => a.grupoId === g.id && a.areaId === areaNueva)) ?? gruposPosibles[0])?.id || ''
    const gNuevo = grupo(grupoNuevo)
    const faltan = gNuevo ? Math.max(0, horasRequeridas(estado, gNuevo, areaNueva) - estado.asignaciones.filter((a) => a.grupoId === grupoNuevo && a.areaId === areaNueva).reduce((n, a) => n + a.horas, 0)) : 0
    const horasNuevas = nueva.horas === '' ? faltan || 1 : Math.min(60, Math.round(aNumero(nueva.horas)))
    const agregarNueva = () => {
      if (!areaNueva || !grupoNuevo || horasNuevas <= 0) return
      const porDefecto = jornadaDeAsignacion(estado, { grupoId: grupoNuevo, areaId: areaNueva })
      const jornadaNueva = intermedio && nueva.jornada && nueva.jornada !== porDefecto ? nueva.jornada : undefined
      const ya = filas.find((a) => a.grupoId === grupoNuevo && a.areaId === areaNueva && jornadaDeFila(a) === jornadaDeFila({ grupoId: grupoNuevo, areaId: areaNueva, jornada: jornadaNueva }))
      agregar([{ grupoId: grupoNuevo, areaId: areaNueva, horas: horasNuevas, jornada: jornadaNueva }])
      if (ya) avisar(`${docente.nombre} ya dictaba ${nombreArea(areaNueva)} en ${nombreGrupo(gNuevo!)}: ahora son ${ya.horas + horasNuevas} horas.`)
      setNueva({ areaId: '', grupoId: '', horas: '' })
    }

    return (
      <section className="panel">
        {renombrando ? (
          <Renombrar
            inicial={docente.nombre} alCancelar={() => setRenombrando(false)}
            alGuardar={(nombre) => {
              cambiar((e) => ({ ...e, docentes: e.docentes.map((d) => (d.id === docente.id ? { ...d, nombre } : d)) }))
              setRenombrando(false)
            }}
          />
        ) : (
          <div className="fila">
            <h3>{docente.nombre}</h3>
            <button className="boton chico" onClick={() => setRenombrando(true)}>Cambiar nombre</button>
          </div>
        )}
        <div className="fila">
          <span className={`ficha ${h.total === carga ? 'bien' : 'aviso-ficha'}`}>Carga: {h.total} de {carga}</span>
          {!esTitular(docente) && <span className={`ficha ${h.enArea >= minimo ? 'bien' : 'error'}`}>En su área: {h.enArea} (mínimo {minimo})</span>}
          {!esTitular(docente) && h.enAfines > 0 && <span className="ficha">En áreas afines: {h.enAfines}</span>}
          {!esTitular(docente) && h.otras > 0 && <span className="ficha error">En otras áreas: {h.otras}</span>}
          {!!docente.horasExtra && <span className="ficha">Incluye {(docente.horasExtra * dias) / 5} horas extra</span>}
          {intermedio && (['manana', 'tarde'] as const).map((j) => (
            <span key={j} className="ficha">{j === 'manana' ? 'En la mañana' : 'En la tarde'}: {filas.filter((a) => jornadaDeFila(a) === j).reduce((n, a) => n + a.horas, 0)} h</span>
          ))}
        </div>
        {suyos.map((a) => <Aviso key={a.mensaje} tipo={a.gravedad === 'error' ? 'aviso' : 'info'}>{a.mensaje}</Aviso>)}

        <div className="tabla-caja">
            <table className="datos">
              <thead><tr><th>Área</th><th>Grupo</th>{intermedio && <th>Jornada</th>}<th className="num">Horas</th><th /></tr></thead>
              <tbody>
                {filas.length === 0 && <tr><td colSpan={4} className="suave">Todavía no tiene horas asignadas. Agrégalas abajo, en «Agregar materia o grupo».</td></tr>}
                {filas.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="fila" style={{ flexWrap: 'nowrap' }}>
                        <span className="muestra" style={{ background: colorDeArea(estado, a.areaId) }} />
                        <select aria-label="Área" value={a.areaId} onChange={(ev) => filaCon(a.id, { areaId: ev.target.value })}>
                          {estado.areas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                        </select>
                      </span>
                    </td>
                    <td>
                      <select aria-label="Grupo" value={a.grupoId} onChange={(ev) => filaCon(a.id, { grupoId: ev.target.value })}>
                        {!gruposPara(a.areaId).some((g) => g.id === a.grupoId) && grupo(a.grupoId) && <option value={a.grupoId}>{nombreGrupo(grupo(a.grupoId)!)} (otra jornada)</option>}
                        {gruposPara(a.areaId).map((g) => <option key={g.id} value={g.id}>{nombreGrupo(g)}</option>)}
                      </select>
                    </td>
                    {intermedio && (
                      <td>
                        <select
                          aria-label={`Jornada de ${nombreArea(a.areaId)} en ${grupo(a.grupoId) ? nombreGrupo(grupo(a.grupoId)!) : 'el grupo'}`} value={jornadaDeFila(a)}
                          onChange={(ev) => filaCon(a.id, { jornada: ev.target.value === jornadaDeAsignacion(estado, { ...a, jornada: undefined }) ? undefined : (ev.target.value as Jornada) })}
                        >
                          <option value="manana">Mañana</option><option value="tarde">Tarde</option>
                        </select>
                      </td>
                    )}
                    <td className="num">
                      <CampoNumero
                        min={0} max={60} aria-label={`Horas de ${nombreArea(a.areaId)} en ${grupo(a.grupoId) ? nombreGrupo(grupo(a.grupoId)!) : 'el grupo'}`}
                        valor={a.horas} alConfirmar={(n) => filaCon(a.id, { horas: Math.min(60, Math.round(n)) })}
                      />
                    </td>
                    <td>
                      <button className="boton chico icono peligro" aria-label={`Quitar ${nombreArea(a.areaId)} en ${grupo(a.grupoId) ? nombreGrupo(grupo(a.grupoId)!) : 'el grupo'}`} onClick={() => quitarFila(a)}>
                        <Icono nombre="borrar" tamano={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


        {sugerencias.length > 0 && (
          <>
            <div className="fila">
              <h4>Sugerencias para completar su carga</h4>
              {sugerencias.length > 1 && <button className="boton chico empuja" onClick={() => agregar(sugerencias)}>Agregar todas</button>}
            </div>
            <p className="suave">Son horas que todavía no tienen docente, de la más a la menos adecuada para {docente.nombre.split(' ')[0]}.</p>
            {sugerencias.map((s) => {
              const g = grupo(s.grupoId)!
              return (
                <div key={`${s.grupoId}/${s.areaId}`} className="aviso info">
                  <span className="muestra" style={{ background: colorDeArea(estado, s.areaId), marginTop: 5 }} />
                  <div><b>{s.horas} {s.horas === 1 ? 'hora' : 'horas'} de {nombreArea(s.areaId)} en {nombreGrupo(g)}</b><br /><span className="suave">{MOTIVO[s.motivo]}</span></div>
                  <div className="acciones">
                    <button className="boton chico" aria-label={`Agregar ${s.horas} horas de ${nombreArea(s.areaId)} en ${nombreGrupo(g)}`} onClick={() => agregar([s])}>Agregar</button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        <section className="subpanel" aria-labelledby="titulo-agregar">
          <h4 id="titulo-agregar">Agregar materia o grupo</h4>
          <p className="suave">Elige el área, el grupo y las horas. Las horas propuestas son las que aún le faltan a ese grupo en esa área.</p>
          <div className="fila" style={{ alignItems: 'flex-end' }}>
            <label className="campo">
              Área
              <select aria-label="Área nueva" value={areaNueva} onChange={(ev) => setNueva({ ...nueva, areaId: ev.target.value, horas: '' })}>
                {estado.areas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </label>
            <label className="campo">
              Grupo
              <select aria-label="Grupo nuevo" value={grupoNuevo} onChange={(ev) => setNueva({ ...nueva, grupoId: ev.target.value, horas: '' })}>
                {gruposPosibles.map((g) => <option key={g.id} value={g.id}>{nombreGrupo(g)}</option>)}
              </select>
            </label>
            {intermedio && (
              <label className="campo">
                Jornada
                <select aria-label="Jornada nueva" value={nueva.jornada ?? jornadaDeAsignacion(estado, { grupoId: grupoNuevo, areaId: areaNueva })} onChange={(ev) => setNueva({ ...nueva, jornada: ev.target.value as Jornada })}>
                  <option value="manana">Mañana</option><option value="tarde">Tarde</option>
                </select>
              </label>
            )}
            <label className="campo">
              Horas
              <input type="number" min={1} max={60} aria-label="Horas nuevas" value={nueva.horas === '' ? horasNuevas : nueva.horas} onChange={(ev) => setNueva({ ...nueva, horas: ev.target.value })} />
            </label>
            <button className="boton primario" disabled={!areaNueva || !grupoNuevo || horasNuevas <= 0} onClick={agregarNueva}><Icono nombre="mas" />Agregar</button>
          </div>
        </section>
      </section>
    )
  }
}

function PorGrupo() {
  const { estado, cambiar, avisar } = useEstado()
  const grupos = [...estado.grupos].sort((a, b) => a.grado - b.grado || a.numero - b.numero)
  const avisos = validarAsignacion(estado)
  const dias = diasHorario(estado)
  const pendientes = horasSinAsignar(estado)
  const faltan = pendientes.reduce((s, p) => s + p.horas, 0)
  const conProblemas = (id: string) => avisos.filter((a) => a.grupoId === id && a.gravedad === 'error').length
  const [elegido, setElegido] = useState<string | null>(() => grupos.find((g) => conProblemas(g.id))?.id ?? grupos[0]?.id ?? null)
  /** Docente elegido para asignar las horas que faltan, por área. */
  const [para, setPara] = useState<Record<string, string>>({})
  const grupo = grupos.find((g) => g.id === elegido)
  const nombreDocente = (id: string) => estado.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  const generales = avisos.filter((a) => a.tipo === 'excesoIntensidad')

  return (
    <>
      {faltan > 0
        ? <Aviso>Faltan <b>{faltan} horas</b> por asignar en {new Set(pendientes.map((p) => p.grupoId)).size} grupos.</Aviso>
        : <Aviso tipo="bien">Ningún grupo tiene horas sin docente.</Aviso>}
      {generales.map((a) => <Aviso key={a.mensaje} tipo="error">{a.mensaje}</Aviso>)}
      <div className="maestro">
        <div className="panel lista-alta" style={{ padding: 8 }}>
          <div className="lista">
            {grupos.map((g) => {
              const total = horasSemanaGrupo(estado, g).cuentan
              const maximo = MAX_SEMANA[nivelDeGrado(g.grado)]
              const problemas = conProblemas(g.id)
              return (
                <button key={g.id} aria-current={g.id === elegido} onClick={() => setElegido(g.id)}>
                  <span style={{ minWidth: 0 }}>
                    {nombreGrupo(g)}
                    <span className="detalle">{problemas ? `${problemas} ${problemas === 1 ? 'aviso' : 'avisos'}` : 'Sin avisos'}</span>
                  </span>
                  <span className={`ficha empuja ${total > maximo || problemas ? 'error' : total === maximo ? 'bien' : 'aviso-ficha'}`} title="Horas asignadas por semana / máximo">{total}/{maximo}</span>
                </button>
              )
            })}
          </div>
        </div>
        {!grupo ? (
          <Vacio titulo="Todavía no hay grupos"><p>Agrégalos en «Grupos, docentes y aulas».</p></Vacio>
        ) : (
          (() => {
            const suyas = estado.asignaciones.filter((a) => a.grupoId === grupo.id)
            const maximo = MAX_SEMANA[nivelDeGrado(grupo.grado)]
            // La media técnica no cuenta en el máximo semanal: va aparte.
            const { cuentan: asignadasSemana, mediaTecnica } = horasSemanaGrupo(estado, grupo)
            const { cuentan: intensidadSemana, mediaTecnica: intensidadTecnica } = intensidadSemanaGrado(estado, grupo.grado)
            const areas = estado.areas.filter((a) => horasRequeridas(estado, grupo, a.id) > 0 || suyas.some((x) => x.areaId === a.id))
            const candidatos = (areaId: string) =>
              estado.docentes
                .filter((d) => dictaEn(d, jornadaDeAsignacion(estado, { grupoId: grupo.id, areaId })))
                .map((d) => {
                  const propia = d.areaId === areaId || esTitular(d)
                  const afin = estado.areas.find((x) => x.id === d.areaId)?.afines.includes(areaId) ?? false
                  return { d, orden: propia ? 0 : afin ? 1 : 2, libres: cargaEnCiclo(d, dias) - horasDocente(estado, d.id).total, etiqueta: propia ? 'su área' : afin ? 'área afín' : 'otra área' }
                })
                .sort((x, y) => x.orden - y.orden || y.libres - x.libres)
            const conFaltantes = areas.some((a) => horasRequeridas(estado, grupo, a.id) > suyas.filter((x) => x.areaId === a.id).reduce((n, x) => n + x.horas, 0))
            const asignar = (areaId: string, docenteId: string, horas: number) => {
              cambiar((e) => {
                const ya = e.asignaciones.find((a) => a.docenteId === docenteId && a.grupoId === grupo.id && a.areaId === areaId)
                return {
                  ...e,
                  asignaciones: ya
                    ? e.asignaciones.map((a) => (a.id === ya.id ? { ...a, horas: a.horas + horas } : a))
                    : [...e.asignaciones, { id: nuevoId(), docenteId, grupoId: grupo.id, areaId, horas }],
                }
              })
              avisar(`Asignadas ${horas} horas a ${nombreDocente(docenteId)} en ${nombreGrupo(grupo)}.`)
              setPara((p) => ({ ...p, [areaId]: '' }))
            }
            return (
              <section className="panel">
                <h3>Grupo {nombreGrupo(grupo)}</h3>
                <div className="fila">
                  <span className={`ficha ${asignadasSemana > maximo ? 'error' : 'bien'}`}>Asignadas: {asignadasSemana} horas por semana (máximo {maximo})</span>
                  <span className={`ficha ${intensidadSemana > maximo ? 'error' : ''}`}>Intensidad de {grupo.grado}.°: {intensidadSemana} horas por semana</span>
                  {(mediaTecnica > 0 || intensidadTecnica > 0) && <span className="ficha">Media técnica, aparte: {mediaTecnica} de {intensidadTecnica} horas</span>}
                </div>
                {avisos.filter((a) => a.grupoId === grupo.id && a.tipo !== 'intensidad').map((a) => <Aviso key={a.mensaje} tipo={a.gravedad === 'error' ? 'aviso' : 'info'}>{a.mensaje}</Aviso>)}
                {areas.length === 0 ? (
                  <p className="suave">El grado {grupo.grado}.° no tiene intensidad horaria ni asignación. Llénala en «Áreas e intensidad».</p>
                ) : (
                  <div className="tabla-caja">
                    <table className="datos">
                      <thead><tr><th>Área</th><th className="num">Intensidad</th><th>Docentes</th><th>Estado</th>{conFaltantes && <th>Asignar lo que falta</th>}</tr></thead>
                      <tbody>
                        {areas.map((a) => {
                          const requeridas = horasRequeridas(estado, grupo, a.id)
                          const quienes = suyas.filter((x) => x.areaId === a.id && x.horas > 0)
                          const asignadas = quienes.reduce((s, x) => s + x.horas, 0)
                          const diferencia = requeridas - asignadas
                          const elegidoAqui = para[a.id] ?? ''
                          return (
                            <tr key={a.id}>
                              <td><span className="fila" style={{ flexWrap: 'nowrap' }}><span className="muestra" style={{ background: colorDeArea(estado, a.id) }} />{a.nombre}</span></td>
                              <td className="num">{requeridas} h</td>
                              <td style={{ minWidth: 170 }}>
                                {quienes.length === 0
                                  ? <span className="suave">Sin docente</span>
                                  : <span className="pila" style={{ gap: 2 }}>{quienes.map((x) => <span key={x.id}>{nombreDocente(x.docenteId)} · {x.horas} h</span>)}</span>}
                              </td>
                              <td>
                                <span className="fila" style={{ gap: 4 }}>
                                  {diferencia === 0 ? <span className="ficha bien">Completa</span>
                                    : diferencia > 0 ? <span className="ficha aviso-ficha">Faltan {diferencia}</span>
                                    : <span className="ficha error">Sobran {-diferencia}</span>}
                                  {quienes.length > 1 && <span className="ficha">Compartida</span>}
                                </span>
                              </td>
                              {conFaltantes && <td>
                                {diferencia > 0 && (
                                  <span className="fila" style={{ flexWrap: 'nowrap' }}>
                                    <select style={{ maxWidth: 200 }} aria-label={`Docente para ${a.nombre} en ${nombreGrupo(grupo)}`} value={elegidoAqui} onChange={(ev) => setPara((p) => ({ ...p, [a.id]: ev.target.value }))}>
                                      <option value="">Elegir docente…</option>
                                      {candidatos(a.id).map(({ d, etiqueta, libres }) => (
                                        <option key={d.id} value={d.id}>{d.nombre} · {etiqueta} · {libres > 0 ? `le faltan ${libres} h` : 'carga completa'}</option>
                                      ))}
                                    </select>
                                    <button className="boton chico" disabled={!elegidoAqui} onClick={() => asignar(a.id, elegidoAqui, diferencia)}>Asignar {diferencia} h</button>
                                  </span>
                                )}
                              </td>}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })()
        )}
      </div>
    </>
  )
}
