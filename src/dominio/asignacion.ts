import { cargaEnCiclo, cicloDeGrupo, diasHorario, dictaEn, esMediaTecnica, jornadaDeAsignacion, MAX_SEMANA, nivelDeGrado, nombreGrupo } from './tiempo'
export { esMediaTecnica } from './tiempo'
import type { Docente, Estado, Grupo, Id } from './tipos'

export type TipoAviso =
  | 'carga' | 'minimoArea' | 'areaNoAfin' | 'afinConHorasPropias' | 'nivel' | 'intensidad' | 'jornada'
  | 'compartida' | 'excesoGrupo' | 'excesoIntensidad'

export interface Aviso {
  tipo: TipoAviso
  gravedad: 'error' | 'excepcion'
  mensaje: string
  docenteId?: Id
  grupoId?: Id
  areaId?: Id
}

export const esTitular = (d: Docente): boolean => d.nivel === 'primaria' && d.rolPrimaria === 'titular'

const nombreArea = (e: Estado, id: Id): string => e.areas.find((a) => a.id === id)?.nombre ?? 'Área borrada'
const esAfin = (e: Estado, d: Docente, areaId: Id): boolean =>
  e.areas.find((a) => a.id === d.areaId)?.afines.includes(areaId) ?? false

/** Horas del área que el grupo debe recibir en su ciclo. */
export const horasRequeridas = (e: Estado, g: Grupo, areaId: Id): number =>
  ((e.intensidad[g.grado]?.[areaId] ?? 0) * cicloDeGrupo(e, g)) / 5

/** Horas del docente contadas sobre los días del horario completo. */
export const horasDocente = (e: Estado, docenteId: Id) => {
  const d = e.docentes.find((x) => x.id === docenteId)
  const dias = diasHorario(e)
  const r = { total: 0, enArea: 0, enAfines: 0, otras: 0 }
  if (!d) return r
  for (const a of e.asignaciones) {
    if (a.docenteId !== docenteId) continue
    const g = e.grupos.find((x) => x.id === a.grupoId)
    if (!g) continue
    const horas = (a.horas * dias) / cicloDeGrupo(e, g)
    r.total += horas
    if (a.areaId === d.areaId) r.enArea += horas
    else if (esAfin(e, d, a.areaId)) r.enAfines += horas
    else r.otras += horas
  }
  return r
}

const horasAsignadas = (e: Estado, grupoId: Id, areaId: Id): number =>
  e.asignaciones.filter((a) => a.grupoId === grupoId && a.areaId === areaId).reduce((s, a) => s + a.horas, 0)

/** Horas de cada grupo y área que todavía no tienen docente, en horas del ciclo del grupo. */
export const horasSinAsignar = (e: Estado): { grupoId: Id; areaId: Id; horas: number }[] =>
  e.grupos.flatMap((g) =>
    e.areas
      .map((a) => ({ grupoId: g.id, areaId: a.id, horas: horasRequeridas(e, g, a.id) - horasAsignadas(e, g.id, a.id) }))
      .filter((p) => p.horas > 0),
  )

