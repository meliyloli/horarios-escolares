import { cicloDeGrupo, diasHorario, FRANJAS, jornadaDeAsignacion, nombreGrupo } from './tiempo'
import { lejania } from './nombres'
import type { Ciclo, Clase, Docente, Estado, Id } from './tipos'

const grupoDeClase = (e: Estado, c: Clase) => {
  const a = e.asignaciones.find((x) => x.id === c.asignacionId)
  return e.grupos.find((g) => g.id === a?.grupoId)
}

/** Mueve una clase. Si el grupo ya tiene clase en el destino, las intercambia. Nunca impide el cambio. */
export const moverClase = (e: Estado, claseId: Id, dia: number, franja: number): Estado => {
  const clase = e.clases.find((c) => c.id === claseId)
  const grupo = clase && grupoDeClase(e, clase)
  if (!clase || !grupo) return e
  const ciclo = cicloDeGrupo(e, grupo)
  const destino = dia > ciclo ? dia - 5 : dia
  // Solo se intercambia con una clase del grupo en la misma jornada: la franja 3 de la tarde no es la de la mañana.
  const jornadaDe = (c: Clase) => {
    const a = e.asignaciones.find((x) => x.id === c.asignacionId)
    return a && jornadaDeAsignacion(e, a)
  }
  const ocupante = e.clases.find(
    (c) => c.id !== claseId && c.dia === destino && c.franja === franja && grupoDeClase(e, c)?.id === grupo.id && jornadaDe(c) === jornadaDe(clase),
  )
  return {
    ...e,
    clases: e.clases.map((c) =>
      c.id === claseId ? { ...c, dia: destino, franja }
      : c.id === ocupante?.id ? { ...c, dia: clase.dia, franja: clase.franja }
      : c,
    ),
  }
}

export const cambiarClase = (e: Estado, claseId: Id, cambios: Partial<Pick<Clase, 'aulaId' | 'fijada'>>): Estado => ({
  ...e,
  clases: e.clases.map((c) => (c.id === claseId ? { ...c, ...cambios } : c)),
})

/** Deja las clases coherentes con la asignación y el ciclo: quita huérfanas, sobrantes y fuera de rango. */
export const sincronizarClases = (e: Estado): Estado => {
  const dias = diasHorario(e)
  const validas = e.clases.filter((c) => {
    const g = grupoDeClase(e, c)
    const a = e.asignaciones.find((x) => x.id === c.asignacionId)
    return g && a && e.docentes.some((d) => d.id === a.docenteId) && c.dia >= 1 && c.dia <= cicloDeGrupo(e, g) && c.franja >= 1 && c.franja <= FRANJAS
  })
  const sobran = new Set<Id>()
  for (const a of e.asignaciones) {
    const suyas = validas.filter((c) => c.asignacionId === a.id)
    const quitar = [...suyas.filter((c) => !c.fijada).reverse(), ...suyas.filter((c) => c.fijada).reverse()]
    quitar.slice(0, Math.max(0, suyas.length - a.horas)).forEach((c) => sobran.add(c.id))
  }
  const clases = validas.filter((c) => !sobran.has(c.id))
  const vivas = new Set(clases.map((c) => c.id))
  const docentes = new Set(e.docentes.map((d) => d.id))
  const grupos = new Set(e.grupos.map((g) => g.id))
  // Los turnos de acompañamiento pierden a los docentes borrados y los días que ya no existen en el ciclo.
  const acompanamiento = e.acompanamiento && {
    zonas: e.acompanamiento.zonas.map((z) => (z.pareja && !z.pareja.every((id) => !id || docentes.has(id)) ? { ...z, pareja: undefined } : z)),
    turnos: e.acompanamiento.turnos
      .filter((t) => t.dia <= dias && e.acompanamiento!.zonas.some((z) => z.id === t.zonaId))
      .map((t) => (t.docenteIds.every((id) => docentes.has(id)) ? t : { ...t, docenteIds: t.docenteIds.filter((id) => docentes.has(id)) })),
  }
  return {
    ...e,
    clases,
    ...(acompanamiento ? { acompanamiento } : {}),
    docentes: e.docentes.map((d) => ({ ...d, noDisponible: d.noDisponible.filter((k) => Number(k.split('-')[0]) <= dias) })),
    // Los días de incapacidad pierden lo que apuntaba a algo borrado; si su día del ciclo ya no existe, se quitan.
    ajustes: e.ajustes
      .filter((aj) => aj.diaCiclo <= dias)
      .map((aj) => ({
        ...aj,
        ausencias: aj.ausencias.filter((a) => docentes.has(a.docenteId)),
        reemplazos: aj.reemplazos.filter((r) => vivas.has(r.claseId) && docentes.has(r.docenteId)),
        movimientos: aj.movimientos.filter((m) => vivas.has(m.claseId)),
        gruposAusentes: aj.gruposAusentes.filter((g) => grupos.has(g)),
      })),
  }
}

