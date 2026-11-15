import { detectarCruces } from './cruces'
import { quitarAjustesFuturos, sincronizarClases } from './edicion'
import { nuevoId } from './tiempo'
import type { Borrador, Estado, Id } from './tipos'

export const NOMBRE_INICIAL = 'Horario principal'

export const nombreHorario = (e: Estado): string => e.nombreHorario || NOMBRE_INICIAL

/**
 * Copia completa de la versión en uso para guardarla. Lo que es del colegio y no de una versión
 * (las incapacidades, la fecha del último respaldo, la lista de versiones) no va en la copia.
 */
const copia = (e: Estado, id: Id, guardado: string): Borrador => ({
  id, nombre: nombreHorario(e), guardado,
  estado: { ...e, borradores: undefined, nombreHorario: undefined, ajustes: [], ultimoRespaldo: undefined },
})

/** Guarda la versión en uso y sigue trabajando en una copia llamada `nombre`. */
export const nuevoBorrador = (e: Estado, nombre: string, ahora = new Date().toISOString()): Estado => ({
  ...e,
  borradores: [...(e.borradores ?? []), copia(e, nuevoId(), ahora)],
  nombreHorario: nombre,
})

/**
 * Pone en uso la versión `id` completa y deja guardada en su lugar la que estaba en uso.
 * El nombre del colegio y las incapacidades son de todas las versiones; como las clases cambian,
 * se quitan los reemplazos guardados desde `hoy` (como al generar de nuevo).
 */
export const abrirBorrador = (e: Estado, id: Id, hoy: string, ahora = new Date().toISOString()): Estado => {
  const b = e.borradores?.find((x) => x.id === id)
  if (!b) return e
  const abierto = sincronizarClases({
    ...b.estado,
    colegio: { ...b.estado.colegio, nombre: e.colegio.nombre },
    ajustes: e.ajustes,
    ultimoRespaldo: e.ultimoRespaldo,
    nombreHorario: b.nombre,
    borradores: e.borradores!.map((x) => (x.id === id ? copia(e, id, ahora) : x)),
  })
  return quitarAjustesFuturos(abierto, hoy)
}

/** `id` null renombra la versión en uso. */
export const renombrarHorario = (e: Estado, id: Id | null, nombre: string): Estado =>
  id === null ? { ...e, nombreHorario: nombre } : { ...e, borradores: e.borradores?.map((b) => (b.id === id ? { ...b, nombre } : b)) }

export const borrarBorrador = (e: Estado, id: Id): Estado => ({ ...e, borradores: e.borradores?.filter((b) => b.id !== id) })

/** Lo que se muestra de cada versión para compararlas. `cruces` incluye las horas sin ubicar. */
export const resumenVersion = (e: Estado) => ({
  grupos: e.grupos.length,
  docentes: e.docentes.length,
  horas: e.asignaciones.reduce((s, a) => s + a.horas, 0),
  clases: e.clases.length,
  cruces: detectarCruces(e).length,
})
