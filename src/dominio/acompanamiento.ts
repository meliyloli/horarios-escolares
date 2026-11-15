import { sesiones } from './cruces'
import { claveDocente, diasHorario, dictaEn, franjasDisponibles, nombreDia } from './tiempo'
import type { AjusteDia, Descanso, Docente, Estado, Id, Jornada, Turno, Zona } from './tipos'

/** La pareja fija de una zona, solo si ya están elegidos los dos docentes (y son distintos). */
export const parejaDe = (z: Zona): [Id, Id] | undefined => (z.pareja && z.pareja[0] && z.pareja[1] && z.pareja[0] !== z.pareja[1] ? z.pareja : undefined)

/** Las franjas que rodean cada descanso: el 1.º va entre la 2 y la 3; el 2.º, entre la 4 y la 5. */
const ALREDEDOR: Record<Descanso, [number, number]> = { 1: [2, 3], 2: [4, 5] }

/** Qué se sabe de cada docente para repartir: qué días tiene clase en cada jornada y cuánto espacio libre tiene. */
const datosDocentes = (e: Estado) => {
  const dias = diasHorario(e)
  const ses = sesiones(e)
  const conClase = new Set(ses.map((s) => `${s.docenteId}|${s.jornada}|${s.dia}`))
  const horas = new Map<Id, number>()
  for (const s of ses) horas.set(s.docenteId, (horas.get(s.docenteId) ?? 0) + 1)
  /** Espacio libre en el colegio: franjas en que está disponible menos sus clases (al menos 1). */
  const peso = (d: Docente) => Math.max(1, franjasDisponibles(d, dias).reduce((n, x) => n + x, 0) - (horas.get(d.id) ?? 0))
  /** Está en el colegio en ese descanso: ese día tiene clase en esa jornada y no está bloqueado justo antes o después. */
  const presente = (d: Docente, j: Jornada, dia: number, k: Descanso) =>
    dictaEn(d, j) && conClase.has(`${d.id}|${j}|${dia}`) && ALREDEDOR[k].some((f) => !d.noDisponible.includes(claveDocente(d, dia, f, j)))
  return { dias, peso, presente, horas }
}

/**
 * Reparte los turnos de acompañamiento de todas las zonas en cada descanso de cada día del ciclo.
 * Elige a quien ese día está en el colegio y tiene, en proporción, menos turnos para su espacio libre
 * (quien tiene menos horas de clase cuida más). Nadie está en dos zonas en el mismo descanso; en una zona
 * álgida nadie repite el día anterior ni el siguiente; una zona con pareja fija solo la cubren esos dos.
 */
export const repartirAcompanamiento = (e: Estado): Estado => {
  const zonas = e.acompanamiento?.zonas ?? []
  const { dias, peso, presente } = datosDocentes(e)
  const turnos: Turno[] = []
  const cuenta = new Map<Id, number>()
  const ocupado = new Set<string>() // docente|jornada|dia|descanso
  const algidaEn = new Set<string>() // zona|docente|dia
  // En una zona con pareja fija los dos se dividen los días: quien cubre un día cubre todos sus descansos.
  const delDia = new Map<string, Id>() // zona|dia → docente
  // Primero las zonas con pareja (solo ellos pueden cubrirlas) y las álgidas (las más restringidas).
  const orden = [...zonas].sort((a, b) => Number(!!parejaDe(b)) - Number(!!parejaDe(a)) || Number(!!b.algida) - Number(!!a.algida))
  for (let dia = 1; dia <= dias; dia++)
    for (const k of [1, 2] as Descanso[])
      for (const z of orden) {
        if (!z.descansos.includes(k)) continue
        const elegidos: Id[] = []
        const libre = (d: Docente) => !ocupado.has(`${d.id}|${z.jornada}|${dia}|${k}`) && !elegidos.includes(d.id)
        const sinRepetir = (d: Docente) => !z.algida || ![dia - 1, dia + 1].some((v) => algidaEn.has(`${z.id}|${d.id}|${v}`))
        const pareja = parejaDe(z)
        const base = pareja ? e.docentes.filter((d) => pareja.includes(d.id)) : e.docentes
        // Del más estricto al más flexible: si nadie cumple todo, se relaja lo que haga falta (y la app lo avisa).
        const filtros = [(d: Docente) => libre(d) && presente(d, z.jornada, dia, k) && sinRepetir(d), (d: Docente) => libre(d) && presente(d, z.jornada, dia, k), libre]
        for (let n = 0; n < z.personas; n++) {
          const yaEseDia = pareja && z.personas === 1 ? base.find((d) => d.id === delDia.get(`${z.id}|${dia}`)) : undefined
          const candidatos = yaEseDia && libre(yaEseDia) ? [yaEseDia] : filtros.map((f) => base.filter(f)).find((c) => c.length > 0) ?? []
          const mejor = candidatos.sort((a, b) => ((cuenta.get(a.id) ?? 0) + 1) / peso(a) - ((cuenta.get(b.id) ?? 0) + 1) / peso(b) || a.nombre.localeCompare(b.nombre))[0]
          if (!mejor) break
          elegidos.push(mejor.id)
          cuenta.set(mejor.id, (cuenta.get(mejor.id) ?? 0) + 1)
          ocupado.add(`${mejor.id}|${z.jornada}|${dia}|${k}`)
          if (z.algida) algidaEn.add(`${z.id}|${mejor.id}|${dia}`)
          if (pareja) delDia.set(`${z.id}|${dia}`, mejor.id)
        }
        turnos.push({ zonaId: z.id, dia, descanso: k, docenteIds: elegidos })
      }
  return { ...e, acompanamiento: { zonas, turnos } }
}