export const eliminarDocente = (e: Estado, id: Id): Estado =>
  sincronizarClases({
    ...e,
    docentes: e.docentes.filter((d) => d.id !== id),
    asignaciones: e.asignaciones.filter((a) => a.docenteId !== id),
    ajustes: e.ajustes.map((aj) => ({
      ...aj,
      ausencias: aj.ausencias.filter((x) => x.docenteId !== id),
      reemplazos: aj.reemplazos.filter((r) => r.docenteId !== id),
    })),
  })

export const eliminarGrupo = (e: Estado, id: Id): Estado =>
  sincronizarClases({
    ...e,
    grupos: e.grupos.filter((g) => g.id !== id),
    asignaciones: e.asignaciones.filter((a) => a.grupoId !== id),
    docentes: e.docentes.map((d) => (d.direccionGrupoId === id ? { ...d, direccionGrupoId: undefined } : d)),
    ajustes: e.ajustes.map((aj) => ({ ...aj, gruposAusentes: aj.gruposAusentes.filter((g) => g !== id) })),
  })

/** Los docentes nombrados en el área quedan sin área (''), para que el usuario elija otra. */
export const eliminarArea = (e: Estado, id: Id): Estado =>
  sincronizarClases({
    ...e,
    areas: e.areas.filter((a) => a.id !== id).map((a) => ({ ...a, afines: a.afines.filter((x) => x !== id) })),
    intensidad: Object.fromEntries(
      Object.entries(e.intensidad).map(([grado, horas]) => [grado, Object.fromEntries(Object.entries(horas).filter(([areaId]) => areaId !== id))]),
    ),
    asignaciones: e.asignaciones.filter((a) => a.areaId !== id),
    docentes: e.docentes.map((d) => (d.areaId === id ? { ...d, areaId: '' } : d)),
  })

export const eliminarAula = (e: Estado, id: Id): Estado =>
  sincronizarClases({
    ...e,
    aulas: e.aulas.filter((a) => a.id !== id),
    grupos: e.grupos.map((g) => (g.aulaId === id ? { ...g, aulaId: undefined } : g)),
    docentes: e.docentes.map((d) => (d.aulaId === id ? { ...d, aulaId: undefined } : d)),
    clases: e.clases.map((c) => (c.aulaId === id ? { ...c, aulaId: undefined } : c)),
  })

const escalarHoras = (e: Estado, grupos: Set<Id>, factor: number) =>
  e.asignaciones.map((a) => (grupos.has(a.grupoId) ? { ...a, horas: Math.round(a.horas * factor) } : a))

/** Cambia el ciclo del colegio y ajusta las horas de la asignación de los grupos que lo heredan (se duplican o se dividen). */
export const cambiarCicloColegio = (e: Estado, ciclo: Ciclo): Estado => {
  if (e.colegio.ciclo === ciclo) return e
  const heredan = new Set(e.grupos.filter((g) => !g.ciclo).map((g) => g.id))
  return {
    ...e, colegio: { ...e.colegio, ciclo }, asignaciones: escalarHoras(e, heredan, ciclo / e.colegio.ciclo)
  }
}

