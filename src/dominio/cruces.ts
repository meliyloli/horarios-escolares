import { esTitular } from './asignacion'
import { cargaEnCiclo, cicloDeGrupo, claveDocente, diasHorario, diasOcupados, diasVecinos, esMediaTecnica, FRANJAS, franjasDisponibles, jornadaDeAsignacion, jornadasDe, nivelDeGrado, nombreDia, nombreGrupo } from './tiempo'
import type { Asignacion, Clase, Docente, Estado, Grupo, Id, Reglas, Sesion } from './tipos'

/** Aula de una clase: la que se le puso a mano, la fija del docente (modelos docente y mixto) o la del grupo. */
export const aulaDeClase = (e: Estado, c: Clase): Id | undefined => {
  const a = e.asignaciones.find((x) => x.id === c.asignacionId)
  const modelo = e.colegio.modeloAula
  if (modelo === 'ninguna') return undefined
  const fija = modelo === 'grupo' ? undefined : e.docentes.find((d) => d.id === a?.docenteId)?.aulaId
  // En el modelo libre el grupo no tiene aula: quien rota usa la que se le repartió (ver aulas.ts).
  if (modelo === 'libre') return c.aulaId ?? fija
  return c.aulaId ?? fija ?? e.grupos.find((g) => g.id === a?.grupoId)?.aulaId
}

export const sesiones = (e: Estado, clases: Clase[] = e.clases): Sesion[] => {
  const dias = diasHorario(e)
  const asignaciones = new Map(e.asignaciones.map((a) => [a.id, a]))
  const grupos = new Map(e.grupos.map((g) => [g.id, g]))
  return clases.flatMap((c) => {
    const a = asignaciones.get(c.asignacionId)
    const g = a && grupos.get(a.grupoId)
    if (!a || !g) return []
    const aulaId = aulaDeClase(e, c)
    const jornada = jornadaDeAsignacion(e, a)
    return diasOcupados(c.dia, cicloDeGrupo(e, g), dias).map((dia) => ({
      claseId: c.id, asignacionId: a.id, docenteId: a.docenteId, grupoId: a.grupoId, areaId: a.areaId,
      aulaId, jornada, dia, franja: c.franja, fijada: c.fijada,
    }))
  })
}

export type TipoCruce =
  | 'docente' | 'grupo' | 'aula' | 'carga' | 'disponibilidad'
  | 'maxMateria' | 'maxDocente' | 'horaLibre' | 'libreDiaria' | 'cargaPareja' | 'diasSeguidos' | 'bloqueExcluido' | 'bloqueDeDos' | 'mediaTecnicaDia' | 'sinUbicar' | 'sinAula'

export interface Cruce {
  tipo: TipoCruce
  mensaje: string
  claseIds: Id[]
  docenteId?: Id
  grupoId?: Id
  aulaId?: Id
  dia?: number
  franja?: number
}

/** Hasta cuántas horas por semana una materia se considera corta y va en días separados, si el colegio no elige otro número. */
export const HORAS_ESPACIADAS = 4
export const horasEspaciadas = (e: Estado): number => e.colegio.reglas.espaciarMaterias?.horas ?? HORAS_ESPACIADAS

/**
 * Materias de un grupo («grupoId|areaId») que, con la regla activa, no pueden ir en dos días seguidos: las de 4 horas
 * o menos por semana (sumando todos sus docentes). Se exceptúan las que no caben así: por ejemplo, 4 horas con
 * máximo 1 por día necesitan 4 de los 5 días.
 */
export const materiasEspaciadas = (e: Estado): Set<string> => {
  const { reglas } = e.colegio
  if (!reglas.espaciarMaterias?.activa) return new Set()
  const horas = new Map<string, number>()
  for (const a of e.asignaciones) horas.set(`${a.grupoId}|${a.areaId}`, (horas.get(`${a.grupoId}|${a.areaId}`) ?? 0) + a.horas)
  const porDia = reglas.maxMateriaDia.activa ? reglas.maxMateriaDia.valor : FRANJAS
  return new Set([...horas].flatMap(([llave, h]) => {
    const g = e.grupos.find((x) => x.id === llave.split('|')[0])
    if (!g || h <= 0) return []
    const ciclo = cicloDeGrupo(e, g)
    const cabe = Math.ceil(h / porDia) <= Math.ceil(ciclo / 2)
    return (h * 5) / ciclo <= horasEspaciadas(e) && cabe ? [llave] : []
  }))
}

