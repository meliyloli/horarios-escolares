import { sesiones } from './cruces'
import { claveDocente, dictaEn, diasHorario, diasVecinos, FRANJAS, nivelDeGrado } from './tiempo'
import type { AjusteDia, Estado, Id, Sesion } from './tipos'

export type EstadoSesion = 'normal' | 'reemplazo' | 'movida' | 'sinDocente' | 'grupoAusente'

/** Una sesión del día con sus ajustes: `docenteId` y `franja` son los efectivos de esa fecha. */
export interface SesionDia extends Sesion {
  docenteOriginalId: Id
  franjaOriginal: number
  situacion: EstadoSesion
}

export const ajusteVacio = (fecha: string, diaCiclo: number): AjusteDia => ({
  fecha, diaCiclo, ausencias: [], reemplazos: [], movimientos: [], gruposAusentes: [],
})

export const ajusteDe = (e: Estado, fecha: string): AjusteDia | undefined => e.ajustes.find((a) => a.fecha === fecha)

const aFecha = (fecha: string) => new Date(`${fecha}T12:00:00`)
const diasHabilesEntre = (desde: string, hasta: string): number => {
  const [a, b] = [aFecha(desde), aFecha(hasta)]
  const paso = a <= b ? 1 : -1
  let n = 0
  for (const d = new Date(a); d.getTime() !== b.getTime(); ) {
    d.setDate(d.getDate() + paso)
    if (d.getDay() >= 1 && d.getDay() <= 5) n += paso
  }
  return n
}

