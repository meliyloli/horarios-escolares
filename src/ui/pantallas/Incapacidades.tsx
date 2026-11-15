import { useState } from 'react'
import {
  ajusteDe, ajusteVacio, aplicarReorganizacion, candidatosReemplazo, diaCicloDeFecha, guardarAjuste, impactoAjuste,
  normalizarAjuste, opcionesReorganizar, puedeFaltarGrupo, registroHorasCubiertas, sesionesDelDia, type Candidato, type OpcionReorganizar,
} from '../../dominio/reemplazos'
import { diasHorario, FRANJAS, nombreDia, nombreGrupo } from '../../dominio/tiempo'
import type { AjusteDia, Id } from '../../dominio/tipos'
import type { Pantalla } from '../App'
import { colorDeArea } from '../colores'
import { Aviso, Campo, Icono, Vacio } from '../componentes'
import { useEstado } from '../estado'

const FRANJAS_LISTA = Array.from({ length: FRANJAS }, (_, i) => i + 1)
const MOTIVO: Record<Candidato['motivo'], string> = { area: 'misma área', grupo: 'dicta en el grupo', otro: 'otro docente' }
/** Hoy, o el lunes siguiente si hoy es sábado o domingo: así el formulario no arranca en un día sin clase. */
const proximoDiaDeClase = () => {
  const d = new Date()
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv')
}
const fechaLarga = (fecha: string) => {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto[0].toUpperCase() + texto.slice(1)
}

interface Props {
  alIr: (p: Pantalla) => void
  alVerDia: (fecha: string, grupoId?: Id) => void
  /** Copia de trabajo del día. Vive en la app para no perderse al cambiar de pantalla; no se guarda hasta confirmar. */
  borrador: AjusteDia | null
  alCambiarBorrador: (aj: AjusteDia | null) => void
}

