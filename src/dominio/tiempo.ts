import type { Asignacion, Ciclo, Docente, Estado, Grupo, Id, Jornada, Nivel } from './tipos'

export const FRANJAS = 6
/** Horas de clase por semana que caben en un grupo. */
export const MAX_SEMANA: Record<Nivel, number> = { primaria: 25, bachillerato: 30 }
export const DESCANSOS_DESPUES_DE = [2, 4]

export const clave = (dia: number, franja: number): string => `${dia}-${franja}`

export const nivelDeGrado = (grado: number): Nivel => (grado <= 5 ? 'primaria' : 'bachillerato')

export const nombreGrupo = (g: Grupo): string => `${g.grado}-${g.numero}`

export const cicloDeGrupo = (e: Estado, g: Grupo): Ciclo => g.ciclo ?? e.colegio.ciclo

export const diasHorario = (e: Estado): Ciclo =>
  e.colegio.ciclo === 10 || e.grupos.some((g) => g.ciclo === 10) ? 10 : 5

/** Días del horario que ocupa una clase puesta en `dia` del ciclo del grupo. */
export const diasOcupados = (dia: number, cicloGrupo: Ciclo, dias: Ciclo): number[] =>
  cicloGrupo < dias ? [dia, dia + 5] : [dia]

/** Horas que el docente debe tener en el horario completo: su carga más sus horas extra. */
export const cargaEnCiclo = (d: Docente, dias: Ciclo): number => ((d.cargaSemanal + (d.horasExtra ?? 0)) * dias) / 5

/** Cuántas franjas está disponible el docente cada día del horario (posición 0 = día 1). */
export const franjasDisponibles = (d: Docente, dias: number): number[] => {
  const bloqueadas = new Set(d.noDisponible)
  return Array.from({ length: dias }, (_, i) =>
    jornadasDe(d).flatMap((j) => Array.from({ length: FRANJAS }, (_, f) => claveDocente(d, i + 1, f + 1, j))).filter((k) => !bloqueadas.has(k)).length)
}

/** Las jornadas en que dicta el docente: la suya, o las dos si tiene horario intermedio. */
export const jornadasDe = (d: Docente): Jornada[] => (d.jornada === 'ambas' ? ['manana', 'tarde'] : [d.jornada])

export const otraJornada = (j: Jornada): Jornada => (j === 'manana' ? 'tarde' : 'manana')

/** ¿El área es de media técnica? Es una jornada extra: va en la otra jornada y no cuenta en los máximos del grupo. */
export const esMediaTecnica = (e: Estado, areaId: Id): boolean => {
  const a = e.areas.find((x) => x.id === areaId)
  // Si nadie la marcó ni la desmarcó, un área llamada «Media técnica…» lo es.
  return a?.mediaTecnica ?? (!!a && /media\s*t[eé]cnica/i.test(a.nombre))
}

/**
 * La jornada de las clases de una asignación: la que se le eligió (contrajornada); si no, la media técnica va en la
 * otra jornada del grupo (es una jornada extra) y lo demás en la del grupo.
 */
export const jornadaDeAsignacion = (e: Estado, a: Pick<Asignacion, 'grupoId' | 'areaId' | 'jornada'>): Jornada => {
  if (a.jornada) return a.jornada
  const base = e.grupos.find((g) => g.id === a.grupoId)?.jornada ?? 'manana'
  return esMediaTecnica(e, a.areaId) ? otraJornada(base) : base
}

/** Las jornadas en que un grupo tiene clases: la suya y, si alguna materia va en contrajornada, la otra. */
export const jornadasDeGrupo = (e: Estado, g: Grupo): Jornada[] => {
  const otras = e.asignaciones.some((a) => a.grupoId === g.id && jornadaDeAsignacion(e, a) !== g.jornada)
  return otras ? ['manana', 'tarde'] : [g.jornada]
}

/** Las jornadas en que el docente tiene clases asignadas: las dos si tiene horario intermedio o dicta en la otra (media técnica, contrajornada). */
export const jornadasConClase = (e: Estado, d: Docente): Jornada[] => {
  if (d.jornada === 'ambas') return ['manana', 'tarde']
  const js = new Set<Jornada>([d.jornada, ...e.asignaciones.filter((a) => a.docenteId === d.id && a.horas > 0).map((a) => jornadaDeAsignacion(e, a))])
  return js.size > 1 ? ['manana', 'tarde'] : [d.jornada]
}

/** ¿El docente puede dictar a grupos de esa jornada? */
export const dictaEn = (d: Docente, j: Jornada): boolean => d.jornada === 'ambas' || d.jornada === j

/** Clave de disponibilidad de una franja: en un docente de dos jornadas, la tarde se marca aparte ("dia-franja-t"). */
export const claveDocente = (d: Docente, dia: number, franja: number, j: Jornada): string =>
  d.jornada === 'ambas' && j === 'tarde' ? `${clave(dia, franja)}-t` : clave(dia, franja)

/** El día 10 y el día 1 no son contiguos. */
export const diasVecinos = (dia: number, dias: Ciclo): number[] =>
  [dia - 1, dia + 1].filter((d) => d >= 1 && d <= dias)

export const nuevoId = (): Id => crypto.randomUUID().slice(0, 8)

const SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
/** "Lunes"… en ciclo de 5 días; "Día 1"… en ciclo de 10. */
export const nombreDia = (dia: number, dias: Ciclo): string => (dias === 5 && SEMANA[dia - 1]) || `Día ${dia}`