/** Día del ciclo de una fecha: el día de la semana, o en ciclo de 10 la continuación del último ajuste. */
export const diaCicloDeFecha = (e: Estado, fecha: string): number | undefined => {
  const semana = aFecha(fecha).getDay()
  if (Number.isNaN(semana) || semana < 1 || semana > 5) return undefined
  const dias = diasHorario(e)
  const previos = e.ajustes.filter((a) => a.fecha <= fecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const referencia = previos.at(-1) ?? [...e.ajustes].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  if (dias === 5 || !referencia) return semana
  const n = diasHabilesEntre(referencia.fecha, fecha)
  return ((((referencia.diaCiclo - 1 + n) % dias) + dias) % dias) + 1
}

const ausente = (aj: AjusteDia, docenteId: Id, franja: number) =>
  aj.ausencias.some((a) => a.docenteId === docenteId && a.franjas.includes(franja))

/** Las clases de ese día del ciclo con los ajustes de la fecha aplicados. No toca el horario base. */
export const sesionesDelDia = (e: Estado, aj: AjusteDia): SesionDia[] =>
  sesiones(e)
    .filter((s) => s.dia === aj.diaCiclo)
    .map((s) => {
      const franja = aj.movimientos.find((m) => m.claseId === s.claseId)?.franja ?? s.franja
      const reemplazo = aj.reemplazos.find((r) => r.claseId === s.claseId)
      // La ausencia se mide contra la franja del horario base: una clase descubierta sigue descubierta aunque se mueva.
      const situacion: EstadoSesion = aj.gruposAusentes.includes(s.grupoId) ? 'grupoAusente'
        : reemplazo ? 'reemplazo'
        : ausente(aj, s.docenteId, s.franja) ? 'sinDocente'
        : franja !== s.franja ? 'movida'
        : 'normal'
      return { ...s, franja, franjaOriginal: s.franja, docenteOriginalId: s.docenteId, docenteId: reemplazo?.docenteId ?? s.docenteId, situacion }
    })

export const clasesSinDocente = (e: Estado, aj: AjusteDia): SesionDia[] =>
  sesionesDelDia(e, aj).filter((s) => s.situacion === 'sinDocente')

/** Sesiones en las que alguien efectivamente está dictando. */
const dictadas = (ss: SesionDia[]) => ss.filter((s) => s.situacion !== 'sinDocente' && s.situacion !== 'grupoAusente')

export const registroHorasCubiertas = (e: Estado): { docenteId: Id; horas: number }[] => {
  const horas = new Map<Id, number>()
  for (const aj of e.ajustes) for (const r of aj.reemplazos) horas.set(r.docenteId, (horas.get(r.docenteId) ?? 0) + 1)
  return [...horas].map(([docenteId, h]) => ({ docenteId, horas: h })).sort((a, b) => b.horas - a.horas)
}

export interface Candidato {
  docenteId: Id
  motivo: 'area' | 'grupo' | 'otro'
  horasCubiertas: number
}

/**
 * Docentes que pueden cubrir la clase: misma jornada, presentes, libres y disponibles en esa franja,
 * con al menos 2 franjas libres ese día y al menos 1 en el día anterior o el siguiente.
 */
export const candidatosReemplazo = (e: Estado, ajuste: AjusteDia, claseId: Id): Candidato[] => {
  // Se evalúa en la franja del horario base: una reorganización del grupo no cambia a qué hora hay que cubrir,
  // y al elegir un reemplazo esa reorganización se vuelve a calcular.
  const grupoId = e.asignaciones.find((a) => a.id === e.clases.find((c) => c.id === claseId)?.asignacionId)?.grupoId
  const delGrupo = new Set(sesiones(e).filter((s) => s.grupoId === grupoId).map((s) => s.claseId))
  const aj = { ...ajuste, movimientos: ajuste.movimientos.filter((m) => !delGrupo.has(m.claseId)) }
  const delDia = sesionesDelDia(e, aj)
  const clase = delDia.find((s) => s.claseId === claseId)
  const grupo = e.grupos.find((g) => g.id === clase?.grupoId)
  if (!clase || !grupo) return []
  const dias = diasHorario(e)
  const base = sesiones(e)
  // Lo cubierto en otras fechas: el día que se está editando todavía no cuenta.
  const otrasFechas = { ...e, ajustes: e.ajustes.filter((a) => a.fecha !== aj.fecha) }
  const cubiertas = new Map(registroHorasCubiertas(otrasFechas).map((r) => [r.docenteId, r.horas]))
  const orden = { area: 0, grupo: 1, otro: 2 }

  return e.docentes
    .filter((d) => {
      if (d.externo || d.id === clase.docenteOriginalId || !dictaEn(d, clase.jornada)) return false
      if (ausente(aj, d.id, clase.franja) || d.noDisponible.includes(claveDocente(d, aj.diaCiclo, clase.franja, clase.jornada))) return false
      // Las franjas ocupadas se cuentan en la jornada de la clase (la franja 1 de la tarde no es la de la mañana).
      const ocupadas = new Set(dictadas(delDia).filter((s) => s.docenteId === d.id && s.jornada === clase.jornada).map((s) => s.franja))
      if (ocupadas.has(clase.franja) || FRANJAS - ocupadas.size < 2) return false
      return diasVecinos(aj.diaCiclo, dias).some((v) => base.filter((s) => s.docenteId === d.id && s.dia === v).length < FRANJAS)
    })
    .map((d): Candidato => ({
      docenteId: d.id,
      motivo: d.areaId === clase.areaId ? 'area' : e.asignaciones.some((a) => a.docenteId === d.id && a.grupoId === grupo.id) ? 'grupo' : 'otro',
      horasCubiertas: cubiertas.get(d.id) ?? 0,
    }))
    .sort((a, b) => orden[a.motivo] - orden[b.motivo] || a.horasCubiertas - b.horasCubiertas)
}

export interface OpcionReorganizar {
  tipo: 'llegaTarde' | 'saleTemprano'
  grupoId: Id
  /** Franja final de cada clase del grupo que cambia respecto al horario base. */
  movimientos: { claseId: Id; franja: number }[]
  docentesQueCambian: Id[]
  horasSinClase: number
}

const permutaciones = <T>(xs: T[]): T[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))

/**
 * Reacomoda las clases del grupo ese día para que las horas sin docente queden al inicio (llega tarde)
 * o al final (sale temprano). Solo mueve clases cuyo docente está presente, libre y disponible en la nueva franja.
 */