export function Incapacidades({ alIr, alVerDia, borrador, alCambiarBorrador }: Props) {
  const { estado, cambiar, confirmar, avisar } = useEstado()
  // Todo cambio del día pasa por aquí: se quitan reemplazos y reorganizaciones que dejaron de valer.
  const setBorrador = (aj: AjusteDia | null) => alCambiarBorrador(aj && normalizarAjuste(estado, aj))
  const dias = diasHorario(estado)
  const [fecha, setFecha] = useState(proximoDiaDeClase)
  const [diaElegido, setDiaElegido] = useState<number | null>(null)
  const [docenteId, setDocenteId] = useState('')
  const [todoElDia, setTodoElDia] = useState(true)
  const [franjas, setFranjas] = useState<number[]>([])

  if (estado.clases.length === 0)
    return (
      <>
        <header className="cabecera"><h2>Incapacidades y reemplazos</h2></header>
        <Vacio titulo="Todavía no hay horario">
          <p>Las incapacidades se registran cuando ya hay un horario: la app mira quién quedó sin docente ese día y propone cómo cubrirlo, sin cambiar el horario base.</p>
          <button className="boton primario" onClick={() => alIr('horario')}>Ir al horario<Icono nombre="flecha" /></button>
        </Vacio>
      </>
    )

  const diaSugerido = ajusteDe(estado, fecha)?.diaCiclo ?? diaCicloDeFecha(estado, fecha)
  const diaCiclo = dias === 10 ? diaElegido ?? diaSugerido : diaSugerido
  const nombre = (id: Id) => estado.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  const grupo = (id: Id) => estado.grupos.find((g) => g.id === id)
  const nombreDe = (id: Id) => (grupo(id) ? nombreGrupo(grupo(id)!) : 'Grupo borrado')
  const area = (id: Id) => estado.areas.find((a) => a.id === id)?.nombre ?? 'Área borrada'

  const sinGuardar = (aj: AjusteDia) => JSON.stringify(ajusteDe(estado, aj.fecha) ?? ajusteVacio(aj.fecha, aj.diaCiclo)) !== JSON.stringify(aj)
  /** Abre otro día; si el actual tiene cambios sin guardar, pregunta antes de dejarlo. */
  const abrirDia = (nuevo: AjusteDia) => {
    if (!borrador || borrador.fecha === nuevo.fecha || !sinGuardar(borrador)) return setBorrador(nuevo)
    confirmar({
      titulo: '¿Dejar este día sin guardar?', mensaje: `El ${fechaLarga(borrador.fecha).toLowerCase()} tiene cambios sin guardar y se perderían.`,
      boton: 'Sí, descartar esos cambios', peligro: true, accion: () => setBorrador(nuevo),
    })
  }
  const registrar = () => {
    if (!docenteId || !diaCiclo) return
    const base = borrador?.fecha === fecha ? borrador : ajusteDe(estado, fecha) ?? ajusteVacio(fecha, diaCiclo)
    const nuevas = todoElDia ? FRANJAS_LISTA : franjas
    if (nuevas.length === 0) return avisar('Marca al menos una franja o «Todo el día».')
    abrirDia({ ...base, diaCiclo, ausencias: [...base.ausencias.filter((a) => a.docenteId !== docenteId), { docenteId, franjas: [...nuevas].sort() }] })
  }

  return (
    <>
      <header className="cabecera">
        <h2>Incapacidades y reemplazos</h2>
        <p className="guia">Registra quién falta un día. La app lista las clases que quedan sin docente y propone reemplazos o reorganizar el día. Tú eliges; el horario base no cambia.</p>
      </header>
      <div className="maestro">
        <div className="pila">
          <section className="panel">
            <h3>Registrar una ausencia</h3>
            <Campo etiqueta="Fecha de la ausencia"><input type="date" value={fecha} onChange={(ev) => { setFecha(ev.target.value); setDiaElegido(null) }} /></Campo>
            {dias === 10 ? (
              <Campo etiqueta="Día del ciclo" ayuda="La app lo propone contando desde el último día registrado. Confírmalo.">
                <select value={diaCiclo ?? ''} onChange={(ev) => setDiaElegido(Number(ev.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>Día {i + 1}</option>)}
                </select>
              </Campo>
            ) : (
              <p className="suave">{diaCiclo ? `Es ${nombreDia(diaCiclo, 5).toLowerCase()}.` : 'Ese día no hay clase: elige una fecha entre lunes y viernes.'}</p>
            )}
            <Campo etiqueta="Docente ausente">
              <select value={docenteId} onChange={(ev) => setDocenteId(ev.target.value)}>
                <option value="">Elegir docente…</option>
                {estado.docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </Campo>
            <label className="marca"><input type="checkbox" checked={todoElDia} onChange={(ev) => setTodoElDia(ev.target.checked)} />Todo el día</label>
            {!todoElDia && (
              <div className="fila" role="group" aria-label="Franjas en las que falta">
                {FRANJAS_LISTA.map((f) => (
                  <label key={f} className="marca" style={{ gap: 5 }}>
                    <input type="checkbox" aria-label={`Franja ${f}`} checked={franjas.includes(f)} onChange={(ev) => setFranjas((x) => (ev.target.checked ? [...x, f] : x.filter((y) => y !== f)))} />
                    {f}
                  </label>
                ))}
              </div>
            )}
            <button className="boton primario" disabled={!docenteId || !diaCiclo} onClick={registrar}>Registrar ausencia</button>
          </section>

          <section className="panel">
            <h3>Días con ausencias</h3>
            {estado.ajustes.length === 0 ? (
              <p className="suave">Todavía no hay ausencias guardadas.</p>
            ) : (
              <div className="lista">
                {[...estado.ajustes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((aj) => (
                  <button key={aj.fecha} aria-current={borrador?.fecha === aj.fecha} onClick={() => { abrirDia(aj); setFecha(aj.fecha) }}>
                    <span>
                      {fechaLarga(aj.fecha)}
                      <span className="detalle">{aj.ausencias.map((a) => nombre(a.docenteId)).join(', ') || 'Sin ausencias'} · {aj.reemplazos.length} {aj.reemplazos.length === 1 ? 'reemplazo' : 'reemplazos'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h3>Registro de horas cubiertas</h3>
            {registroHorasCubiertas(estado).length === 0 ? (
              <p className="suave">Aquí se suman las horas que cada docente ha cubierto como reemplazo.</p>
            ) : (
              <div className="tabla-caja">
                <table className="datos" aria-label="Registro de horas cubiertas">
                  <thead><tr><th>Docente</th><th className="num">Horas cubiertas</th></tr></thead>
                  <tbody>
                    {registroHorasCubiertas(estado).map((r) => <tr key={r.docenteId}><td>{nombre(r.docenteId)}</td><td className="num"><b>{r.horas}</b></td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {borrador ? editorDelDia(borrador) : (
          <Vacio titulo="Registra una ausencia o elige un día">
            <p>Al registrar una ausencia verás aquí las clases sin docente, quién puede reemplazar y cómo reorganizar el día.</p>
          </Vacio>
        )}
      </div>
    </>
  )

  // Función y no componente, para no desmontar los campos en cada cambio.
  function editorDelDia(aj: AjusteDia) {
    const delDia = sesionesDelDia(estado, { ...aj, gruposAusentes: [] })
    const afectadas = delDia.filter((s) => s.situacion === 'sinDocente' || s.situacion === 'reemplazo').sort((a, b) => a.franjaOriginal - b.franjaOriginal)
    const gruposConHuecos = [...new Set(delDia.filter((s) => s.situacion === 'sinDocente').map((s) => s.grupoId))]
    const impacto = impactoAjuste(estado, aj)
    const guardado = ajusteDe(estado, aj.fecha)
    const clasesDeGrupo = (grupoId: Id) => new Set(delDia.filter((s) => s.grupoId === grupoId).map((s) => s.claseId))
    const sinMovimientosDe = (grupoId: Id): AjusteDia => ({ ...aj, movimientos: aj.movimientos.filter((m) => !clasesDeGrupo(grupoId).has(m.claseId)) })

    const reemplazar = (claseId: Id, grupoId: Id, docente: Id) => {
      const limpio = sinMovimientosDe(grupoId) // la reorganización dependía de quién cubría
      setBorrador({ ...limpio, reemplazos: [...limpio.reemplazos.filter((r) => r.claseId !== claseId), ...(docente ? [{ claseId, docenteId: docente }] : [])] })
    }
    const quitarAusencia = (docente: Id) => {
      const ausencias = aj.ausencias.filter((a) => a.docenteId !== docente)
      const suyas = new Set(delDia.filter((s) => s.docenteOriginalId === docente).map((s) => s.claseId))
      setBorrador({ ...aj, ausencias, reemplazos: aj.reemplazos.filter((r) => !suyas.has(r.claseId)) })
    }
    const igual = (o: OpcionReorganizar, grupoId: Id) => {
      const actuales = aj.movimientos.filter((m) => clasesDeGrupo(grupoId).has(m.claseId))
      const llave = (ms: { claseId: Id; franja: number }[]) => ms.map((m) => `${m.claseId}:${m.franja}`).sort().join()
      return llave(actuales) === llave(o.movimientos)
    }

    return (
      <section className="panel">
        <div className="fila">
          <h3>{fechaLarga(aj.fecha)}</h3>
          {dias === 10 && <span className="ficha">Día {aj.diaCiclo} del ciclo</span>}
        </div>
        <div className="fila">
          {aj.ausencias.length === 0 && <span className="suave">Sin ausencias este día.</span>}
          {aj.ausencias.map((a) => (
            <span key={a.docenteId} className="ficha aviso-ficha">
              Falta {nombre(a.docenteId)}: {a.franjas.length === FRANJAS ? 'todo el día' : `franjas ${a.franjas.join(', ')}`}
              <button aria-label={`Quitar la ausencia de ${nombre(a.docenteId)}`} onClick={() => quitarAusencia(a.docenteId)}><Icono nombre="cerrar" tamano={14} /></button>
            </span>
          ))}
        </div>

        {afectadas.length > 0 && (
          <>
            <h4>Clases sin docente</h4>
            <p className="suave">Solo aparecen docentes de la misma jornada, libres y disponibles en esa franja, con al menos 2 franjas libres ese día y 1 en el día anterior o el siguiente.</p>
            <div className="tabla-caja">
              <table className="datos">
                <thead><tr><th className="num">Franja</th><th>Clase</th><th>Falta</th><th>Reemplazo</th></tr></thead>
                <tbody>
                  {afectadas.map((s) => {
                    const candidatos = candidatosReemplazo(estado, { ...aj, gruposAusentes: [], reemplazos: aj.reemplazos.filter((r) => r.claseId !== s.claseId) }, s.claseId)
                    const actual = aj.reemplazos.find((r) => r.claseId === s.claseId)?.docenteId ?? ''
                    return (
                      <tr key={s.claseId}>
                        <td className="num"><b>{s.franjaOriginal}</b></td>
                        <td><span className="fila" style={{ flexWrap: 'nowrap' }}><span className="muestra" style={{ background: colorDeArea(estado, s.areaId) }} /><span>{area(s.areaId)} · <b style={{ whiteSpace: 'nowrap' }}>{nombreDe(s.grupoId)}</b></span></span></td>
                        <td>{nombre(s.docenteOriginalId)}</td>
                        <td>
                          {candidatos.length === 0 && !actual ? (
                            <span className="suave">Nadie cumple las condiciones para cubrirla.</span>
                          ) : (
                            <select aria-label={`Reemplazo para ${area(s.areaId)} de ${nombreDe(s.grupoId)} en la franja ${s.franjaOriginal}`} value={actual} onChange={(ev) => reemplazar(s.claseId, s.grupoId, ev.target.value)}>
                              <option value="">Sin reemplazo</option>
                              {actual && !candidatos.some((c) => c.docenteId === actual) && <option value={actual}>{nombre(actual)} · ya no cumple las condiciones</option>}
                              {candidatos.map((c) => (
                                <option key={c.docenteId} value={c.docenteId}>
                                  {nombre(c.docenteId)} · {MOTIVO[c.motivo]}{c.horasCubiertas ? ` · ha cubierto ${c.horasCubiertas} h` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {gruposConHuecos.length > 0 && <h4>Horas que quedan sin cubrir</h4>}
        {gruposConHuecos.map((grupoId) => {
          const opciones = opcionesReorganizar(estado, { ...sinMovimientosDe(grupoId), gruposAusentes: [] }, grupoId)
          const ausente = aj.gruposAusentes.includes(grupoId)
          const elegida = ausente ? 'ausente' : opciones.find((o) => o.movimientos.length > 0 && igual(o, grupoId))?.tipo ?? 'nada'
          const elegir = (valor: string) => {
            const base = { ...sinMovimientosDe(grupoId), gruposAusentes: aj.gruposAusentes.filter((g) => g !== grupoId) }
            const opcion = opciones.find((o) => o.tipo === valor)
            setBorrador(valor === 'ausente' ? { ...base, gruposAusentes: [...base.gruposAusentes, grupoId] } : opcion ? aplicarReorganizacion(estado, base, opcion) : base)
          }
          const horas = delDia.filter((s) => s.grupoId === grupoId && s.situacion === 'sinDocente').length
          return (
            <fieldset key={grupoId} className="pila" style={{ border: '1.5px solid var(--linea)', borderRadius: 'var(--radio)', padding: '12px 14px', margin: 0, gap: 8 }}>
              <legend style={{ fontWeight: 700, padding: '0 6px' }}>Grupo {nombreDe(grupoId)}: {horas} {horas === 1 ? 'hora' : 'horas'} sin docente</legend>
              <label className="marca"><input type="radio" name={`reorg-${grupoId}`} checked={elegida === 'nada'} onChange={() => elegir('nada')} />Dejar las horas donde están</label>
              {opciones.map((o) =>
                o.movimientos.length === 0 ? (
                  // Las horas ya están al borde del día: no hay nada que elegir.
                  <span key={o.tipo} className="suave">Así como está, {o.tipo === 'llegaTarde' ? 'el grupo llega tarde' : 'el grupo sale temprano'}: no hay que mover ninguna clase.</span>
                ) : (
                  <label key={o.tipo} className="marca">
                    <input type="radio" name={`reorg-${grupoId}`} checked={elegida === o.tipo} onChange={() => elegir(o.tipo)} />
                    <span>
                      {o.tipo === 'llegaTarde' ? 'El grupo llega tarde' : 'El grupo sale temprano'}
                      <span className="suave" style={{ fontWeight: 400 }}> · se mueven clases de {o.docentesQueCambian.map(nombre).join(', ')}</span>
                    </span>
                  </label>
                ),
              )}
              {opciones.length === 0 && <span className="suave">No hay forma de mover las clases de este grupo sin cruzar a un docente.</span>}
              {puedeFaltarGrupo(estado, grupoId) && (
                <label className="marca"><input type="radio" name={`reorg-${grupoId}`} checked={ausente} onChange={() => elegir('ausente')} />Falta todo el grupo ese día</label>
              )}
            </fieldset>
          )
        })}

        <h4>Impacto de lo elegido</h4>
        <div className="fila">
          <span className="ficha bien">Horas cubiertas: {impacto.horasCubiertas}</span>
          <span className={`ficha ${impacto.horasSinCubrir ? 'aviso-ficha' : 'bien'}`}>Horas sin cubrir: {impacto.horasSinCubrir}</span>
          {impacto.gruposLleganTarde.length > 0 && <span className="ficha">Grupos que llegan tarde: {impacto.gruposLleganTarde.map(nombreDe).join(', ')}</span>}
          {impacto.gruposSalenTemprano.length > 0 && <span className="ficha">Grupos que salen temprano: {impacto.gruposSalenTemprano.map(nombreDe).join(', ')}</span>}
          {impacto.gruposAusentes.length > 0 && <span className="ficha">Grupos que no asisten: {impacto.gruposAusentes.map(nombreDe).join(', ')}</span>}
          {impacto.docentesQueCambian.length > 0 && <span className="ficha">Docentes que cambian de clase: {impacto.docentesQueCambian.map(nombre).join(', ')}</span>}
        </div>

        {sinGuardar(aj)
          ? <Aviso>Este día tiene <b>cambios sin guardar</b>. Toca «Confirmar y guardar» para que queden.</Aviso>
          : guardado && <Aviso tipo="bien">Este día está guardado como se ve aquí.</Aviso>}
        <div className="fila">
          <button
            className="boton primario"
            onClick={() => {
              cambiar((e) => guardarAjuste(e, aj))
              avisar('Día guardado. El horario base no cambió.')
            }}
          >
            Confirmar y guardar
          </button>
          <button className="boton" onClick={() => setBorrador(null)}>Cerrar sin guardar</button>
          {guardado && (
            <>
              <button className="boton" onClick={() => alVerDia(aj.fecha, afectadas[0]?.grupoId)}>Ver este día en el horario<Icono nombre="flecha" /></button>
              <button
                className="boton peligro empuja"
                onClick={() =>
                  confirmar({
                    titulo: '¿Borrar este día?', mensaje: 'Se borran sus ausencias, reemplazos y cambios. Las horas cubiertas de ese día salen del registro.',
                    boton: 'Sí, borrar', peligro: true,
                    accion: () => {
                      cambiar((e) => guardarAjuste(e, ajusteVacio(aj.fecha, aj.diaCiclo)))
                      setBorrador(null)
                    },
                  })
                }
              >
                <Icono nombre="borrar" tamano={18} />Borrar este día
              </button>
            </>
          )}
        </div>
      </section>
    )
  }
}
