import { horasRequeridas } from './asignacion'
import { eliminarArea, sincronizarClases } from './edicion'
import { dictaEn, esMediaTecnica, jornadaDeAsignacion, nuevoId, otraJornada } from './tiempo'
import type { Estado, Grupo, Id } from './tipos'

/** Los programas de media técnica del colegio (Sistemas, Contabilidad…). */
export const programasMT = (e: Estado) => e.areas.filter((a) => esMediaTecnica(e, a.id))

/** El grupo completo ve el programa (o ninguno, con ''); lo asignado de otro programa se quita. */
export const elegirPrograma = (e: Estado, grupoId: Id, programaId: Id): Estado =>
  sincronizarClases({
    ...e,
    grupos: e.grupos.map((g) => (g.id === grupoId ? { ...g, programaMT: programaId || undefined } : g)),
    asignaciones: e.asignaciones.filter((a) => a.grupoId !== grupoId || !esMediaTecnica(e, a.areaId) || a.areaId === programaId),
  })

/**
 * Quién dicta el programa del grupo ('' = nadie), con todas las horas del programa. Un docente de planta de la otra
 * jornada pasa a «mañana y tarde» para poder dictarla.
 */
export const asignarMediaTecnica = (e: Estado, grupoId: Id, docenteId: Id): Estado => {
  const g = e.grupos.find((x) => x.id === grupoId)
  if (!g?.programaMT) return e
  const programa = g.programaMT
  const resto = e.asignaciones.filter((a) => !(a.grupoId === grupoId && a.areaId === programa))
  const previa = e.asignaciones.find((a) => a.grupoId === grupoId && a.areaId === programa)
  if (!docenteId) return sincronizarClases({ ...e, asignaciones: resto })
  const jornada = jornadaDeAsignacion(e, { grupoId, areaId: programa })
  const horas = horasRequeridas({ ...e, asignaciones: resto }, g, programa)
  // Se conserva el id si solo cambia el docente, para que las clases ya ubicadas sigan en su lugar.
  const asignacion = { id: previa?.id ?? `${docenteId}|${grupoId}|${programa}`, docenteId, grupoId, areaId: programa, horas }
  return sincronizarClases({
    ...e,
    asignaciones: [...resto, asignacion],
    docentes: e.docentes.map((d) => (d.id === docenteId && !d.externo && !dictaEn(d, jornada) ? { ...d, jornada: 'ambas' } : d)),
  })
}

/** Un grupo mezclado nuevo del programa: en la jornada contraria a la del grado y con el aula de su primer grupo. */
export const grupoMezcladoNuevo = (e: Estado, programaId: Id, grado: number): Grupo => {
  const primero = e.grupos.find((g) => g.grado === grado && !g.de)
  const programa = e.areas.find((a) => a.id === programaId)?.nombre ?? 'Media técnica'
  return {
    id: nuevoId(), grado, numero: 0, nombre: `${grado}.° ${programa}`, jornada: otraJornada(primero?.jornada ?? 'manana'),
    programaMT: programaId, de: [], aulaId: primero?.aulaId,
  }
}

/** El colegio deja de tener media técnica: se borran sus programas, grupos mezclados y lo asignado. */
export const quitarMediaTecnica = (e: Estado): Estado => {
  const sin = programasMT(e).reduce((x, p) => eliminarArea(x, p.id), e)
  return { ...sin, colegio: { ...sin.colegio, mediaTecnica: false } }
}

/** Horas por semana del programa en un grado; lo ya asignado a sus grupos (con un solo docente) se ajusta. */
export const horasPrograma = (e: Estado, programaId: Id, grado: number, horas: number): Estado => {
  const con = { ...e, intensidad: { ...e.intensidad, [grado]: { ...e.intensidad[grado], [programaId]: horas } } }
  const solas = (grupoId: Id) => e.asignaciones.filter((a) => a.grupoId === grupoId && a.areaId === programaId).length === 1
  return sincronizarClases({
    ...con,
    asignaciones: e.asignaciones.map((a) => {
      const g = e.grupos.find((x) => x.id === a.grupoId)
      return a.areaId === programaId && g?.grado === grado && solas(g.id) ? { ...a, horas: horasRequeridas(con, g, programaId) } : a
    }),
  })
}