export const validarAsignacion = (e: Estado): Aviso[] => {
  const avisos: Aviso[] = []
  const dias = diasHorario(e)
  const pendientes = horasSinAsignar(e)
  const grupo = (id: Id) => e.grupos.find((g) => g.id === id)

  for (const d of e.docentes) {
    const h = horasDocente(e, d.id)
    const carga = cargaEnCiclo(d, dias)
    const propias = e.asignaciones.filter((a) => a.docenteId === d.id)
    const extra = ((d.horasExtra ?? 0) * dias) / 5
    if (h.total !== carga)
      avisos.push({
        tipo: 'carga', gravedad: 'error', docenteId: d.id,
        mensaje: `${d.nombre} tiene ${h.total} de ${carga} horas${extra ? ` (${carga - extra} de carga más ${extra} extra)` : ''}.`,
      })

    if (!esTitular(d)) {
      const minimo = (e.colegio.reglas.minimoAreaNombramiento * dias) / 5
      if (h.enArea < minimo)
        avisos.push({
          tipo: 'minimoArea', gravedad: 'error', docenteId: d.id, areaId: d.areaId,
          mensaje: `${d.nombre} tiene ${h.enArea} horas en ${nombreArea(e, d.areaId)}; el mínimo es ${minimo}.`,
        })
      for (const areaId of new Set(propias.map((a) => a.areaId)))
        if (areaId !== d.areaId && !esAfin(e, d, areaId))
          avisos.push({
            tipo: 'areaNoAfin', gravedad: 'error', docenteId: d.id, areaId,
            mensaje: `${d.nombre} dicta ${nombreArea(e, areaId)}, que no es su área ni un área afín.`,
          })
      const quedanPropias = pendientes.some((p) => {
        const g = grupo(p.grupoId)
        return p.areaId === d.areaId && !!g && dictaEn(d, jornadaDeAsignacion(e, p)) && nivelDeGrado(g.grado) === d.nivel
      })
      if (h.enAfines > 0 && quedanPropias)
        avisos.push({
          tipo: 'afinConHorasPropias', gravedad: 'error', docenteId: d.id, areaId: d.areaId,
          mensaje: `${d.nombre} dicta áreas afines y aún quedan horas de ${nombreArea(e, d.areaId)} sin docente.`,
        })
    }

    for (const grupoId of new Set(propias.map((a) => a.grupoId))) {
      const g = grupo(grupoId)
      if (!g) continue
      // Cuenta la jornada en que se dicta cada materia (la del grupo, o la otra si va en contrajornada).
      const jornadasAqui = new Set(propias.filter((a) => a.grupoId === grupoId).map((a) => jornadaDeAsignacion(e, a)))
      if (nivelDeGrado(g.grado) !== d.nivel)
        avisos.push({
          tipo: 'nivel', gravedad: 'excepcion', docenteId: d.id, grupoId,
          mensaje: `Excepción: ${d.nombre} es de ${d.nivel} y dicta en ${nombreGrupo(g)}.`,
        })
      if ([...jornadasAqui].some((j) => !dictaEn(d, j)))
        avisos.push({
          tipo: 'jornada', gravedad: 'error', docenteId: d.id, grupoId,
          mensaje: `${d.nombre} trabaja en otra jornada que el grupo ${nombreGrupo(g)}.`,
        })
    }
  }

  const nombreDocente = (id: Id) => e.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  const horas = (n: number) => `${n} ${n === 1 ? 'hora' : 'horas'}`
  const sinContar = (mt: number) => (mt ? ` (sin contar ${mt} de media técnica)` : '')
  for (const g of e.grupos) {
    const nivel = nivelDeGrado(g.grado)
    const { cuentan, mediaTecnica } = horasSemanaGrupo(e, g)
    if (cuentan > MAX_SEMANA[nivel])
      avisos.push({
        tipo: 'excesoGrupo', gravedad: 'error', grupoId: g.id,
        mensaje: `El grupo ${nombreGrupo(g)} tiene ${cuentan} horas por semana asignadas${sinContar(mediaTecnica)}; en ${nivel} el máximo es ${MAX_SEMANA[nivel]}.`,
      })
    for (const a of e.areas) {
      const requeridas = horasRequeridas(e, g, a.id)
      const asignadas = horasAsignadas(e, g.id, a.id)
      const quienes = e.asignaciones.filter((x) => x.grupoId === g.id && x.areaId === a.id && x.horas > 0)
      if (quienes.length > 1) {
        // Varios docentes en la misma materia y grupo: se avisa siempre y se compara con la intensidad.
        const nombres = quienes.map((x) => `${nombreDocente(x.docenteId)} (${x.horas} h)`)
        avisos.push({
          tipo: 'compartida', gravedad: asignadas === requeridas ? 'excepcion' : 'error', grupoId: g.id, areaId: a.id,
          mensaje: `${a.nombre} en ${nombreGrupo(g)} la dictan ${quienes.length} docentes: ${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}. Suman ${asignadas} de ${horas(requeridas)}.`,
        })
        continue
      }
      if (!Number.isInteger(requeridas))
        avisos.push({
          tipo: 'intensidad', gravedad: 'error', grupoId: g.id, areaId: a.id,
          mensaje: `${a.nombre} en ${nombreGrupo(g)} da ${requeridas} horas por ciclo; debe ser un número entero.`,
        })
      else if (asignadas !== requeridas)
        avisos.push({
          tipo: 'intensidad', gravedad: 'error', grupoId: g.id, areaId: a.id,
          mensaje: `${nombreGrupo(g)} recibe ${asignadas} de ${requeridas} horas de ${a.nombre}.`,
        })
    }
  }

  // La intensidad de cada grado (que tenga grupos) tiene que caber en la semana.
  for (const grado of [...new Set(e.grupos.map((g) => g.grado))].sort((x, y) => x - y)) {
    const nivel = nivelDeGrado(grado)
    const { cuentan: suma, mediaTecnica } = intensidadSemanaGrado(e, grado)
    if (suma > MAX_SEMANA[nivel])
      avisos.push({
        tipo: 'excesoIntensidad', gravedad: 'error',
        mensaje: `La intensidad horaria de ${grado}.° suma ${suma} horas por semana${sinContar(mediaTecnica)}; en ${nivel} el máximo es ${MAX_SEMANA[nivel]}.`,
      })
  }
  return avisos
}