/** Cambia el ciclo de un grupo (undefined = el del colegio) y ajusta sus horas en la asignación. */
export const cambiarCicloGrupo = (e: Estado, grupoId: Id, ciclo: Ciclo | undefined): Estado => {
  const g = e.grupos.find((x) => x.id === grupoId)
  if (!g) return e
  const factor = (ciclo ?? e.colegio.ciclo) / cicloDeGrupo(e, g)
  return {
    ...e,
    grupos: e.grupos.map((x) => (x.id === grupoId ? { ...x, ciclo } : x)),
    asignaciones: factor === 1 ? e.asignaciones : escalarHoras(e, new Set([grupoId]), factor),
  }
}

/**
 * Al generar de nuevo las clases cambian de día y franja: los reemplazos y cambios guardados desde `hoy`
 * ya no corresponden y se quitan. Las ausencias quedan, y lo anterior a hoy se conserva para el registro.
 */
export const quitarAjustesFuturos = (e: Estado, hoy: string): Estado => ({
  ...e,
  ajustes: e.ajustes.map((aj) => (aj.fecha >= hoy ? { ...aj, reemplazos: [], movimientos: [] } : aj)),
})

export interface CambioIntensidad { grado: number; areaId: Id; antes: number; despues: number }

/**
 * Lee la intensidad horaria de lo ya asignado: para cada grado y área, las horas por semana que tienen sus grupos.
 * Solo llena las que están en 0, salvo que se pida `reemplazar`. Si los grupos de un grado difieren, usa la cantidad
 * más repetida (la mayor si empatan) y lo cuenta en `distintas`.
 */
export const intensidadDesdeAsignacion = (e: Estado, reemplazar = false): { estado: Estado; cambios: CambioIntensidad[]; distintas: string[] } => {
  const grupo = new Map(e.grupos.map((g) => [g.id, g]))
  const pares: [number, Id][] = []
  for (const a of e.asignaciones) {
    const g = grupo.get(a.grupoId)
    if (g && a.horas > 0 && !pares.some(([gr, ar]) => gr === g.grado && ar === a.areaId)) pares.push([g.grado, a.areaId])
  }
  pares.sort((x, y) => x[0] - y[0])
  const intensidad = Object.fromEntries(Object.entries(e.intensidad).map(([g, h]) => [g, { ...h }])) as Estado['intensidad']
  const cambios: CambioIntensidad[] = []
  const distintas: string[] = []
  for (const [grado, areaId] of pares) {
    const porGrupo = e.grupos
      .filter((g) => g.grado === grado)
      .sort((x, y) => x.numero - y.numero)
      .map((g) => ({ g, horas: (e.asignaciones.filter((a) => a.grupoId === g.id && a.areaId === areaId).reduce((n, a) => n + a.horas, 0) * 5) / cicloDeGrupo(e, g) }))
      .filter((x) => x.horas > 0)
    const veces = new Map<number, number>()
    for (const { horas } of porGrupo) veces.set(horas, (veces.get(horas) ?? 0) + 1)
    const despues = [...veces].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0][0]
    const antes = intensidad[grado]?.[areaId] ?? 0
    if (antes === despues || (antes > 0 && !reemplazar)) continue
    intensidad[grado] = { ...intensidad[grado], [areaId]: despues }
    cambios.push({ grado, areaId, antes, despues })
    if (veces.size > 1)
      distintas.push(`${e.areas.find((a) => a.id === areaId)?.nombre ?? 'Área'} en ${grado}.°: ${porGrupo.map((x) => `${nombreGrupo(x.g)} tiene ${x.horas}`).join(', ')}`)
  }
  return { estado: cambios.length ? { ...e, intensidad } : e, cambios, distintas }
}

