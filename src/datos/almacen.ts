import { sincronizarClases } from '../dominio/edicion'
import { colegioEjemplo, reglasPorDefecto } from '../dominio/ejemplo'
import type { Borrador, Estado } from '../dominio/tipos'

export const LLAVE = 'horarios-escolares'

const almacen = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined // el navegador puede bloquear el acceso
  }
}

export const exportarRespaldo = (e: Estado): string => JSON.stringify(e, null, 1)

const LISTAS = ['areas', 'grupos', 'docentes', 'aulas', 'asignaciones', 'clases', 'ajustes'] as const
const NO_ES = 'El archivo no es un respaldo de Horarios escolares.'
const DANADO = 'El respaldo está dañado o incompleto y no se puede abrir.'

const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const numero = (x: unknown, porDefecto: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : porDefecto)
const unoDe = <T extends string | number>(x: unknown, validos: readonly T[], porDefecto: T): T => (validos.includes(x as T) ? (x as T) : porDefecto)

/** Completa con valores por defecto lo que le falte a cada dato; lanza si algo no tiene forma de dato. */
const completar = (e: Estado): Estado => {
  const objeto = <T extends { id: string }>(x: unknown): T => {
    if (!x || typeof x !== 'object' || typeof (x as T).id !== 'string') throw new Error(DANADO)
    return x as T
  }
  const jornadas = ['manana', 'tarde'] as const
  const asignaciones = (xs: unknown[]) =>
    xs.map((x) => {
      const a = objeto<Estado['asignaciones'][0]>(x)
      return { ...a, horas: Math.max(0, numero(a.horas, 0)), jornada: a.jornada === 'manana' || a.jornada === 'tarde' ? a.jornada : undefined }
    })
  const clases = (xs: unknown[]) =>
    xs.map((x) => {
      const c = objeto<Estado['clases'][0]>(x)
      return { ...c, dia: numero(c.dia, 0), franja: numero(c.franja, 0), fijada: c.fijada === true }
    })
  const activo: Estado = {
    ...e,
    colegio: {
      ...e.colegio,
      ciclo: unoDe(e.colegio.ciclo, [5, 10] as const, 5),
      modeloAula: unoDe(e.colegio.modeloAula, ['grupo', 'docente', 'mixto', 'libre', 'ninguna'] as const, 'grupo'),
      reglas: { ...reglasPorDefecto(), ...e.colegio.reglas },
    },
    areas: e.areas.map((x) => ({ ...objeto<Estado['areas'][0]>(x), nombre: String(x.nombre ?? ''), afines: lista(x.afines) as string[] })),
    grupos: e.grupos.map((x) => {
      const g = objeto<Estado['grupos'][0]>(x)
      return { ...g, grado: Math.min(11, Math.max(1, numero(g.grado, 6))), numero: numero(g.numero, 1), jornada: unoDe(g.jornada, jornadas, 'manana'), ciclo: g.ciclo === 5 || g.ciclo === 10 ? g.ciclo : undefined }
    }),
    docentes: e.docentes.map((x) => {
      const d = objeto<Estado['docentes'][0]>(x)
      return {
        ...d, nombre: String(d.nombre ?? ''), areaId: String(d.areaId ?? ''), nivel: unoDe(d.nivel, ['primaria', 'bachillerato'] as const, 'bachillerato'),
        jornada: unoDe(d.jornada, [...jornadas, 'ambas'] as const, 'manana'), cargaSemanal: numero(d.cargaSemanal, 22), noDisponible: lista(d.noDisponible) as string[],
      }
    }),
    aulas: e.aulas.map((x) => ({ ...objeto<Estado['aulas'][0]>(x), nombre: String(x.nombre ?? '') })),
    asignaciones: asignaciones(e.asignaciones),
    clases: clases(e.clases),
    nombreHorario: typeof e.nombreHorario === 'string' ? e.nombreHorario : undefined,
    borradores: undefined,
    ajustes: (e.ajustes as unknown[]).flatMap((x) => {
      const aj = x as Estado['ajustes'][0]
      if (!aj || typeof aj.fecha !== 'string') return []
      return [{
        fecha: aj.fecha, diaCiclo: numero(aj.diaCiclo, 1), ausencias: lista(aj.ausencias) as Estado['ajustes'][0]['ausencias'],
        reemplazos: lista(aj.reemplazos) as Estado['ajustes'][0]['reemplazos'], movimientos: lista(aj.movimientos) as Estado['ajustes'][0]['movimientos'],
        gruposAusentes: lista(aj.gruposAusentes) as string[],
        ...(Array.isArray(aj.decisiones) ? { decisiones: aj.decisiones } : {}),
      }]
    }),
  }
  const sinVersiones = { borradores: undefined, nombreHorario: undefined, ajustes: [], ultimoRespaldo: undefined }
  // Cada versión es una copia completa. Una dañada se descarta sin impedir que se abra el resto del respaldo.
  const borradores = Array.isArray(e.borradores)
    ? (e.borradores as unknown[]).flatMap((x) => {
        const b = x as Partial<Borrador> & { asignaciones?: unknown; clases?: unknown }
        if (!b || typeof b !== 'object' || typeof b.id !== 'string') return []
        try {
          // Formato anterior: solo traía la asignación y el horario; lo demás se toma de la versión en uso.
          const estado = b.estado !== undefined
            ? { ...desdeDato(b.estado), ...sinVersiones }
            : sincronizarClases({ ...activo, ...sinVersiones, asignaciones: asignaciones(lista(b.asignaciones)), clases: clases(lista(b.clases)) })
          return [{ id: b.id, nombre: String(b.nombre ?? 'Versión'), guardado: String(b.guardado ?? ''), estado }]
        } catch {
          return []
        }
      })
    : undefined
  return { ...activo, borradores }
}

