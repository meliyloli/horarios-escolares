import { aulaDeClase, sesiones } from './cruces'
import type { Estado, Id } from './tipos'

/**
 * Modelo de aula "libre": a cada clase de un docente sin aula fija le da un aula que esté libre a esa hora,
 * incluida la de un docente con aula fija cuando no tiene clase. Solo toca clases sin aula o cuya aula quedó
 * ocupada por otra clase; nunca cambia un aula que sigue libre. Con `solo`, se limita a esas clases.
 */
export const repartirAulas = (e: Estado, solo?: Set<Id>): Estado => {
  if (e.colegio.modeloAula !== 'libre') return e
  const conDueno = new Set(e.docentes.map((d) => d.aulaId).filter(Boolean))
  const fijo = new Set(e.docentes.filter((d) => d.aulaId).map((d) => d.id))
  const todas = sesiones(e)
  // La misma aula en la mañana y en la tarde son dos lugares distintos (cuenta la jornada de la clase, no la del grupo).
  const llave = (aulaId: Id, jornada: string, dia: number, franja: number) => `${aulaId}/${jornada}/${dia}/${franja}`

  // Quién ocupa cada aula en cada franja. Si dos clases chocan, la primera se queda.
  const ocupa = new Map<string, Id>()
  for (const s of todas) {
    const k = s.aulaId && llave(s.aulaId, s.jornada, s.dia, s.franja)
    if (k && !ocupa.has(k)) ocupa.set(k, s.claseId)
  }
  const sesionesDe = new Map<Id, typeof todas>()
  for (const s of todas) sesionesDe.set(s.claseId, [...(sesionesDe.get(s.claseId) ?? []), s])
  const aulaNueva = new Map<Id, Id>()
  const aulaActual = (claseId: Id, guardada?: Id) => aulaNueva.get(claseId) ?? guardada
  const libre = (aulaId: Id, claseId: Id) =>
    sesionesDe.get(claseId)!.every((s) => (ocupa.get(llave(aulaId, s.jornada, s.dia, s.franja)) ?? claseId) === claseId)

  const orden = [...e.clases].sort((a, b) => a.dia - b.dia || a.franja - b.franja)
  for (const c of orden) {
    const suyas = sesionesDe.get(c.id)
    if (!suyas || fijo.has(suyas[0].docenteId) || (solo && !solo.has(c.id))) continue
    if (c.aulaId && libre(c.aulaId, c.id)) continue
    const [s] = suyas
    // Preferencias: el aula donde el grupo ya está en la franja de al lado, luego aulas sin dueño, luego las demás.
    const vecina = e.clases.find((o) => {
      const os = sesionesDe.get(o.id)?.[0]
      return os && o.id !== c.id && os.grupoId === s.grupoId && o.dia === c.dia && Math.abs(o.franja - c.franja) === 1
    })
    const deAlLado = vecina && (aulaActual(vecina.id, aulaDeClase(e, vecina)))
    const candidatas = e.aulas.filter((a) => libre(a.id, c.id))
    const elegida = candidatas.find((a) => a.id === deAlLado) ?? candidatas.find((a) => !conDueno.has(a.id)) ?? candidatas[0]
    if (!elegida) continue
    for (const x of suyas) {
      if (c.aulaId && ocupa.get(llave(c.aulaId, x.jornada, x.dia, x.franja)) === c.id) ocupa.delete(llave(c.aulaId, x.jornada, x.dia, x.franja))
      ocupa.set(llave(elegida.id, x.jornada, x.dia, x.franja), c.id)
    }
    aulaNueva.set(c.id, elegida.id)
  }
  return aulaNueva.size === 0 ? e : { ...e, clases: e.clases.map((c) => (aulaNueva.has(c.id) ? { ...c, aulaId: aulaNueva.get(c.id) } : c)) }
}
