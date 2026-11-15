// Lo que decide el coordinador cuando alguien falta, y el resumen del día para enviar a docentes y familias.
import { turnosSinCubrir } from './acompanamiento'
import { aplicarReorganizacion, candidatosReemplazo, impactoAjuste, normalizarAjuste, opcionesReorganizar, sesionesDelDia } from './reemplazos'
import { claveDocente, dictaEn, FRANJAS, horaDeFranja, nombreGrupo, reloj } from './tiempo'
import type { AjusteDia, Estado, Id, Jornada } from './tipos'

/** «Martes 17 de noviembre». */
export const fechaLarga = (fecha: string) => {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')
  return texto[0].toUpperCase() + texto.slice(1)
}
const hora = (n: number) => `${n}.ª`
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`)

const faltaEn = (aj: AjusteDia, docenteId: Id, franja: number) => aj.ausencias.some((a) => a.docenteId === docenteId && a.franjas.includes(franja))

/** ¿El docente puede cubrir esa clase? Está en el colegio, disponible y sin otra clase a esa hora. */
export const estaLibre = (e: Estado, aj: AjusteDia, docenteId: Id, claseId: Id): boolean => {
  const delDia = sesionesDelDia(e, aj)
  const s = delDia.find((x) => x.claseId === claseId)
  const d = e.docentes.find((x) => x.id === docenteId)
  if (!s || !d || d.id === s.docenteOriginalId || !dictaEn(d, s.jornada) || faltaEn(aj, d.id, s.franja)) return false
  if (d.noDisponible.includes(claveDocente(d, aj.diaCiclo, s.franja, s.jornada))) return false
  return !delDia.some((o) => o.docenteId === d.id && o.franja === s.franja && o.jornada === s.jornada && o.situacion !== 'sinDocente' && o.situacion !== 'grupoAusente')
}

/** El candidato que más conviene: el de la misma área o el que ya dicta al grupo, y entre ellos el que menos ha cubierto (contando hoy). */
const mejorCandidato = (e: Estado, aj: AjusteDia, claseId: Id): Id | undefined => {
  const hoy = (id: Id) => aj.reemplazos.filter((r) => r.docenteId === id).length
  const orden = { area: 0, grupo: 1, otro: 2 }
  return candidatosReemplazo(e, aj, claseId).sort((a, b) => orden[a.motivo] - orden[b.motivo] || a.horasCubiertas + hoy(a.docenteId) - b.horasCubiertas - hoy(b.docenteId))[0]?.docenteId
}

/**
 * Arma el día a partir de lo que se decidió para cada docente ausente: reemplazos (el que más convenga o uno elegido)
 * y, para las horas que quedan sin docente, que el grupo llegue tarde o salga temprano según la preferencia. Si lo
 * preferido no se puede sin cruzar a nadie, se usa lo otro. Lo de los ausentes sin decisión se deja como estaba.
 */
export const resolverDia = (e: Estado, aj: AjusteDia): AjusteDia => {
  const decisiones = (aj.decisiones ?? []).filter((d) => aj.ausencias.some((a) => a.docenteId === d.docenteId))
  const decididos = new Set(decisiones.map((d) => d.docenteId))
  const base = sesionesDelDia(e, { ...aj, reemplazos: [], movimientos: [] })
  const deDecididos = base.filter((s) => s.situacion === 'sinDocente' && decididos.has(s.docenteOriginalId))
  const tocados = new Set(deDecididos.map((s) => s.grupoId))
  const claseGrupo = new Map(base.map((s) => [s.claseId, s.grupoId]))
  let r: AjusteDia = {
    ...aj,
    reemplazos: aj.reemplazos.filter((x) => !deDecididos.some((s) => s.claseId === x.claseId)),
    movimientos: aj.movimientos.filter((m) => !tocados.has(claseGrupo.get(m.claseId) ?? '')),
  }

  for (const dec of decisiones) {
    if (dec.modo === 'reorganizar') continue
    for (const s of deDecididos.filter((x) => x.docenteOriginalId === dec.docenteId).sort((a, b) => a.franja - b.franja)) {
      const quien = dec.modo === 'elegido' ? (dec.elegidoId && estaLibre(e, r, dec.elegidoId, s.claseId) ? dec.elegidoId : undefined) : mejorCandidato(e, r, s.claseId)
      if (quien) r = { ...r, reemplazos: [...r.reemplazos, { claseId: s.claseId, docenteId: quien }] }
    }
  }

  const sin = sesionesDelDia(e, r).filter((s) => s.situacion === 'sinDocente' && decididos.has(s.docenteOriginalId))
  for (const grupoId of new Set(sin.map((s) => s.grupoId))) {
    // Si al grupo le faltan dos docentes con preferencias distintas, manda la del primero que se registró.
    const preferencia = decisiones.find((d) => d.preferencia && sin.some((s) => s.grupoId === grupoId && s.docenteOriginalId === d.docenteId))?.preferencia
    if (!preferencia || preferencia === 'quedan') continue
    const opciones = opcionesReorganizar(e, r, grupoId)
    const opcion = opciones.find((o) => o.tipo === preferencia) ?? opciones[0]
    if (opcion) r = aplicarReorganizacion(e, r, opcion)
  }
  return normalizarAjuste(e, r)
}

/** El resumen del día en texto, listo para copiar: uno completo para docentes y otro corto para familias. */
export const resumenDia = (e: Estado, aj: AjusteDia): { docentes: string; familias: string } => {
  const delDia = sesionesDelDia(e, aj)
  const impacto = impactoAjuste(e, aj)
  const docente = (id: Id) => e.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  const grupo = (id: Id) => {
    const g = e.grupos.find((x) => x.id === id)
    return g ? nombreGrupo(g) : 'Grupo borrado'
  }
  const area = (id: Id) => e.areas.find((a) => a.id === id)?.nombre ?? 'Área borrada'
  const delGrupo = (id: Id) => delDia.filter((s) => s.grupoId === id && s.situacion !== 'sinDocente' && s.situacion !== 'grupoAusente').map((s) => s.franja)
  const tarde = (id: Id) => (delDia.some((s) => s.grupoId === id && s.jornada === 'tarde') && e.grupos.some((g) => g.jornada === 'manana') ? ' (jornada de la tarde)' : '')
  const ordenGrupo = (a: Id, b: Id) => grupo(a).localeCompare(grupo(b), 'es', { numeric: true })
  const fecha = fechaLarga(aj.fecha)
  const conAulas = e.colegio.modeloAula !== 'ninguna'
  const aula = (id?: Id) => e.aulas.find((a) => a.id === id)?.nombre ?? 'sin aula'
  const jornadaDe = (grupoId: Id): Jornada => delDia.find((s) => s.grupoId === grupoId)?.jornada ?? 'manana'
  /** « (7:25 a. m.)» si el colegio escribió las horas de las franjas. */
  const aLas = (j: Jornada, franja: number, cual: 'inicio' | 'fin' = 'inicio') => {
    const h = horaDeFranja(e, j, franja)
    return h ? ` (${reloj(h[cual])})` : ''
  }

  // Para las familias: con la hora de reloj si se conoce; si no, la hora de clase.
  const entra = (id: Id) => {
    const f = Math.min(...delGrupo(id))
    const h = horaDeFranja(e, jornadaDe(id), f)
    return h ? `ingresa a las ${reloj(h.inicio)} (${hora(f)} hora)${tarde(id)}` : `ingresa a la ${hora(f)} hora${tarde(id)}`
  }
  const sale = (id: Id) => {
    const f = Math.max(...delGrupo(id))
    const h = horaDeFranja(e, jornadaDe(id), f)
    return h ? `sale a las ${reloj(h.fin)} (al terminar la ${hora(f)} hora)${tarde(id)}` : `sale al terminar la ${hora(f)} hora${tarde(id)}`
  }
  const cambiosGrupo = [
    ...impacto.gruposLleganTarde.map((id) => [id, entra(id)]),
    ...impacto.gruposSalenTemprano.map((id) => [id, sale(id)]),
    ...impacto.gruposAusentes.map((id) => [id, 'no tiene clase este día']),
  ].sort((a, b) => ordenGrupo(a[0], b[0]))

  const seccion = (titulo: string, lineas: string[]) => (lineas.length ? [`${titulo}:`, ...lineas.map((l) => `• ${l}`), ''] : [])
  const ausencias = aj.ausencias.map((a) => `Falta ${docente(a.docenteId)} (${a.franjas.length === FRANJAS ? 'todo el día' : `${lista(a.franjas.map(hora))} hora`}).`)
  const reemplazos = delDia
    .filter((s) => s.situacion === 'reemplazo')
    .sort((a, b) => a.franjaOriginal - b.franjaOriginal || ordenGrupo(a.grupoId, b.grupoId))
    .map((s) => {
      const donde = !conAulas ? '' : `, en ${aula(s.aulaId)}${s.aulaId !== s.aulaOriginalId ? ` (antes ${aula(s.aulaOriginalId)})` : ''}`
      return `${grupo(s.grupoId)}, ${hora(s.franja)} hora${aLas(s.jornada, s.franja)}, ${area(s.areaId)}: la cubre ${docente(s.docenteId)}${donde}.`
    })
  const movidas = delDia
    .filter((s) => s.situacion === 'movida')
    .sort((a, b) => docente(a.docenteId).localeCompare(docente(b.docenteId)) || a.franjaOriginal - b.franjaOriginal)
    .map((s) => `${docente(s.docenteId)}: ${area(s.areaId)} con ${grupo(s.grupoId)} pasa de la ${hora(s.franjaOriginal)}${aLas(s.jornada, s.franjaOriginal)} a la ${hora(s.franja)} hora${aLas(s.jornada, s.franja)}${conAulas ? `, en ${aula(s.aulaId)}` : ''}.`)
  const descansos = turnosSinCubrir(e, aj).map((t) => {
    const zona = e.acompanamiento?.zonas.find((z) => z.id === t.zonaId)?.nombre ?? 'Zona'
    return `${zona}, ${t.descanso === 1 ? 'primer' : 'segundo'} descanso: le tocaba a ${docente(t.ausente)}; ${t.sugerido ? `lo cubre ${docente(t.sugerido)}` : 'queda sin cubrir'}.`
  })

  const docentes = [
    `Novedades del ${fecha.toLowerCase()}`,
    '',
    ...seccion('Ausencias', ausencias.map((a) => a.slice(0, -1))),
    ...seccion('Reemplazos', reemplazos),
    ...seccion('Clases que cambian de hora', movidas),
    ...seccion('Grupos', cambiosGrupo.map(([id, t]) => `${grupo(id)} ${t}.`)),
    ...seccion('Acompañamiento en descansos', descansos),
    'El horario base no cambia; esto aplica solo ese día.',
  ].join('\n')

  const familias = cambiosGrupo.length
    ? [
        `Buenos días, familias. Cambios en la jornada del ${fecha.toLowerCase()}:`,
        ...cambiosGrupo.map(([id, t]) => `• Grupo ${grupo(id)}: ${t}.`),
        'Los demás grupos tienen su horario habitual. Gracias por su comprensión.',
      ].join('\n')
    : `Buenos días, familias. El ${fecha.toLowerCase()} todos los grupos tienen su horario habitual.`
  return { docentes, familias }
}

/** Cuántas de las horas sin docente de un ausente podría cubrir cada docente de planta (calculado una sola vez). */
export const horasQuePuedeCubrir = (e: Estado, aj: AjusteDia, ausenteId: Id): Map<Id, number> => {
  const sinSus = { ...aj, reemplazos: aj.reemplazos.filter((r) => !sesionesDelDia(e, aj).some((s) => s.claseId === r.claseId && s.docenteOriginalId === ausenteId)) }
  const delDia = sesionesDelDia(e, sinSus)
  const suyas = delDia.filter((s) => s.situacion === 'sinDocente' && s.docenteOriginalId === ausenteId)
  const ocupado = new Set(delDia.filter((s) => s.situacion !== 'sinDocente' && s.situacion !== 'grupoAusente').map((s) => `${s.docenteId}|${s.jornada}|${s.franja}`))
  const r = new Map<Id, number>()
  for (const d of e.docentes) {
    if (d.externo || d.id === ausenteId) continue
    r.set(d.id, suyas.filter((s) => dictaEn(d, s.jornada) && !faltaEn(aj, d.id, s.franja) && !d.noDisponible.includes(claveDocente(d, aj.diaCiclo, s.franja, s.jornada)) && !ocupado.has(`${d.id}|${s.jornada}|${s.franja}`)).length)
  }
  return r
}