/** Convierte el texto de un respaldo en un estado. Lanza un Error con mensaje para el usuario si no sirve. */
export const importarRespaldo = (texto: string): Estado => {
  let dato: unknown
  try {
    dato = JSON.parse(texto)
  } catch {
    throw new Error(NO_ES)
  }
  return desdeDato(dato)
}

/** Un estado leído de un respaldo (o de una versión guardada dentro de él), ya revisado y completo. */
function desdeDato(dato: unknown): Estado {
  const e = dato as Partial<Estado>
  if (!dato || typeof dato !== 'object' || Array.isArray(dato) || e.version !== 1) throw new Error(NO_ES)
  const reglas = e.colegio?.reglas
  const completo =
    LISTAS.every((k) => Array.isArray(e[k])) &&
    !!e.intensidad && typeof e.intensidad === 'object' &&
    typeof e.colegio?.nombre === 'string' &&
    !!reglas?.maxMateriaDia && !!reglas.maxDocenteDia && !!reglas.horaLibre && typeof reglas.minimoAreaNombramiento === 'number'
  if (!completo) throw new Error(DANADO)
  try {
    return sincronizarClases(completar(e as Estado))
  } catch {
    throw new Error(DANADO) // cualquier dato con forma inesperada: mensaje claro, nunca un error técnico
  }
}

/** Lo guardado en este navegador, o el colegio de ejemplo la primera vez. */
export const cargarEstado = (): Estado => {
  const guardado = almacen()?.getItem(LLAVE)
  if (!guardado) return colegioEjemplo()
  try {
    return importarRespaldo(guardado)
  } catch {
    // No se pisa lo que había: queda aparte por si se puede rescatar.
    almacen()?.setItem(`${LLAVE}-recuperar`, guardado)
    return colegioEjemplo()
  }
}

/** Devuelve false si el navegador no dejó guardar (sin almacenamiento o lleno). */
export const guardarEstado = (e: Estado): boolean => {
  try {
    const a = almacen()
    if (!a) return false
    a.setItem(LLAVE, JSON.stringify(e))
    return true
  } catch {
    return false
  }
}

/** Copia de lo que había guardado cuando no se pudo leer (ver cargarEstado), o null. */
export const copiaPorRecuperar = (): string | null => almacen()?.getItem(`${LLAVE}-recuperar`) ?? null
export const olvidarCopiaPorRecuperar = (): void => almacen()?.removeItem(`${LLAVE}-recuperar`)
