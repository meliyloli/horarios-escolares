import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { guardarEstado, importarRespaldo, LLAVE } from '../datos/almacen'
import { sincronizarClases } from '../dominio/edicion'
import { completarHorario, emparejarHorario, reacomodarHorario } from '../dominio/generador'
import type { Estado } from '../dominio/tipos'
import { Icono } from './componentes'

export interface Pregunta {
  titulo: string
  mensaje: string
  boton: string
  peligro?: boolean
  accion: () => void
}

interface Contexto {
  estado: Estado
  /**
   * Aplica un cambio, deja las clases coherentes con los datos y guarda. Si el cambio toca la asignación, docentes,
   * aulas o reglas, ajusta el horario solo. Con `talCual` (abrir una versión, importar) lo deja como viene.
   */
  cambiar: (f: (e: Estado) => Estado, opciones?: { talCual?: boolean }) => void
  deshacer: () => void
  puedeDeshacer: boolean
  /** Pone otro colegio en pantalla: sin pasar por las reglas de `cambiar` y sin «deshacer» hacia el anterior. */
  reemplazar: (e: Estado) => void
  /** false si el navegador no dejó guardar. */
  guardado: boolean
  /** Guarda ya mismo y dice si el navegador lo permitió. */
  guardarAhora: () => boolean
  confirmar: (p: Pregunta) => void
  avisar: (texto: string) => void
}

const Ctx = createContext<Contexto | null>(null)

export const useEstado = (): Contexto => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useEstado se usa dentro de <ProveedorEstado>')
  return c
}

/** Qué hizo «emparejar la carga», para el aviso. */
export const mensajeEmparejar = (r: { emparejados: number; quedan: number; movidas: number }): string =>
  (r.emparejados ? `Se emparejó la carga de ${r.emparejados} ${r.emparejados === 1 ? 'docente' : 'docentes'} moviendo ${r.movidas} ${r.movidas === 1 ? 'clase' : 'clases'}.` : '') +
  (r.quedan ? ` ${r.quedan === 1 ? '1 docente sigue' : `${r.quedan} docentes siguen`} con carga dispareja: sus clases fijadas o las reglas no dejan moverlas; revisa los avisos en Horario.` : '')

/** Lo de los docentes que cambia cómo se reparte su carga (no su nombre ni su aula). Un movimiento a mano no lo cambia. */
const cargas = (e: Estado) => JSON.stringify(e.docentes.map((d) => [d.id, d.cargaSemanal, d.horasExtra, d.noDisponible]))
/** Lo que, si cambia con un horario hecho, puede dejar clases rompiendo una regla. No cuenta nombres ni movimientos a mano. */
const estructura = (e: Estado) =>
  JSON.stringify([
    e.docentes.map(({ nombre: _, ...d }) => d), e.grupos, e.aulas.map((a) => [a.id, a.capacidad]),
    e.colegio.reglas, e.colegio.modeloAula, e.colegio.ciclo,
  ])

