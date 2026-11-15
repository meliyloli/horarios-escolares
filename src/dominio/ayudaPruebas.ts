// Utilidades solo para pruebas: construyen estados pequeños.
import { reglasPorDefecto } from './ejemplo'
import type { Asignacion, Clase, Docente, Estado, Grupo } from './tipos'

export const doc = (id: string, p: Partial<Docente> = {}): Docente => ({
  id, nombre: id, areaId: 'mat', nivel: 'bachillerato', jornada: 'manana', cargaSemanal: 22, noDisponible: [], ...p,
})

export const grp = (id: string, grado: number, p: Partial<Grupo> = {}): Grupo => ({
  id, grado, numero: 1, jornada: 'manana', aulaId: `aula-${id}`, ...p,
})

export const asg = (docenteId: string, grupoId: string, areaId: string, horas: number): Asignacion => ({
  id: `${docenteId}|${grupoId}|${areaId}`, docenteId, grupoId, areaId, horas,
})

let n = 0
export const cls = (asignacionId: string, dia: number, franja: number, p: Partial<Clase> = {}): Clase => ({
  id: `c${++n}`, asignacionId, dia, franja, fijada: false, ...p,
})

export const mini = (p: Partial<Estado> = {}): Estado => {
  const e: Estado = {
    version: 1,
    colegio: { nombre: 'Prueba', ciclo: 5, modeloAula: 'grupo', reglas: reglasPorDefecto() },
    areas: [
      { id: 'mat', nombre: 'Matemáticas', afines: ['tec'] },
      { id: 'len', nombre: 'Lengua Castellana', afines: ['ing'] },
      { id: 'ing', nombre: 'Inglés', afines: ['len'] },
      { id: 'tec', nombre: 'Tecnología', afines: ['mat'] },
      { id: 'soc', nombre: 'Ciencias Sociales', afines: [] },
    ],
    intensidad: {},
    grupos: [], docentes: [], aulas: [], asignaciones: [], clases: [], ajustes: [],
    ...p,
  }
  const usadas = new Set([...e.grupos.map((g) => g.aulaId), ...e.docentes.map((d) => d.aulaId)])
  for (const id of usadas) if (id && !e.aulas.some((a) => a.id === id)) e.aulas.push({ id, nombre: id })
  return e
}

/** Ana dicta 5 horas en cada uno de 4 grupos, todas metidas entre lunes y miércoles (con la regla de hora libre apagada). */
export const cargaDispareja = (): Estado => {
  const orden = [['a', 'b', 'c', 'd', 'a', 'b'], ['c', 'd', 'a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'a', 'b'], ['c'], ['d']]
  const e = mini({
    grupos: ['a', 'b', 'c', 'd'].map((g, i) => grp(g, 6 + i)),
    docentes: [doc('ana', { nombre: 'Ana', cargaSemanal: 20 })],
    asignaciones: ['a', 'b', 'c', 'd'].map((g) => asg('ana', g, 'mat', 5)),
    clases: orden.flatMap((grupos, d) => grupos.map((g, f) => cls(`ana|${g}|mat`, d + 1, f + 1))),
  })
  e.colegio.reglas.horaLibre.activa = false
  return e
}