/** Turnos de cada docente frente a lo que le tocaría en proporción a su espacio libre. */
export const cargaAcompanamiento = (e: Estado): { docenteId: Id; turnos: number; horas: number; proporcional: number }[] => {
  const { peso, horas } = datosDocentes(e)
  const turnos = e.acompanamiento?.turnos ?? []
  const total = turnos.reduce((n, t) => n + t.docenteIds.length, 0)
  const conTurnos = e.docentes.filter((d) => turnos.some((t) => t.docenteIds.includes(d.id)) || !e.acompanamiento?.zonas.some((z) => parejaDe(z)))
  const sumaPesos = conTurnos.reduce((n, d) => n + peso(d), 0) || 1
  return e.docentes.map((d) => ({
    docenteId: d.id,
    turnos: turnos.filter((t) => t.docenteIds.includes(d.id)).length,
    horas: horas.get(d.id) ?? 0,
    proporcional: Math.round(((total * peso(d)) / sumaPesos) * 10) / 10,
  }))
}

/** Lo que no cuadra en los turnos (por ejemplo, después de cambiarlos a mano). */
export const avisosAcompanamiento = (e: Estado): string[] => {
  const zonas = e.acompanamiento?.zonas ?? []
  const turnos = e.acompanamiento?.turnos ?? []
  if (turnos.length === 0) return []
  const { dias, presente } = datosDocentes(e)
  const docente = (id: Id) => e.docentes.find((d) => d.id === id)
  const zona = (id: Id) => zonas.find((z) => z.id === id)
  const cuando = (t: Turno) => `el ${nombreDia(t.dia, dias).toLowerCase()} en el ${t.descanso === 1 ? 'primer' : 'segundo'} descanso`
  const avisos: string[] = []
  for (const t of turnos) {
    const z = zona(t.zonaId)
    if (!z) continue
    if (t.docenteIds.length < z.personas) avisos.push(`${z.nombre} queda con ${t.docenteIds.length} de ${z.personas} ${z.personas === 1 ? 'docente' : 'docentes'} ${cuando(t)}.`)
    for (const id of t.docenteIds) {
      const d = docente(id)
      if (!d) continue
      if (!presente(d, z.jornada, t.dia, t.descanso)) avisos.push(`${d.nombre} acompaña ${z.nombre} ${cuando(t)}, pero ese día no tiene clase en esa jornada o no está disponible.`)
      if (parejaDe(z) && !parejaDe(z)!.includes(id)) avisos.push(`${d.nombre} acompaña ${z.nombre} ${cuando(t)}, que es solo de su pareja fija.`)
      const otra = turnos.find((x) => x !== t && x.dia === t.dia && x.descanso === t.descanso && zona(x.zonaId)?.jornada === z.jornada && x.docenteIds.includes(id))
      if (otra && turnos.indexOf(otra) > turnos.indexOf(t)) avisos.push(`${d.nombre} está en dos zonas a la vez ${cuando(t)} (${z.nombre} y ${zona(otra.zonaId)?.nombre}).`)
      if (z.algida && turnos.some((x) => x.zonaId === z.id && x.dia === t.dia + 1 && x.docenteIds.includes(id)))
        avisos.push(`${d.nombre} repite ${z.nombre}, que es álgida, dos días seguidos (${nombreDia(t.dia, dias).toLowerCase()} y ${nombreDia(t.dia + 1, dias).toLowerCase()}).`)
    }
  }
  return [...new Set(avisos)]
}

/**
 * Turnos de acompañamiento que deja sin cubrir un docente ausente ese día (incapacidad o permiso),
 * con una sugerencia de quién puede cubrirlo: alguien en el colegio, libre en ese descanso y con menos turnos.
 */
export const turnosSinCubrir = (e: Estado, aj: AjusteDia): { zonaId: Id; descanso: Descanso; ausente: Id; sugerido?: Id }[] => {
  const zonas = e.acompanamiento?.zonas ?? []
  const turnos = (e.acompanamiento?.turnos ?? []).filter((t) => t.dia === aj.diaCiclo)
  if (turnos.length === 0 || aj.ausencias.length === 0) return []
  const { peso, presente } = datosDocentes(e)
  const cuenta = new Map<Id, number>()
  for (const t of e.acompanamiento!.turnos) for (const id of t.docenteIds) cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
  const falta = (id: Id, k: Descanso) => aj.ausencias.some((a) => a.docenteId === id && ALREDEDOR[k].some((f) => a.franjas.includes(f)))
  const ocupado = new Set(turnos.flatMap((t) => t.docenteIds.map((id) => `${id}|${t.descanso}`)))
  const r: { zonaId: Id; descanso: Descanso; ausente: Id; sugerido?: Id }[] = []
  for (const t of turnos) {
    const z = zonas.find((x) => x.id === t.zonaId)
    if (!z) continue
    for (const ausente of t.docenteIds.filter((id) => falta(id, t.descanso))) {
      const sugerido = e.docentes
        .filter((d) => !falta(d.id, t.descanso) && !ocupado.has(`${d.id}|${t.descanso}`) && presente(d, z.jornada, t.dia, t.descanso))
        .sort((a, b) => ((cuenta.get(a.id) ?? 0) + 1) / peso(a) - ((cuenta.get(b.id) ?? 0) + 1) / peso(b) || a.nombre.localeCompare(b.nombre))[0]
      if (sugerido) ocupado.add(`${sugerido.id}|${t.descanso}`)
      r.push({ zonaId: z.id, descanso: t.descanso, ausente, sugerido: sugerido?.id })
    }
  }
  return r
}

/** Una zona nueva con valores comunes. */
export const zonaNueva = (id: Id, nombre: string, jornada: Jornada = 'manana'): Zona => ({ id, nombre, personas: 1, descansos: [1, 2], jornada })

