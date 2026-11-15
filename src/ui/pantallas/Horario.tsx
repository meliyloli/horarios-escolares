import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { descargar, descargarExcel, descargarExcelSabana } from '../../datos/excel'
import { descargarPdf, descargarPdfSabana, nombreArchivoSabana, pdfSabana } from '../../datos/pdf'
import { validarAsignacion } from '../../dominio/asignacion'
import { repartirAulas } from '../../dominio/aulas'
import { aulaDeClase, detectarCruces, type Cruce } from '../../dominio/cruces'
import { diagnosticar, type Bloqueo, type Propuesta } from '../../dominio/diagnostico'
import { cambiarClase, moverClase, quitarAjustesFuturos, sincronizarClases } from '../../dominio/edicion'
import { emparejarHorario, generarHorario, organizarMediaTecnica, reacomodarHorario, type ResultadoGenerar } from '../../dominio/generador'
import { ajusteDe, ajusteVacio, diaCicloDeFecha } from '../../dominio/reemplazos'
import { dictaEn, diasHorario, esMediaTecnica, jornadasDeGrupo, nombreDia, nombreGrupo } from '../../dominio/tiempo'
import type { AjusteDia, Estado, Id, Jornada } from '../../dominio/tipos'
import { tablaGeneral, tablasDe, vistasDeAula, type TipoVista } from '../../dominio/vistas'
import type { Pantalla } from '../App'
import { Borradores } from '../Borradores'
import { Repetidos } from '../Repetidos'
import { colorDeArea, tintaSobre } from '../colores'
import { Aviso, Icono, Pestanas, Vacio } from '../componentes'
import { mensajeEmparejar, useEstado } from '../estado'
import '../impresion.css'
import { TablaGeneral, TablaHorario, type OpcionesCelda } from '../TablaHorario'

interface Diagnostico {
  base: Estado
  resultado: ResultadoGenerar
  bloqueos: Bloqueo[]
  propuestas: Propuesta[]
}

const TODOS: Record<Exclude<TipoVista, 'general'>, string> = { docente: 'Todos los docentes', grupo: 'Todos los grupos', aula: 'Todas las aulas' }
const CRUCE_A_VISTA: Partial<Record<Cruce['tipo'], Exclude<TipoVista, 'general'>>> = {
  docente: 'docente', disponibilidad: 'docente', horaLibre: 'docente', libreDiaria: 'docente', cargaPareja: 'docente', carga: 'docente', sinUbicar: 'docente', aula: 'aula',
}
const hoy = () => new Date().toLocaleDateString('sv')
const fechaLarga = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