/** Las áreas que nunca van en bloque, si alguna de las reglas de bloques está activa. */
export const areasSinBloque = (r: Reglas): Set<Id> =>
  new Set(r.bloques?.activa || r.bloquesDeDos?.activa ? r.bloques?.sinBloque ?? [] : [])

/**
 * Con la regla activa, una asignación de 2 horas por semana va siempre en un bloque. No aplica a las áreas excluidas
 * de los bloques, ni si los máximos diarios no dejan dos horas de la materia o del docente el mismo día.
 */
export const enBloqueDeDos = (e: Estado, a: Asignacion): boolean => {
  const r = e.colegio.reglas
  if (!r.bloquesDeDos?.activa || areasSinBloque(r).has(a.areaId)) return false
  const g = e.grupos.find((x) => x.id === a.grupoId)
  const d = e.docentes.find((x) => x.id === a.docenteId)
  if (!g || !d || (a.horas * 5) / cicloDeGrupo(e, g) !== 2) return false
  return (!r.maxMateriaDia.activa || r.maxMateriaDia.valor >= 2) && (!aplicaMaxDocente(r, d, g) || r.maxDocenteDia.valor >= 2)
}

/** El máximo de horas con el mismo docente aplica en bachillerato; en primaria nunca al titular. */
export const aplicaMaxDocente = (reglas: Reglas, docente: Docente, grupo: Grupo): boolean =>
  reglas.maxDocenteDia.activa &&
  (nivelDeGrado(grupo.grado) === 'bachillerato' || (!esTitular(docente) && reglas.maxDocenteDia.aplicaEspecialistas))

const agrupar = <T>(items: T[], llave: (x: T) => string): T[][] => {
  const mapa = new Map<string, T[]>()
  for (const x of items) mapa.set(llave(x), [...(mapa.get(llave(x)) ?? []), x])
  return [...mapa.values()]
}