export interface Sugerencia {
  grupoId: Id
  areaId: Id
  horas: number
  motivo: 'areaGrupoPropio' | 'areaDireccion' | 'areaNivel' | 'afinGrupoPropio' | 'afinDireccion' | 'afinNivel'
}

/** Horas sin docente que le sirven a este docente para completar su carga, de la más a la menos adecuada. */
export const sugerirParaDocente = (e: Estado, docenteId: Id): Sugerencia[] => {
  const d = e.docentes.find((x) => x.id === docenteId)
  if (!d) return []
  const dias = diasHorario(e)
  let faltan = cargaEnCiclo(d, dias) - horasDocente(e, docenteId).total
  const propios = new Set(e.asignaciones.filter((a) => a.docenteId === docenteId).map((a) => a.grupoId))
  const titular = esTitular(d)

  const opciones = horasSinAsignar(e).flatMap((p) => {
    const g = e.grupos.find((x) => x.id === p.grupoId)!
    if (!dictaEn(d, jornadaDeAsignacion(e, p)) || nivelDeGrado(g.grado) !== d.nivel) return []
    const propia = titular || p.areaId === d.areaId
    if (!propia && !esAfin(e, d, p.areaId)) return []
    const lugar = propios.has(g.id) ? 0 : g.id === d.direccionGrupoId ? 1 : 2
    const motivo = (['GrupoPropio', 'Direccion', 'Nivel'] as const)[lugar]
    return [{ ...p, orden: (propia ? 0 : 3) + lugar, motivo: `${propia ? 'area' : 'afin'}${motivo}` as Sugerencia['motivo'], factor: dias / cicloDeGrupo(e, g) }]
  })
  opciones.sort((a, b) => a.orden - b.orden)

  const sugerencias: Sugerencia[] = []
  for (const o of opciones) {
    const horas = Math.min(o.horas, Math.floor(faltan / o.factor))
    if (horas <= 0) continue
    sugerencias.push({ grupoId: o.grupoId, areaId: o.areaId, horas, motivo: o.motivo })
    faltan -= horas * o.factor
  }
  return sugerencias
}

/** Horas por semana asignadas a un grupo: las que cuentan para el máximo, y las de media técnica aparte. */
export const horasSemanaGrupo = (e: Estado, g: Grupo): { cuentan: number; mediaTecnica: number } => {
  const r = { cuentan: 0, mediaTecnica: 0 }
  for (const a of e.asignaciones)
    if (a.grupoId === g.id) r[esMediaTecnica(e, a.areaId) ? 'mediaTecnica' : 'cuentan'] += (a.horas * 5) / cicloDeGrupo(e, g)
  return r
}

/** La intensidad por semana de un grado: la que cuenta para el máximo, y la de media técnica aparte. */
export const intensidadSemanaGrado = (e: Estado, grado: number): { cuentan: number; mediaTecnica: number } => {
  const r = { cuentan: 0, mediaTecnica: 0 }
  for (const [areaId, h] of Object.entries(e.intensidad[grado] ?? {})) r[esMediaTecnica(e, areaId) ? 'mediaTecnica' : 'cuentan'] += h
  return r
}