export function ProveedorEstado({ inicial, children }: { inicial: Estado; children: ReactNode }) {
  // Estado actual y sus versiones anteriores juntos, para que deshacer sea un solo cambio.
  const [{ estado, historia }, setTodo] = useState({ estado: inicial, historia: [] as Estado[] })
  const [guardado, setGuardado] = useState(true)
  // El estado más reciente, para encadenar cambios seguidos sin esperar a que React vuelva a dibujar.
  const estadoActual = useRef(inicial)
  estadoActual.current = estado
  const [pregunta, setPregunta] = useState<Pregunta | null>(null)
  const [brindis, setBrindis] = useState('')
  const dialogo = useRef<HTMLDialogElement>(null)

  const cambiar = useCallback((f: (e: Estado) => Estado, opciones: { talCual?: boolean } = {}) => {
    const antes = estadoActual.current
    let nuevo = sincronizarClases(f(antes))
    const mensajes: string[] = []
    if (opciones.talCual) {
      estadoActual.current = nuevo
      return setTodo((t) => ({ estado: nuevo, historia: [...t.historia.slice(-99), t.estado] }))
    }
    // Si cambió la asignación y ya hay horario, las horas nuevas se ubican solas sin mover las demás clases.
    if (nuevo.asignaciones !== antes.asignaciones) {
      const r = completarHorario(nuevo)
      nuevo = r.estado
      if (r.ubicadas || r.sinUbicar)
        mensajes.push(
          (r.ubicadas ? `Se ${r.ubicadas === 1 ? 'ubicó 1 hora nueva' : `ubicaron ${r.ubicadas} horas nuevas`} en el horario sin mover las demás clases.` : '') +
          (r.sinUbicar ? ` ${r.sinUbicar === 1 ? '1 hora no cupo' : `${r.sinUbicar} horas no cupieron`}: en Horario, «Generar de nuevo» reacomoda todo.` : ''),
        )
    }
    // Si cambiaron docentes, grupos, aulas o reglas, se mueven solas las clases que quedaron rompiendo una regla.
    if (nuevo.clases.length && estructura(nuevo) !== estructura(antes)) {
      const r = reacomodarHorario(nuevo)
      nuevo = r.estado
      if (r.movidas) mensajes.push(`Se ${r.movidas === 1 ? 'reacomodó 1 clase' : `reacomodaron ${r.movidas} clases`} para que el horario siga cumpliendo las reglas.`)
    }
    // Con carga pareja, el horario se reacomoda solo al activar la regla o al cambiar la asignación o los docentes.
    const pareja = !!nuevo.colegio.reglas.cargaPareja?.activa
    if (pareja && (!antes.colegio.reglas.cargaPareja?.activa || nuevo.asignaciones !== antes.asignaciones || cargas(nuevo) !== cargas(antes))) {
      const r = emparejarHorario(nuevo)
      nuevo = r.estado
      if (r.emparejados || r.quedan) mensajes.push(mensajeEmparejar(r))
    }
    if (mensajes.length) setBrindis(mensajes.join(' ').trim())
    estadoActual.current = nuevo
    setTodo((t) => ({ estado: nuevo, historia: [...t.historia.slice(-99), t.estado] }))
  }, [])
  const reemplazar = useCallback((e: Estado) => {
    estadoActual.current = e
    setTodo({ estado: e, historia: [] })
  }, [])
  const deshacer = useCallback(() => {
    setTodo((t) => (t.historia.length ? { estado: t.historia.at(-1)!, historia: t.historia.slice(0, -1) } : t))
  }, [])

  // Cada guardado lleva una marca nueva. Lo que llega de otra pestaña no se vuelve a guardar (así no rebota entre pestañas).
  const sello = useRef(inicial.guardadoEn ?? 0)
  const desdeOtra = useRef<Estado | null>(null)
  const [pestanaVieja, setPestanaVieja] = useState(false)
  const guardarConSello = (e: Estado) => {
    sello.current = Math.max(Date.now(), sello.current + 1)
    return guardarEstado({ ...e, guardadoEn: sello.current })
  }
  useEffect(() => {
    if (estado === desdeOtra.current) return
    setGuardado(guardarConSello(estado))
  }, [estado])
  const guardarAhora = () => {
    const ok = guardarConSello(estado)
    setGuardado(ok)
    return ok
  }
  // Si la app está abierta en otra pestaña y allá se guarda algo, esta pestaña lo carga en vez de pisarlo después.
  useEffect(() => {
    const alGuardarEnOtra = (ev: StorageEvent) => {
      if (ev.key !== LLAVE || !ev.newValue) return
      try {
        const llegado = importarRespaldo(ev.newValue)
        // Con la marca de esta pestaña pero otro contenido: una pestaña con una versión anterior de la app releyó lo
        // de aquí y lo guardó a su manera (perdiendo lo que no conoce). No se carga: se avisa que la cierren.
        if (llegado.guardadoEn === sello.current) return setPestanaVieja(true)
        sello.current = llegado.guardadoEn ?? sello.current
        desdeOtra.current = llegado
        estadoActual.current = llegado
        setTodo({ estado: llegado, historia: [] })
        setBrindis('Se cargaron los cambios hechos en otra pestaña.')
      } catch {
        // lo guardado allá no se pudo leer: esta pestaña sigue con lo suyo
      }
    }
    addEventListener('storage', alGuardarEnOtra)
    return () => removeEventListener('storage', alGuardarEnOtra)
  }, [])
  useEffect(() => {
    const d = dialogo.current
    if (pregunta && d && !d.open) d.showModal ? d.showModal() : d.setAttribute('open', '')
  }, [pregunta])
  useEffect(() => {
    if (!brindis) return
    const t = setTimeout(() => setBrindis(''), 4000)
    return () => clearTimeout(t)
  }, [brindis])

  const cerrar = () => {
    dialogo.current?.close?.()
    setPregunta(null)
  }

  return (
    <Ctx.Provider value={{ estado, cambiar, deshacer, reemplazar, puedeDeshacer: historia.length > 0, guardado, guardarAhora, confirmar: setPregunta, avisar: setBrindis }}>
      {pestanaVieja && (
        <div role="alert" className="aviso error aviso-fijo">
          <Icono nombre="alerta" />
          <div>
            <b>Hay otra pestaña o ventana con una versión anterior de la app abierta</b>, y está deshaciendo tus cambios (por ejemplo, la jornada
            «Mañana y tarde»). Ciérrala y deja abierta solo esta. Lo de esta pestaña no se perdió.
          </div>
          <div className="acciones"><button className="boton chico" onClick={() => { setPestanaVieja(false); setGuardado(guardarConSello(estadoActual.current)) }}>Ya la cerré</button></div>
        </div>
      )}
      {children}
      {pregunta && (
        <dialog ref={dialogo} onClose={() => setPregunta(null)} aria-labelledby="pregunta-titulo">
          <h3 id="pregunta-titulo">{pregunta.titulo}</h3>
          <p>{pregunta.mensaje}</p>
          <div className="fila">
            <button className="boton" onClick={cerrar} autoFocus>Cancelar</button>
            <button
              className={`boton ${pregunta.peligro ? 'peligro' : 'primario'}`}
              onClick={() => {
                pregunta.accion()
                cerrar()
              }}
            >
              {pregunta.boton}
            </button>
          </div>
        </dialog>
      )}
      <div role="status" aria-live="polite">{brindis && <div className="brindis">{brindis}</div>}</div>
    </Ctx.Provider>
  )
}