/** Todos los cruces y reglas rotas del horario. Sin clases no hay horario y devuelve una lista vacía. */
export const detectarCruces = (e: Estado, reglas: Reglas = e.colegio.reglas): Cruce[] => {
  if (e.clases.length === 0) return []
  const dias = diasHorario(e)
  const todas = sesiones(e)
  const docente = (id: Id) => e.docentes.find((d) => d.id === id)
  const grupo = (id: Id) => e.grupos.find((g) => g.id === id)
  const area = (id: Id) => e.areas.find((a) => a.id === id)?.nombre ?? 'un área'
  const cuando = (s: Sesion) => `el ${nombreDia(s.dia, dias).toLowerCase()} en la franja ${s.franja}`
  const ids = (ss: Sesion[]) => [...new Set(ss.map((s) => s.claseId))]
  const cruces: Cruce[] = []

  // La franja 1 de la mañana y la de la tarde son horas distintas: un docente de dos jornadas puede tener las dos.
  const jornadaDe = (s: Sesion) => s.jornada
  for (const ss of agrupar(todas, (s) => `${s.docenteId}/${jornadaDe(s)}/${s.dia}/${s.franja}`))
    if (ss.length > 1)
      cruces.push({
        tipo: 'docente', claseIds: ids(ss), docenteId: ss[0].docenteId, dia: ss[0].dia, franja: ss[0].franja,
        mensaje: `${docente(ss[0].docenteId)?.nombre} tiene ${ss.length} clases ${cuando(ss[0])}.`,
      })

  // Un grupo con materias en contrajornada tiene franjas de la mañana y de la tarde: son horas distintas.
  for (const ss of agrupar(todas, (s) => `${s.grupoId}/${s.jornada}/${s.dia}/${s.franja}`))
    if (ss.length > 1)
      cruces.push({
        tipo: 'grupo', claseIds: ids(ss), grupoId: ss[0].grupoId, dia: ss[0].dia, franja: ss[0].franja,
        mensaje: `El grupo ${nombreGrupo(grupo(ss[0].grupoId)!)} tiene ${ss.length} clases ${cuando(ss[0])}.`,
      })

  // Las dos jornadas pueden compartir aula: solo choca dentro de la misma jornada.
  const conAula = todas.filter((s) => s.aulaId)
  for (const ss of agrupar(conAula, (s) => `${s.aulaId}/${s.jornada}/${s.dia}/${s.franja}`))
    if (ss.length > 1)
      cruces.push({
        tipo: 'aula', claseIds: ids(ss), aulaId: ss[0].aulaId, dia: ss[0].dia, franja: ss[0].franja,
        mensaje: `El aula ${e.aulas.find((a) => a.id === ss[0].aulaId)?.nombre} tiene ${ss.length} clases ${cuando(ss[0])}.`,
      })

  for (const ss of e.colegio.modeloAula === 'ninguna' ? [] : agrupar(todas.filter((s) => !s.aulaId), (s) => s.claseId))
    cruces.push({
      tipo: 'sinAula', claseIds: ids(ss), grupoId: ss[0].grupoId, dia: ss[0].dia, franja: ss[0].franja,
      mensaje: `La clase de ${area(ss[0].areaId)} de ${nombreGrupo(grupo(ss[0].grupoId)!)} ${cuando(ss[0])} no tiene aula.`,
    })

  for (const s of todas) {
    const d = docente(s.docenteId)
    if (d?.noDisponible.includes(claveDocente(d, s.dia, s.franja, jornadaDe(s))))
      cruces.push({
        tipo: 'disponibilidad', claseIds: [s.claseId], docenteId: s.docenteId, dia: s.dia, franja: s.franja,
        mensaje: `${d.nombre} no está disponible ${cuando(s)}${d.jornada === 'ambas' ? (jornadaDe(s) === 'tarde' ? ' de la tarde' : ' de la mañana') : ''}.`,
      })
  }

  // La media técnica es una jornada extra: no tiene máximos diarios ni cuenta en los de las demás materias.
  const regulares = todas.filter((s) => !esMediaTecnica(e, s.areaId))
  if (reglas.maxMateriaDia.activa)
    for (const ss of agrupar(regulares, (s) => `${s.grupoId}/${s.areaId}/${s.dia}`))
      if (ss.length > reglas.maxMateriaDia.valor)
        cruces.push({
          tipo: 'maxMateria', claseIds: ids(ss), grupoId: ss[0].grupoId, dia: ss[0].dia,
          mensaje: `${nombreGrupo(grupo(ss[0].grupoId)!)} tiene ${ss.length} horas de ${area(ss[0].areaId)} el ${nombreDia(ss[0].dia, dias).toLowerCase()}; el máximo es ${reglas.maxMateriaDia.valor}.`,
        })

  for (const ss of agrupar(regulares, (s) => `${s.grupoId}/${s.docenteId}/${s.dia}`)) {
    const [d, g] = [docente(ss[0].docenteId), grupo(ss[0].grupoId)]
    if (d && g && ss.length > reglas.maxDocenteDia.valor && aplicaMaxDocente(reglas, d, g))
      cruces.push({
        tipo: 'maxDocente', claseIds: ids(ss), grupoId: g.id, docenteId: d.id, dia: ss[0].dia,
        mensaje: `${nombreGrupo(g)} tiene ${ss.length} horas con ${d.nombre} el ${nombreDia(ss[0].dia, dias).toLowerCase()}; el máximo es ${reglas.maxDocenteDia.valor}.`,
      })
  }

  // Las reglas de carga y de horas libres son de los docentes de planta, no de los instructores externos.
  for (const d of e.docentes.filter((x) => !x.externo)) {
    const suyas = todas.filter((s) => s.docenteId === d.id)
    const porDia = (dia: number) => suyas.filter((s) => s.dia === dia)
    // Día lleno: todas sus franjas (12 si dicta en la mañana y en la tarde).
    const lleno = FRANJAS * jornadasDe(d).length
    if (reglas.horaLibre.activa)
      for (let dia = 1; dia <= dias; dia++)
        if (porDia(dia).length >= lleno && diasVecinos(dia, dias).every((v) => porDia(v).length >= lleno))
          cruces.push({
            tipo: 'horaLibre', claseIds: ids(porDia(dia)), docenteId: d.id, dia,
            mensaje: `${d.nombre} tiene ${lleno} clases el ${nombreDia(dia, dias).toLowerCase()} y ninguna franja libre el día anterior ni el siguiente.`,
          })
    // Horas libres de cada día en que el docente va al colegio (los días sin ninguna franja disponible no cuentan).
    const libres = franjasDisponibles(d, dias).flatMap((cap, i) => (cap > 0 ? [{ dia: i + 1, libres: cap - porDia(i + 1).length }] : []))
    const dia = (n: number) => nombreDia(n, dias).toLowerCase()
    if (reglas.libreDiaria?.activa)
      for (const l of libres)
        if (l.libres <= 0)
          cruces.push({ tipo: 'libreDiaria', claseIds: ids(porDia(l.dia)), docenteId: d.id, dia: l.dia, mensaje: `${d.nombre} no tiene ninguna hora libre el ${dia(l.dia)}.` })
    if (reglas.cargaPareja?.activa && suyas.length > 0 && libres.length > 0) {
      const menos = libres.reduce((x, y) => (y.libres < x.libres ? y : x))
      const mas = libres.reduce((x, y) => (y.libres > x.libres ? y : x))
      if (mas.libres - menos.libres >= 2)
        cruces.push({
          tipo: 'cargaPareja', claseIds: ids(porDia(menos.dia)), docenteId: d.id, dia: menos.dia,
          mensaje: `La carga de ${d.nombre} no está pareja: el ${dia(menos.dia)} tiene ${menos.libres} ${menos.libres === 1 ? 'hora libre' : 'horas libres'} y el ${dia(mas.dia)} ${mas.libres}.`,
        })
    }
    const carga = cargaEnCiclo(d, dias)
    if (suyas.length !== carga)
      cruces.push({
        tipo: 'carga', claseIds: [], docenteId: d.id,
        mensaje: `${d.nombre} tiene ${suyas.length} clases en el horario y su carga es de ${carga}.`,
      })
  }

  // Días seguidos se cuentan en el ciclo de cada grupo: en uno de 5 días, el viernes y el lunes no son seguidos.
  const espaciadas = materiasEspaciadas(e)
  if (espaciadas.size) {
    const diasDe = new Map<string, Set<number>>()
    for (const c of e.clases) {
      const a = e.asignaciones.find((x) => x.id === c.asignacionId)
      const llave = a && `${a.grupoId}|${a.areaId}`
      if (llave && espaciadas.has(llave)) diasDe.set(llave, (diasDe.get(llave) ?? new Set()).add(c.dia))
    }
    for (const [llave, set] of diasDe) {
      const [grupoId, areaId] = llave.split('|')
      const g = grupo(grupoId)!
      const ds = [...set].sort((x, y) => x - y)
      const par = ds.find((d) => diasVecinos(d, cicloDeGrupo(e, g)).some((v) => v > d && set.has(v)))
      if (par === undefined) continue
      const ids = e.clases.filter((c) => { const a = e.asignaciones.find((x) => x.id === c.asignacionId); return a?.grupoId === grupoId && a.areaId === areaId && (c.dia === par || c.dia === par + 1) }).map((c) => c.id)
      cruces.push({
        tipo: 'diasSeguidos', claseIds: ids, grupoId, dia: par,
        mensaje: `${area(areaId)} de ${nombreGrupo(g)} queda en días seguidos (${nombreDia(par, dias).toLowerCase()} y ${nombreDia(par + 1, dias).toLowerCase()}); con ${horasEspaciadas(e)} ${horasEspaciadas(e) === 1 ? 'hora' : 'horas'} o menos por semana va en días separados.`,
      })
    }
  }

  // Una materia excluida de los bloques no tiene dos horas en el mismo par de franjas (1-2, 3-4 o 5-6) el mismo día.
  const sinBloque = areasSinBloque(reglas)
  if (sinBloque.size)
    for (const ss of agrupar(todas.filter((s) => sinBloque.has(s.areaId)), (s) => `${s.grupoId}/${s.areaId}/${s.dia}/${Math.ceil(s.franja / 2)}`))
      if (ss.length > 1)
        cruces.push({
          tipo: 'bloqueExcluido', claseIds: ids(ss), grupoId: ss[0].grupoId, dia: ss[0].dia,
          mensaje: `${area(ss[0].areaId)} de ${nombreGrupo(grupo(ss[0].grupoId)!)} tiene dos horas seguidas el ${nombreDia(ss[0].dia, dias).toLowerCase()} (franjas ${ss.map((s) => s.franja).sort().join(' y ')}) y está excluida de los bloques.`,
        })

  // Media técnica: cada docente atiende un solo grupo por día.
  for (const ss of agrupar(todas.filter((s) => esMediaTecnica(e, s.areaId)), (s) => `${s.docenteId}/${s.dia}`)) {
    const delDia = [...new Set(ss.map((s) => s.grupoId))]
    if (delDia.length < 2) continue
    const nombres = delDia.map((id) => nombreGrupo(grupo(id)!))
    cruces.push({
      tipo: 'mediaTecnicaDia', claseIds: ids(ss), docenteId: ss[0].docenteId, dia: ss[0].dia,
      mensaje: `${docente(ss[0].docenteId)?.nombre} tiene media técnica con ${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)} el ${nombreDia(ss[0].dia, dias).toLowerCase()}; va un grupo por día.`,
    })
  }

  // Materias de 2 horas en bloque: sus clases van de a dos, el mismo día, en el mismo par de franjas.
  for (const a of e.asignaciones) {
    if (!enBloqueDeDos(e, a)) continue
    const suyas = e.clases.filter((c) => c.asignacionId === a.id)
    const pares = agrupar(suyas, (c) => `${c.dia}|${Math.ceil(c.franja / 2)}`)
    if (suyas.length === 0 || pares.every((p) => p.length === 2)) continue
    const g = grupo(a.grupoId)!
    cruces.push({
      tipo: 'bloqueDeDos', claseIds: suyas.map((c) => c.id), grupoId: g.id, docenteId: a.docenteId,
      mensaje: `${area(a.areaId)} de ${nombreGrupo(g)} con ${docente(a.docenteId)?.nombre} tiene sus 2 horas separadas; van juntas en bloque (franjas 1-2, 3-4 o 5-6).`,
    })
  }

  for (const a of e.asignaciones) {
    const faltan = a.horas - e.clases.filter((c) => c.asignacionId === a.id).length
    const g = grupo(a.grupoId)
    if (faltan > 0 && g)
      cruces.push({
        tipo: 'sinUbicar', claseIds: [], docenteId: a.docenteId, grupoId: a.grupoId,
        mensaje: `Faltan ${faltan} horas de ${area(a.areaId)} de ${nombreGrupo(g)} por ubicar en el horario.`,
      })
  }
  return cruces
}