/** Une un área con otra: sus horas, su intensidad, sus docentes y sus clases pasan a `destino`, y el área `origen` se borra. */
export const unirAreas = (e: Estado, origen: Id, destino: Id): Estado => {
  if (origen === destino) return e
  const asignaciones: Estado['asignaciones'] = []
  const renombre = new Map<Id, Id>()
  for (const a of e.asignaciones.map((x) => (x.areaId === origen ? { ...x, areaId: destino } : x))) {
    const igual = asignaciones.find((x) => x.docenteId === a.docenteId && x.grupoId === a.grupoId && x.areaId === a.areaId)
    if (igual) {
      igual.horas += a.horas
      renombre.set(a.id, igual.id)
    } else asignaciones.push({ ...a })
  }
  const deOrigen = e.areas.find((a) => a.id === origen)
  return sincronizarClases({
    ...e,
    asignaciones,
    clases: e.clases.map((c) => (renombre.has(c.asignacionId) ? { ...c, asignacionId: renombre.get(c.asignacionId)! } : c)),
    intensidad: Object.fromEntries(
      Object.entries(e.intensidad).map(([grado, horas]) => {
        const { [origen]: suyas = 0, ...resto } = horas
        return [grado, suyas ? { ...resto, [destino]: (resto[destino] ?? 0) + suyas } : resto]
      }),
    ),
    docentes: e.docentes.map((d) => (d.areaId === origen ? { ...d, areaId: destino } : d)),
    areas: e.areas
      .filter((a) => a.id !== origen)
      .map((a) => ({
        ...a,
        afines: a.id === destino ? [...new Set([...a.afines, ...(deOrigen?.afines ?? [])])].filter((x) => x !== destino && x !== origen) : a.afines.filter((x) => x !== origen),
      })),
  })
}

/**
 * Une dos docentes que son la misma persona: las horas, las clases, la dirección de grupo y las ausencias de `origen`
 * pasan a `destino`, que conserva su nombre, carga y disponibilidad. `origen` se borra.
 */
export const unirDocentes = (e: Estado, origen: Id, destino: Id): Estado => {
  if (origen === destino) return e
  const a = e.docentes.find((d) => d.id === origen)
  const asignaciones: Estado['asignaciones'] = []
  const renombre = new Map<Id, Id>()
  for (const x of e.asignaciones.map((y) => (y.docenteId === origen ? { ...y, docenteId: destino } : y))) {
    const igual = asignaciones.find((y) => y.docenteId === x.docenteId && y.grupoId === x.grupoId && y.areaId === x.areaId)
    if (igual) {
      igual.horas += x.horas
      renombre.set(x.id, igual.id)
    } else asignaciones.push({ ...x })
  }
  const cambia = (id: Id) => (id === origen ? destino : id)
  return sincronizarClases({
    ...e,
    asignaciones,
    clases: e.clases.map((c) => (renombre.has(c.asignacionId) ? { ...c, asignacionId: renombre.get(c.asignacionId)! } : c)),
    docentes: e.docentes
      .filter((d) => d.id !== origen)
      .map((d) => (d.id === destino && !d.direccionGrupoId && a?.direccionGrupoId ? { ...d, direccionGrupoId: a.direccionGrupoId } : d)),
    ajustes: e.ajustes.map((aj) => ({
      ...aj,
      ausencias: aj.ausencias.map((x) => ({ ...x, docenteId: cambia(x.docenteId) })),
      reemplazos: aj.reemplazos.map((x) => ({ ...x, docenteId: cambia(x.docenteId) })),
    })),
  })
}

/**
 * Docentes que parecen la misma persona escrita de dos formas: nombres parecidos («Sonia P. (apellido pendiente)» y
 * «Sonia Pineda»), uno con horas y el otro sin ninguna. Se propone pasar las horas (`origen`) al que no tiene (`destino`).
 */
export const docentesRepetidos = (e: Estado): { origen: Docente; destino: Docente }[] => {
  const horas = (id: Id) => e.asignaciones.reduce((n, a) => n + (a.docenteId === id ? a.horas : 0), 0)
  const conHoras = e.docentes.filter((d) => horas(d.id) > 0)
  const sinHoras = e.docentes.filter((d) => horas(d.id) === 0)
  const pares = conHoras.flatMap((o) => sinHoras.map((d) => ({ origen: o, destino: d, lejos: lejania(o.nombre, d.nombre) })))
    // Más estricto que al importar: «Sanny» y «Sonia» son dos personas. Pasa la misma palabra o una letra distinta de cada tres.
    .filter((p) => p.lejos <= 0.34)
    .sort((x, y) => x.lejos - y.lejos)
  const usados = new Set<Id>()
  return pares.filter((p) => !usados.has(p.origen.id) && !usados.has(p.destino.id) && (usados.add(p.origen.id), usados.add(p.destino.id), true))
    .map(({ origen, destino }) => ({ origen, destino }))
}