export const opcionesReorganizar = (e: Estado, aj: AjusteDia, grupoId: Id): OpcionReorganizar[] => {
  const delDia = sesionesDelDia(e, aj)
  const grupo = e.grupos.find((g) => g.id === grupoId)
  const suyas = delDia.filter((s) => s.grupoId === grupoId && s.situacion !== 'grupoAusente').sort((a, b) => a.franja - b.franja)
  const descubiertas = suyas.filter((s) => s.situacion === 'sinDocente')
  const cubiertas = suyas.filter((s) => s.situacion !== 'sinDocente')
  const franjas = suyas.map((s) => s.franja)
  if (!grupo || descubiertas.length === 0 || cubiertas.length === 0 || new Set(franjas).size !== franjas.length) return []

  const otras = dictadas(delDia).filter((s) => s.grupoId !== grupoId)
  const cabe = (s: SesionDia, franja: number): boolean => {
    if (franja === s.franja) return true
    const d = e.docentes.find((x) => x.id === s.docenteId)
    if (!d || ausente(aj, d.id, franja) || d.noDisponible.includes(claveDocente(d, aj.diaCiclo, franja, s.jornada))) return false
    return !otras.some(
      (o) => o.franja === franja && o.jornada === s.jornada && (o.docenteId === s.docenteId || (!!s.aulaId && o.aulaId === s.aulaId)),
    )
  }

  const opciones: OpcionReorganizar[] = []
  for (const tipo of ['llegaTarde', 'saleTemprano'] as const) {
    const corte = tipo === 'llegaTarde' ? descubiertas.length : cubiertas.length
    const paraCubiertas = tipo === 'llegaTarde' ? franjas.slice(corte) : franjas.slice(0, corte)
    const paraDescubiertas = tipo === 'llegaTarde' ? franjas.slice(0, corte) : franjas.slice(corte)
    let mejor: number[] | undefined
    let menosMovidas = Infinity
    for (const destino of permutaciones(paraCubiertas)) {
      if (!cubiertas.every((s, i) => cabe(s, destino[i]))) continue
      const movidas = cubiertas.filter((s, i) => s.franja !== destino[i]).length
      if (movidas < menosMovidas) [mejor, menosMovidas] = [destino, movidas]
    }
    if (!mejor) continue
    const finales = [
      ...cubiertas.map((s, i) => ({ s, franja: mejor![i] })),
      ...descubiertas.map((s, i) => ({ s, franja: paraDescubiertas[i] })),
    ]
    opciones.push({
      tipo, grupoId,
      movimientos: finales.filter((f) => f.franja !== f.s.franjaOriginal).map((f) => ({ claseId: f.s.claseId, franja: f.franja })),
      docentesQueCambian: [...new Set(cubiertas.filter((s, i) => s.franja !== mejor![i]).map((s) => s.docenteId))].sort(),
      horasSinClase: descubiertas.length,
    })
  }
  return opciones
}

/** Devuelve el ajuste con la reorganización elegida para ese grupo. */
export const aplicarReorganizacion = (e: Estado, aj: AjusteDia, opcion: OpcionReorganizar): AjusteDia => {
  const delGrupo = new Set(sesiones(e).filter((s) => s.grupoId === opcion.grupoId && s.dia === aj.diaCiclo).map((s) => s.claseId))
  return { ...aj, movimientos: [...aj.movimientos.filter((m) => !delGrupo.has(m.claseId)), ...opcion.movimientos] }
}

/** En primaria se puede marcar que ese día falta todo el grupo. */
export const puedeFaltarGrupo = (e: Estado, grupoId: Id): boolean => {
  const g = e.grupos.find((x) => x.id === grupoId)
  return !!g && nivelDeGrado(g.grado) === 'primaria'
}

export interface Impacto {
  horasCubiertas: number
  horasSinCubrir: number
  gruposLleganTarde: Id[]
  gruposSalenTemprano: Id[]
  gruposAusentes: Id[]
  docentesQueCambian: Id[]
}