/** Avisos de configuración de aulas según el modelo elegido. */
export const avisosAulas = (e: Estado): string[] => {
  const avisos: string[] = []
  const { modeloAula } = e.colegio
  if (modeloAula === 'ninguna') return avisos
  for (const jornada of ['manana', 'tarde'] as const) {
    const grupos = e.grupos.filter((g) => g.jornada === jornada)
    const aulas = new Set(grupos.map((g) => g.aulaId).filter(Boolean))
    if (modeloAula === 'grupo' && aulas.size < grupos.length)
      avisos.push(`En la jornada de la ${jornada === 'manana' ? 'mañana' : 'tarde'} hay menos aulas que grupos: ${aulas.size} aulas para ${grupos.length} grupos.`)
  }
  if (modeloAula === 'grupo' || modeloAula === 'mixto')
    for (const g of e.grupos) if (!g.aulaId) avisos.push(`El grupo ${nombreGrupo(g)} no tiene aula.`)
  if (modeloAula === 'libre' && e.aulas.length === 0) avisos.push('No hay aulas. Agrégalas en «Grupos, docentes y aulas».')
  if (modeloAula === 'docente')
    for (const d of e.docentes) if (!d.aulaId) avisos.push(`${d.nombre} no tiene aula fija.`)
  if ((modeloAula === 'mixto' || modeloAula === 'libre') && e.docentes.length > 0 && !e.docentes.some((d) => d.aulaId)) avisos.push('Ningún docente está marcado con aula fija.')
  return avisos
}