export function Horario({ alIr, fecha, alCambiarFecha, grupoInicial }: { alIr: (p: Pantalla) => void; fecha: string; alCambiarFecha: (f: string) => void; grupoInicial?: Id }) {
  const { estado, cambiar, confirmar, avisar } = useEstado()
  const [vista, setVista] = useState<TipoVista>('grupo')
  const [ids, setIds] = useState<Partial<Record<TipoVista, Id>>>({ grupo: grupoInicial })
  const [seleccion, setSeleccion] = useState<Id | null>(null)
  const [generando, setGenerando] = useState(false)
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [imprimiendo, setImprimiendo] = useState<null | 'vista' | 'todos'>(null)
  /** Qué se imprime o exporta: el que está a la vista, todos uno por hoja, o todos juntos en una sola tabla. */
  const [alcance, setAlcance] = useState<'uno' | 'todos' | 'tabla'>('uno')
  const [jornadaVista, setJornadaVista] = useState<'todas' | Jornada>('todas')
  const todos = alcance === 'todos'
  const enTabla = alcance === 'tabla' && vista !== 'general'

  const dias = diasHorario(estado)
  useEffect(() => {
    if (estado.colegio.modeloAula === 'ninguna' && vista === 'aula') setVista('grupo')
  }, [estado.colegio.modeloAula, vista])
  const grupos = useMemo(() => [...estado.grupos].sort((a, b) => a.grado - b.grado || a.numero - b.numero), [estado.grupos])
  // Mañana y tarde: con grupos de las dos jornadas (o docentes de horario intermedio) se puede ver y descargar cada una.
  const dosJornadas = new Set(estado.grupos.map((g) => g.jornada)).size > 1 || estado.docentes.some((d) => d.jornada === 'ambas') || estado.asignaciones.some((a) => a.jornada)
  const jornada: Jornada | undefined = dosJornadas && jornadaVista !== 'todas' ? jornadaVista : undefined
  const opciones: Record<Exclude<TipoVista, 'general'>, { id: Id; nombre: string }[]> = {
    grupo: grupos.filter((g) => !jornada || jornadasDeGrupo(estado, g).includes(jornada)).map((g) => ({ id: g.id, nombre: nombreGrupo(g) })),
    docente: estado.docentes.filter((d) => !jornada || dictaEn(d, jornada)).map((d) => ({ id: d.id, nombre: d.nombre })),
    aula: vistasDeAula(estado).filter((v) => !jornada || !v.id.includes('@') || v.id.endsWith(`@${jornada}`)),
  }
  const idDe = (v: Exclude<TipoVista, 'general'>): Id => (opciones[v].some((o) => o.id === ids[v]) ? ids[v]! : opciones[v][0]?.id ?? '')

  const cruces = useMemo(() => detectarCruces(estado), [estado])
  const conCruce = useMemo(() => new Set(cruces.flatMap((c) => c.claseIds)), [cruces])
  const areaDeClase = useMemo(() => {
    const asignaciones = new Map(estado.asignaciones.map((a) => [a.id, a]))
    return new Map(estado.clases.map((c) => [c.id, asignaciones.get(c.asignacionId)?.areaId ?? '']))
  }, [estado.clases, estado.asignaciones])
  const estilo = (claseId: Id): CSSProperties => {
    const color = colorDeArea(estado, areaDeClase.get(claseId) ?? '')
    return { background: color, color: tintaSobre(color) }
  }

  // Vista de un día con sus ajustes por incapacidad: solo lectura.
  const diaCiclo = fecha ? ajusteDe(estado, fecha)?.diaCiclo ?? diaCicloDeFecha(estado, fecha) : undefined
  const ajuste: AjusteDia | undefined = fecha && diaCiclo ? ajusteDe(estado, fecha) ?? ajusteVacio(fecha, diaCiclo) : undefined
  const soloLectura = !!fecha

  useEffect(() => {
    if (!imprimiendo) return
    const terminar = () => setImprimiendo(null)
    addEventListener('afterprint', terminar)
    const t = setTimeout(() => (typeof print === 'function' ? print() : terminar()), 80)
    return () => {
      removeEventListener('afterprint', terminar)
      clearTimeout(t)
    }
  }, [imprimiendo])
  // El diagnóstico se calculó sobre un estado: si los datos cambian por otro lado, ya no vale.
  useEffect(() => setDiagnostico((d) => (d && d.base !== estado ? null : d)), [estado])
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => ev.key === 'Escape' && setSeleccion(null)
    addEventListener('keydown', alTeclear)
    return () => removeEventListener('keydown', alTeclear)
  }, [])

  // ---------- Generar ----------
  const resolver = (base: Estado) => {
    setGenerando(true)
    setSeleccion(null)
    // shortcut: el generador corre en el hilo principal y congela la pantalla unos segundos; pasar a un Web Worker si el colegio crece.
    setTimeout(() => {
      const resultado = generarHorario(base, { semilla: Math.floor(Math.random() * 1e6) })
      if (resultado.completo) {
        cambiar(() => quitarAjustesFuturos({ ...base, clases: resultado.clases }, hoy()))
        setDiagnostico(null)
        const quedan = detectarCruces({ ...base, clases: resultado.clases }).length
        avisar(`Horario generado: ${resultado.clases.length} clases ubicadas.${quedan ? ` Quedan ${quedan} cruces por revisar en la lista.` : ''}`)
      } else {
        setDiagnostico({ base, resultado, ...diagnosticar(base, resultado) })
      }
      setGenerando(false)
    }, 40)
  }
  const generar = () => {
    if (estado.clases.length === 0) return resolver(estado)
    const fijadas = estado.clases.filter((c) => c.fijada).length
    const porVenir = estado.ajustes.filter((aj) => aj.fecha >= hoy() && (aj.reemplazos.length > 0 || aj.movimientos.length > 0)).length
    confirmar({
      titulo: '¿Generar el horario de nuevo?',
      mensaje: `Las clases se vuelven a ubicar y se pierden los cambios hechos a mano. ${fijadas ? `Las ${fijadas} clases fijadas se quedan donde están.` : 'Si quieres conservar alguna clase en su lugar, fíjala antes.'}${porVenir ? ` Además se quitan los reemplazos ya guardados de ${porVenir} ${porVenir === 1 ? 'día' : 'días'} de hoy en adelante, porque las clases cambian de hora; las ausencias se conservan.` : ''}`,
      boton: 'Sí, generar de nuevo',
      accion: () => resolver(estado),
    })
  }

  // ---------- Edición manual ----------
  const elegir = (claseId: Id) => setSeleccion((s) => (s === claseId ? null : claseId))
  const soltar = (dia: number, franja: number) => {
    if (!seleccion) return
    cambiar((e) => {
      const movido = moverClase(e, seleccion, dia, franja)
      // Con aulas libres, la clase que cambió de hora toma un aula que esté libre allá.
      return repartirAulas(movido, new Set(movido.clases.filter((c, i) => c !== e.clases[i]).map((c) => c.id)))
    })
    setSeleccion(null)
  }
  const irACruce = (c: Cruce) => {
    const v = CRUCE_A_VISTA[c.tipo] ?? 'grupo'
    const id = v === 'docente' ? c.docenteId : v === 'aula' ? opciones.aula.find((o) => o.id.split('@')[0] === c.aulaId)?.id : c.grupoId
    alCambiarFecha('')
    setVista(v)
    if (id) setIds((x) => ({ ...x, [v]: id }))
    setSeleccion(c.claseIds[0] ?? null)
  }

  const celda: OpcionesCelda = {
    diasCiclo: dias, estilo, cruces: soloLectura ? undefined : conCruce,
    seleccion: soloLectura ? null : seleccion,
    alElegir: soloLectura ? undefined : vista === 'general' ? (id) => irAClase(id) : elegir,
    alSoltar: soloLectura || vista === 'general' ? undefined : soltar,
    verboOcupada: vista === 'grupo' ? 'Intercambiar con' : 'Mover sobre',
  }
  function irAClase(claseId: Id) {
    const docenteId = estado.asignaciones.find((a) => a.id === estado.clases.find((c) => c.id === claseId)?.asignacionId)?.docenteId
    setVista('docente')
    if (docenteId) setIds((x) => ({ ...x, docente: docenteId }))
    setSeleccion(claseId)
  }

  const hojas = (tipo: TipoVista, todos: boolean, o: OpcionesCelda) => {
    if (tipo === 'general') {
      const g = tablaGeneral(estado, ajuste, jornada)
      return g.dias.map((d, j) => (
        <Hoja key={d} titulo={`Horario general · ${nombreDia(d, dias)}${jornada ? ` · ${jornada === 'manana' ? 'mañana' : 'tarde'}` : ''}`}>
          <TablaGeneral docentes={g.docentes} dias={[d]} celdas={g.celdas.map((fila) => [fila[j]])} {...o} />
        </Hoja>
      ))
    }
    const lista = todos ? opciones[tipo].map((x) => x.id) : [idDe(tipo)]
    return lista.flatMap((id) => tablasDe(estado, tipo, id, ajuste, jornada).map((t, k) => (
      <Hoja key={`${id}-${k}`} titulo={t.titulo} subtitulo={t.subtitulo}><TablaHorario tabla={t} {...o} /></Hoja>
    )))
  }
  function Hoja({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
    return (
      <section className="hoja">
        <div className="hoja-cabeza">
          <h2>{titulo}</h2>
          {subtitulo && <span>{subtitulo}</span>}
          {fecha && <span>{fechaLarga(fecha)}</span>}
          <span className="colegio">{estado.colegio.nombre}</span>
        </div>
        {children}
        <Leyenda />
      </section>
    )
  }
  const Leyenda = () => (
    <div className="leyenda">
      {estado.areas.map((a) => <span key={a.id}><span className="muestra" style={{ background: colorDeArea(estado, a.id) }} />{a.nombre}</span>)}
    </div>
  )

  /** Qué se imprime o exporta: el docente, grupo o aula a la vista, o todos (uno por hoja). */
  const aExportar = (): Id[] => (vista === 'general' ? [] : todos ? opciones[vista].map((o) => o.id) : [idDe(vista)])
  const exportarPdf = () => {
    try {
      if (enTabla) descargarPdfSabana(estado, vista, ajuste, fecha || undefined, jornada)
      else descargarPdf(estado, vista, aExportar(), ajuste, fecha || undefined, jornada)
    } catch {
      avisar('No se pudo crear el PDF.')
    }
  }
  const imprimir = () => {
    if (!enTabla) return setImprimiendo(todos && vista !== 'general' ? 'todos' : 'vista')
    // La tabla de todos juntos va en hoja oficio: se abre como PDF y se imprime desde ahí.
    try {
      const blob = pdfSabana(estado, vista, ajuste, fecha || undefined, jornada).output('blob')
      if (!open(URL.createObjectURL(blob), '_blank')) descargar(blob, nombreArchivoSabana(estado, vista, fecha || undefined, jornada))
    } catch {
      avisar('No se pudo crear el PDF para imprimir.')
    }
  }
  const exportarExcel = () =>
    (enTabla ? descargarExcelSabana(estado, vista, jornada) : descargarExcel(estado, vista, aExportar(), jornada)).catch(() => avisar('No se pudo crear el archivo de Excel.'))

  // Media técnica y cruces: arreglos que mueven lo mínimo, sin generar todo de nuevo.
  const hayMediaTecnica = estado.asignaciones.some((a) => esMediaTecnica(estado, a.areaId))
  const arreglables = cruces.filter((c) => c.tipo !== 'carga' && c.tipo !== 'sinUbicar' && c.tipo !== 'cargaPareja').length
  const organizarMt = () => {
    const r = organizarMediaTecnica(estado)
    cambiar(() => r.estado, { talCual: true })
    avisar(`Media técnica organizada: ${r.ubicadas} ${r.ubicadas === 1 ? 'clase ubicada' : 'clases ubicadas'}${r.sinUbicar ? `; ${r.sinUbicar} no cupieron (revisa la disponibilidad del docente)` : ''}. Lo demás no se movió.`)
  }
  const arreglar = () => {
    const r = reacomodarHorario(estado)
    if (!r.movidas) return avisar('No se pudo arreglar sin romper otra regla o mover una clase fijada. Prueba moviendo una clase a mano o «Generar de nuevo».')
    cambiar(() => r.estado, { talCual: true })
    avisar(`Se ${r.movidas === 1 ? 'movió 1 clase' : `movieron ${r.movidas} clases`} para quitar los cruces.`)
  }

  const erroresAsignacion = validarAsignacion(estado).filter((a) => a.gravedad === 'error').length
  const hayHorario = estado.clases.length > 0
  const elegida = estado.clases.find((c) => c.id === seleccion)

  return (
    <>
      <header className="cabecera">
        <h2>Horario</h2>
        {hayHorario && (
          <>
            {dosJornadas && (
              <select aria-label="Jornada" value={jornadaVista} onChange={(ev) => { setJornadaVista(ev.target.value as typeof jornadaVista); setSeleccion(null) }}>
                <option value="todas">Mañana y tarde</option>
                <option value="manana">Solo la mañana</option>
                <option value="tarde">Solo la tarde</option>
              </select>
            )}
            {vista !== 'general' && (
              <select aria-label="Qué imprimir o exportar" value={alcance} onChange={(ev) => setAlcance(ev.target.value as typeof alcance)}>
                <option value="uno">Solo {opciones[vista].find((o) => o.id === idDe(vista))?.nombre}</option>
                <option value="todos">{TODOS[vista]}, uno por hoja</option>
                <option value="tabla">{TODOS[vista]} {vista === 'aula' ? 'juntas' : 'juntos'} en una tabla</option>
              </select>
            )}
            <button className="boton" onClick={imprimir}><Icono nombre="imprimir" />Imprimir</button>
            <button className="boton" title="Descarga un PDF a color, listo para mandar por WhatsApp o correo" onClick={exportarPdf}><Icono nombre="bajar" />PDF</button>
            <button className="boton" onClick={exportarExcel}><Icono nombre="excel" />Excel</button>
          </>
        )}
        {estado.asignaciones.length > 0 && (
          <button className="boton primario" onClick={generar} disabled={generando}>
            <Icono nombre="varita" />{generando ? 'Generando…' : hayHorario ? 'Generar de nuevo' : 'Generar horario'}
          </button>
        )}
        <p className="guia">
          {hayHorario
            ? 'Para mover una clase, tócala y luego toca la celda de destino (o arrástrala). La app nunca impide un cambio: avisa cada cruce y lo deja en la lista de pendientes.'
            : 'La app ubica cada clase en un día y una franja cumpliendo todas las reglas del colegio.'}
        </p>
      </header>
      {(estado.asignaciones.length > 0 || (estado.borradores?.length ?? 0) > 0) && !soloLectura && <Borradores />}
      {!soloLectura && <Repetidos />}

      {estado.asignaciones.length === 0 ? (
        <Vacio titulo="Primero completa la asignación académica">
          <p>El horario se arma a partir de las horas que cada docente dicta a cada grupo.</p>
          <button className="boton primario" onClick={() => alIr('asignacion')}>Ir a la asignación académica<Icono nombre="flecha" /></button>
        </Vacio>
      ) : (
        <>
          {erroresAsignacion > 0 && !diagnostico && (
            <Aviso acciones={<button className="boton chico" onClick={() => alIr('asignacion')}>Revisar la asignación</button>}>
              La asignación académica tiene {erroresAsignacion} {erroresAsignacion === 1 ? 'aviso' : 'avisos'} por resolver. Puedes generar el horario así, pero es mejor corregirlos antes.
            </Aviso>
          )}
          {generando && <Aviso tipo="info">Buscando un horario que cumpla todas las reglas. Puede tardar unos segundos…</Aviso>}
          {diagnostico && !generando && (
            <section className="panel" aria-labelledby="titulo-diagnostico">
              <h3 id="titulo-diagnostico">No se pudo ubicar todo el horario</h3>
              <p>
                Quedaron <b>{diagnostico.resultado.sinUbicar.reduce((s, x) => s + x.horas, 0)} horas sin ubicar</b>. La app no relaja ninguna regla por su cuenta: esto es lo que
                bloquea y lo que puedes hacer.
              </p>
              {diagnostico.bloqueos.map((b) => <Aviso key={b.mensaje} tipo="error">{b.mensaje}</Aviso>)}
              {diagnostico.propuestas.length > 0 && <h4>Soluciones posibles, de menor a mayor impacto</h4>}
              {diagnostico.propuestas.map((p) => (
                <div key={p.descripcion} className="aviso info">
                  <Icono nombre="flecha" />
                  <div>
                    <b>{p.descripcion}</b><br />
                    <span className={`ficha ${p.resuelve ? 'bien' : 'aviso-ficha'}`}>{p.resuelve ? 'La app la probó: con esto el horario queda completo' : 'Ayuda, pero sola no alcanza'}</span>
                  </div>
                  <div className="acciones">
                    <button className="boton chico" aria-label={`Aplicar y recalcular: ${p.descripcion}`} onClick={() => resolver(sincronizarClases(p.aplicar(diagnostico.base)))}>Aplicar y recalcular</button>
                  </div>
                </div>
              ))}
              <div className="fila">
                <button
                  className="boton"
                  onClick={() => {
                    cambiar(() => quitarAjustesFuturos({ ...diagnostico.base, clases: diagnostico.resultado.clases }, hoy()))
                    setDiagnostico(null)
                  }}
                >
                  Guardar lo que sí se pudo ubicar
                </button>
                <button className="boton" onClick={() => setDiagnostico(null)}>Cerrar sin cambiar nada</button>
              </div>
            </section>
          )}

          {!hayHorario ? (
            !diagnostico && !generando && (
              <Vacio titulo="Todavía no hay horario">
                <p>Toca «Generar horario». Después podrás moverlo a mano, imprimirlo y exportarlo.</p>
              </Vacio>
            )
          ) : (
            <div className={`columnas ${vista === 'general' ? 'ancha' : ''}`}>
              <div className="pila">
                <div className="fila">
                  <Pestanas etiqueta="Vista del horario" valor={vista} alCambiar={(v) => { setVista(v); setSeleccion(null) }} opciones={estado.colegio.modeloAula === 'ninguna' ? [['general', 'General'], ['docente', 'Por docente'], ['grupo', 'Por grupo']] : [['general', 'General'], ['docente', 'Por docente'], ['grupo', 'Por grupo'], ['aula', 'Por aula']]} />
                  {vista !== 'general' && (
                    <select aria-label={`Elegir ${vista}`} value={idDe(vista)} onChange={(ev) => { setIds((x) => ({ ...x, [vista]: ev.target.value })); setSeleccion(null) }}>
                      {opciones[vista].map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                  )}
                  <label className="fila empuja" style={{ fontWeight: 600 }}>
                    Ver un día con sus incapacidades
                    <input type="date" value={fecha} onChange={(ev) => alCambiarFecha(ev.target.value)} />
                  </label>
                  {fecha && <button className="boton chico" onClick={() => alCambiarFecha('')}>Volver al horario base</button>}
                </div>
                {fecha && (ajuste
                  ? <Aviso tipo="info">Estás viendo el <b>{fechaLarga(fecha)}</b> con sus reemplazos y cambios. El horario base no cambia. Para mover clases, vuelve al horario base.</Aviso>
                  : <Aviso>El {fechaLarga(fecha)} no es un día de clase. Elige un día entre lunes y viernes.</Aviso>)}
                {(!fecha || ajuste) && (vista === 'general'
                  ? <TablaGeneral {...tablaGeneral(estado, ajuste, jornada)} {...celda} />
                  : tablasDe(estado, vista, idDe(vista), ajuste, jornada).map((t, k, todas) => (
                    <div key={k} className="pila" style={{ gap: 6 }}>
                      {todas.length > 1 && <h4 style={{ margin: 0 }}>{t.jornada === 'tarde' ? 'Jornada de la tarde' : 'Jornada de la mañana'}</h4>}
                      <TablaHorario tabla={t} {...celda} />
                    </div>
                  )))}
                <Leyenda />
              </div>

              <aside className="panel pegado" aria-label="Clase seleccionada y cruces">
                {elegida && !soloLectura && (
                  <>
                    <div className="fila">
                      <h3>Clase seleccionada</h3>
                      <button className="boton chico icono empuja" aria-label="Soltar la selección" onClick={() => setSeleccion(null)}><Icono nombre="cerrar" tamano={18} /></button>
                    </div>
                    <p>Toca una celda para moverla ahí. Si el grupo ya tiene clase en esa franja, se intercambian.</p>
                    {estado.colegio.modeloAula !== 'ninguna' && <label className="campo">
                      Aula
                      <select value={elegida.aulaId ?? ''} onChange={(ev) => cambiar((e) => cambiarClase(e, elegida.id, { aulaId: ev.target.value || undefined }))}>
                        <option value="">La que le corresponde ({estado.aulas.find((a) => a.id === aulaDeClase(estado, { ...elegida, aulaId: undefined }))?.nombre ?? 'sin aula'})</option>
                        {estado.aulas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </label>}
                    <label className="marca">
                      <input type="checkbox" checked={elegida.fijada} onChange={(ev) => cambiar((e) => cambiarClase(e, elegida.id, { fijada: ev.target.checked }))} />
                      Fijar esta clase para que el generador no la mueva
                    </label>
                    <hr style={{ width: '100%', border: 0, borderTop: '1.5px solid var(--linea)' }} />
                  </>
                )}
                {estado.colegio.modeloAula === 'libre' && !soloLectura && (
                  <button className="boton chico" title="Da un aula libre a las clases que no tienen o cuya aula quedó ocupada" onClick={() => cambiar((e) => repartirAulas(e))}>
                    Repartir aulas libres
                  </button>
                )}
                {!soloLectura && hayMediaTecnica && (
                  <div className="pila" style={{ gap: 6 }}>
                    <button className="boton chico" onClick={organizarMt}>Organizar la media técnica</button>
                    <p className="suave">Vuelve a ubicar solo la media técnica: un grupo por día para cada docente y, si caben, las horas de cada grupo en un mismo día. Lo demás no se mueve.</p>
                  </div>
                )}
                <h3>Cruces pendientes · {cruces.length}</h3>
                {!soloLectura && arreglables > 0 && (
                  <div className="pila" style={{ gap: 6 }}>
                    <button className="boton chico primario" onClick={arreglar}>Arreglar cruces</button>
                    <p className="suave">Mueve solo las clases que están chocando o rompiendo una regla, con los cambios más cortos posibles. No toca las fijadas.</p>
                  </div>
                )}
                {cruces.length === 0 ? (
                  <Aviso tipo="bien">Sin cruces pendientes: el horario cumple todas las reglas.</Aviso>
                ) : (
                  <>
                    {cruces.some((c) => c.tipo === 'cargaPareja') && !soloLectura && (
                      <div className="pila" style={{ gap: 8 }}>
                        <button
                          className="boton chico primario"
                          onClick={() => {
                            const r = emparejarHorario(estado)
                            cambiar(() => r.estado)
                            avisar(mensajeEmparejar(r).trim() || 'No se pudo emparejar sin romper otra regla: mueve una clase a mano o quita la fijación de alguna.')
                          }}
                        >
                          Emparejar la carga
                        </button>
                        <p className="suave">Mueve o intercambia las clases necesarias para que ningún docente quede con un día recargado y otro con muchas horas libres. No toca las clases fijadas.</p>
                      </div>
                    )}
                    <p className="suave">Toca un aviso para ir a la clase.</p>
                    {cruces.map((c, i) => (
                      <button key={i} className="aviso error" onClick={() => irACruce(c)}><Icono nombre="alerta" /><span>{c.mensaje}</span></button>
                    ))}
                  </>
                )}
              </aside>
            </div>
          )}
        </>
      )}

      {/* Fuera de .app, que se oculta al imprimir. */}
      {imprimiendo && createPortal(<div className="solo-impresion">{hojas(vista, imprimiendo === 'todos', { diasCiclo: dias, estilo })}</div>, document.body)}
    </>
  )
}