export const impactoAjuste = (e: Estado, aj: AjusteDia): Impacto => {
  const delDia = sesionesDelDia(e, aj)
  const sin = delDia.filter((s) => s.situacion === 'sinDocente')
  const tarde: Id[] = []
  const temprano: Id[] = []
  for (const grupoId of new Set(sin.map((s) => s.grupoId))) {
    const suyas = delDia.filter((s) => s.grupoId === grupoId).sort((a, b) => a.franja - b.franja)
    const huecos = suyas.map((s) => s.situacion === 'sinDocente')
    const n = huecos.filter(Boolean).length
    if (n === suyas.length) continue
    if (huecos.slice(0, n).every(Boolean)) tarde.push(grupoId)
    else if (huecos.slice(-n).every(Boolean)) temprano.push(grupoId)
  }
  return {
    horasCubiertas: delDia.filter((s) => s.situacion === 'reemplazo').length,
    horasSinCubrir: sin.length,
    gruposLleganTarde: tarde,
    gruposSalenTemprano: temprano,
    gruposAusentes: [...aj.gruposAusentes],
    docentesQueCambian: [...new Set(dictadas(delDia).filter((s) => s.franja !== s.franjaOriginal).map((s) => s.docenteId))].sort(),
  }
}

const llaveMovimientos = (ms: { claseId: Id; franja: number }[]) => ms.map((m) => `${m.claseId}:${m.franja}`).sort().join()

/**
 * Deja el ajuste coherente con el colegio y consigo mismo: quita ausencias y grupos que ya no existen,
 * reemplazos que ya no corresponden (la clase no quedó descubierta, el reemplazo también falta o falta todo
 * el grupo) y reorganizaciones que dejaron de ser válidas.
 */
export const normalizarAjuste = (e: Estado, aj: AjusteDia): AjusteDia => {
  const docentes = new Set(e.docentes.map((d) => d.id))
  const grupos = new Set(e.grupos.map((g) => g.id))
  const ausencias = aj.ausencias.filter((a) => docentes.has(a.docenteId))
  const gruposAusentes = aj.gruposAusentes.filter((g) => grupos.has(g))
  const base = new Map(sesiones(e).filter((s) => s.dia === aj.diaCiclo).map((s) => [s.claseId, s]))
  const falta = (docenteId: Id, franja: number) => ausencias.some((a) => a.docenteId === docenteId && a.franjas.includes(franja))
  const reemplazos = aj.reemplazos.filter((r) => {
    const s = base.get(r.claseId)
    return !!s && docentes.has(r.docenteId) && falta(s.docenteId, s.franja) && !falta(r.docenteId, s.franja) && !gruposAusentes.includes(s.grupoId)
  })
  // Los movimientos de cada grupo se conservan solo si siguen siendo una reorganización válida de ese grupo.
  const propios = aj.movimientos.filter((m) => base.has(m.claseId))
  let limpio: AjusteDia = { ...aj, ausencias, gruposAusentes, reemplazos, movimientos: [] }
  for (const grupoId of new Set(propios.map((m) => base.get(m.claseId)!.grupoId))) {
    const suyos = propios.filter((m) => base.get(m.claseId)!.grupoId === grupoId)
    if (opcionesReorganizar(e, limpio, grupoId).some((o) => llaveMovimientos(o.movimientos) === llaveMovimientos(suyos)))
      limpio = { ...limpio, movimientos: [...limpio.movimientos, ...suyos] }
  }
  return limpio
}

/** Guarda el ajuste de esa fecha (o lo borra si quedó vacío). Nunca cambia el horario base. */
export const guardarAjuste = (e: Estado, ajuste: AjusteDia): Estado => {
  const aj = normalizarAjuste(e, ajuste)
  const vacio = !aj.ausencias.length && !aj.reemplazos.length && !aj.movimientos.length && !aj.gruposAusentes.length
  const existe = e.ajustes.some((a) => a.fecha === aj.fecha)
  const ajustes = vacio ? e.ajustes.filter((a) => a.fecha !== aj.fecha)
    : existe ? e.ajustes.map((a) => (a.fecha === aj.fecha ? aj : a))
    : [...e.ajustes, aj]
  return { ...e, ajustes }
}
