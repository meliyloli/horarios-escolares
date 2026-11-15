import { sesiones } from './cruces'
import { sesionesDelDia, type EstadoSesion, type SesionDia } from './reemplazos'
import { dictaEn, diasHorario, FRANJAS, jornadasConClase, jornadasDeGrupo, nombreGrupo } from './tiempo'
import type { AjusteDia, Area, Docente, Estado, Id, Jornada } from './tipos'

export type TipoVista = 'general' | 'docente' | 'grupo' | 'aula'

export interface Celda {
  claseId?: Id
  lineas: string[]
  situacion?: EstadoSesion
  fijada?: boolean
}

/** `celdas[día][franja - 1]` es la lista de clases de esa franja; más de una significa cruce. */
export interface Tabla {
  titulo: string
  subtitulo?: string
  /** Si la tabla es solo de una jornada (un docente o grupo que tiene clases en las dos). */
  jornada?: Jornada
  dias: number[]
  celdas: Celda[][][]
}

const JORNADA = { manana: 'Jornada de la mañana', tarde: 'Jornada de la tarde', ambas: 'Jornadas de la mañana y de la tarde' }
const CORTA = { manana: 'mañana', tarde: 'tarde' }

/** Sesiones del horario base, o solo las del día del ajuste con sus cambios. */
const sesionesVista = (e: Estado, ajuste?: AjusteDia): SesionDia[] =>
  ajuste
    ? sesionesDelDia(e, ajuste)
    : sesiones(e).map((s) => ({ ...s, docenteOriginalId: s.docenteId, franjaOriginal: s.franja, situacion: 'normal' as const }))

const diasVista = (e: Estado, ajuste?: AjusteDia): number[] =>
  ajuste ? [ajuste.diaCiclo] : Array.from({ length: diasHorario(e) }, (_, i) => i + 1)

const textos = (e: Estado) => {
  const docente = (id: Id) => e.docentes.find((d) => d.id === id)?.nombre ?? 'Docente borrado'
  return {
    docente,
    area: (s: SesionDia) => e.areas.find((a) => a.id === s.areaId)?.nombre ?? 'Área borrada',
    grupo: (s: SesionDia) => {
      const g = e.grupos.find((x) => x.id === s.grupoId)
      return g ? nombreGrupo(g) : 'Grupo borrado'
    },
    aula: (s: SesionDia) => (e.colegio.modeloAula === 'ninguna' ? '' : e.aulas.find((a) => a.id === s.aulaId)?.nombre ?? 'Sin aula'),
    /** Quién dicta, como se lee desde el grupo o el aula. */
    quien: (s: SesionDia) =>
      s.situacion === 'sinDocente' ? 'Sin docente'
      : s.situacion === 'grupoAusente' ? 'Grupo ausente'
      : s.situacion === 'reemplazo' ? `${docente(s.docenteId)} (reemplazo)`
      : docente(s.docenteId),
    /** Nota extra en el horario del docente `id` cuando la clase tiene un ajuste. */
    nota: (s: SesionDia, id: Id): string[] =>
      s.situacion === 'grupoAusente' ? ['Grupo ausente']
      : s.situacion === 'sinDocente' ? ['Ausente']
      : s.situacion === 'reemplazo' ? [s.docenteId === id ? `Reemplaza a ${docente(s.docenteOriginalId)}` : `Cubre ${docente(s.docenteId)}`]
      : [],
  }
}

const armar = (dias: number[], ss: SesionDia[], lineas: (s: SesionDia) => string[]): Celda[][][] =>
  dias.map((dia) =>
    Array.from({ length: FRANJAS }, (_, f) =>
      ss.filter((s) => s.dia === dia && s.franja === f + 1)
        .map((s) => ({ claseId: s.claseId, lineas: lineas(s).filter(Boolean), situacion: s.situacion, fijada: s.fijada })),
    ),
  )

const esDe = (s: SesionDia, docenteId: Id) => s.docenteId === docenteId || s.docenteOriginalId === docenteId

/** `jornada` deja solo las clases de esa jornada (un docente de mañana y tarde se ve en dos tablas). */
export const tablaDe = (e: Estado, tipo: Exclude<TipoVista, 'general'>, id: Id, ajuste?: AjusteDia, jornada?: Jornada): Tabla => {
  const t = textos(e)
  const dias = diasVista(e, ajuste)
  const todas = sesionesVista(e, ajuste).filter((s) => !jornada || s.jornada === jornada)
  if (tipo === 'grupo') {
    const g = e.grupos.find((x) => x.id === id)
    const director = e.docentes.find((d) => d.direccionGrupoId === id)
    // Con materias en contrajornada el grupo se ve en dos tablas: «Grupo 7-1 · mañana» y «· tarde».
    const partido = !!g && !!jornada && jornadasDeGrupo(e, g).length > 1
    return {
      titulo: (g ? `Grupo ${nombreGrupo(g)}` : 'Grupo') + (partido ? ` · ${CORTA[jornada]}` : ''),
      jornada,
      subtitulo: [g && JORNADA[jornada ?? g.jornada], director && `Dirección de grupo: ${director.nombre}`].filter(Boolean).join(' · ') || undefined,
      dias,
      celdas: armar(dias, todas.filter((s) => s.grupoId === id), (s) => [t.area(s), t.quien(s), t.aula(s)]),
    }
  }
  if (tipo === 'docente') {
    const d = e.docentes.find((x) => x.id === id)
    const area = e.areas.find((a) => a.id === d?.areaId)?.nombre
    const partida = !!d && !!jornada && jornadasConClase(e, d).length > 1
    return {
      titulo: (d?.nombre ?? 'Docente') + (partida ? ` · ${CORTA[jornada]}` : ''),
      jornada,
      subtitulo: [area, d && JORNADA[jornada ?? d.jornada]].filter(Boolean).join(' · ') || undefined,
      dias,
      celdas: armar(dias, todas.filter((s) => esDe(s, id)), (s) => [t.area(s), t.grupo(s), t.aula(s), ...t.nota(s, id)]),
    }
  }
  // Un aula compartida por las dos jornadas se ve por separado: el id llega como "aula@jornada".
  const [aulaId, deId] = id.split('@')
  const deLaAula = (deId as Jornada | undefined) ?? jornada
  const aula = e.aulas.find((a) => a.id === aulaId)
  const deJornada = (s: SesionDia) => !deLaAula || s.jornada === deLaAula
  return {
    titulo: (aula?.nombre ?? 'Aula') + (deLaAula ? ` · ${CORTA[deLaAula]}` : ''),
    subtitulo: aula?.capacidad ? `Capacidad: ${aula.capacidad}` : undefined,
    dias,
    celdas: armar(dias, todas.filter((s) => s.aulaId === aulaId && deJornada(s)), (s) => [t.grupo(s), t.quien(s), t.area(s)]),
  }
}

/**
 * Una fila por docente con `celdas[fila][día][franja - 1]`, en el orden del colegio. Un docente de mañana y tarde
 * sale en dos filas («· mañana» y «· tarde»); con `jornada`, solo los docentes y las clases de esa jornada.
 */
export const tablaGeneral = (e: Estado, ajuste?: AjusteDia, jornada?: Jornada): { docentes: Docente[]; dias: number[]; celdas: Celda[][][][] } => {
  const t = textos(e)
  const dias = diasVista(e, ajuste)
  const todas = sesionesVista(e, ajuste)
  const filas = filasPorJornada(e, jornada)
  return {
    docentes: filas.map((f) => f.docente),
    dias,
    celdas: filas.map(({ docente: d, jornada: j }) =>
      armar(dias, todas.filter((s) => esDe(s, d.id) && (!j || s.jornada === j)), (s) => [t.grupo(s), t.area(s), t.aula(s), ...t.nota(s, d.id)])),
  }
}

/** Las filas de docentes de las vistas que los muestran a todos: dos para quien dicta en las dos jornadas. */
const filasPorJornada = (e: Estado, jornada?: Jornada): { docente: Docente; id: Id; jornada?: Jornada }[] =>
  e.docentes.flatMap((d) => {
    const js = jornadasConClase(e, d)
    if (jornada) return js.includes(jornada) || dictaEn(d, jornada) ? [{ docente: d, id: d.id, jornada }] : []
    if (js.length < 2) return [{ docente: d, id: d.id }]
    return js.map((j) => ({ docente: { ...d, nombre: `${d.nombre} · ${CORTA[j]}` }, id: d.id, jornada: j }))
  })

/** Las vistas por aula: una por aula, o una por jornada cuando las dos jornadas la usan. */
export const vistasDeAula = (e: Estado): { id: Id; nombre: string }[] => {
  const todas = sesiones(e)
  return e.aulas.flatMap((a) => {
    const jornadas = new Set(todas.filter((s) => s.aulaId === a.id).map((s) => s.jornada))
    if (jornadas.size < 2) return [{ id: a.id, nombre: a.nombre }]
    return (['manana', 'tarde'] as const).map((j) => ({ id: `${a.id}@${j}`, nombre: `${a.nombre} · ${j === 'manana' ? 'mañana' : 'tarde'}` }))
  })
}

const SIN_PESO = new Set(['y', 'e', 'de', 'del', 'la', 'las', 'los', 'el'])

/** Código de tres letras de cada área para las celdas angostas de la sábana: MAT, LEN, CNA, CSO… */
export const codigosDeAreas = (areas: Area[]): Map<Id, string> => {
  const palabras = (n: string) => n.split(/\s+/).filter((w) => w && !SIN_PESO.has(w.toLowerCase()))
  const primero = (n: string) => (palabras(n)[0] ?? n).slice(0, 3).toUpperCase()
  const repetidos = new Set(areas.map((a) => primero(a.nombre)).filter((c, i, todos) => todos.indexOf(c) !== i))
  const usados = new Set<string>()
  return new Map(areas.map((a) => {
    const [p = '?', q] = palabras(a.nombre)
    let codigo = repetidos.has(primero(a.nombre)) ? (q ? p[0] + q.slice(0, 2) : p.slice(0, 4)).toUpperCase() : primero(a.nombre)
    for (let n = 2; usados.has(codigo); n++) codigo = `${codigo.slice(0, 3)}${n}`
    usados.add(codigo)
    return [a.id, codigo]
  }))
}

/** «Luz Marina Restrepo» → «Luz R.» */
export const nombreCorto = (nombre: string): string => {
  const p = nombre.trim().split(/\s+/)
  return p.length < 2 ? nombre.trim() : `${p[0]} ${p.at(-1)![0]}.`
}

export interface FilaSabana {
  nombre: string
  /** `celdas[día][franja - 1]` */
  celdas: Celda[][][]
}

const TITULO_SABANA = { grupo: 'Horario de todos los grupos', docente: 'Horario de todos los docentes', aula: 'Horario de todas las aulas' }

/** Todos los grupos (o docentes, o aulas) en una sola tabla: una fila por cada uno, con textos cortos en las celdas. */
export const tablaSabana = (e: Estado, tipo: Exclude<TipoVista, 'general'>, ajuste?: AjusteDia, jornada?: Jornada): { titulo: string; dias: number[]; filas: FilaSabana[]; codigos: Map<Id, string> } => {
  const codigos = codigosDeAreas(e.areas)
  const asignaciones = new Map(e.asignaciones.map((a) => [a.id, a]))
  const areaDe = new Map(e.clases.map((c) => [c.id, asignaciones.get(c.asignacionId)?.areaId ?? '']))
  const codigo = (c: Celda) => codigos.get(areaDe.get(c.claseId ?? '') ?? '') ?? '?'
  const lista: { id: Id; nombre: string; jornada?: Jornada }[] =
    tipo === 'grupo'
      ? [...e.grupos].sort((a, b) => a.grado - b.grado || a.numero - b.numero).flatMap((g) => {
          const js = jornadasDeGrupo(e, g)
          if (jornada) return js.includes(jornada) ? [{ id: g.id, nombre: nombreGrupo(g), jornada }] : []
          return js.length > 1 ? js.map((j) => ({ id: g.id, nombre: `${nombreGrupo(g)} · ${CORTA[j]}`, jornada: j })) : [{ id: g.id, nombre: nombreGrupo(g) }]
        })
    : tipo === 'docente' ? filasPorJornada(e, jornada).map((f) => ({ id: f.id, nombre: f.docente.nombre, jornada: f.jornada }))
    : vistasDeAula(e).map((v) => ({ ...v, jornada }))
  // Grupo: área y docente. Docente: grupo y área. Aula: grupo y área.
  const corto = (c: Celda): string[] =>
    tipo === 'grupo' ? [codigo(c), c.lineas[1] === 'Sin docente' || c.lineas[1] === 'Grupo ausente' ? c.lineas[1] : nombreCorto((c.lineas[1] ?? '').replace(' (reemplazo)', ''))]
    : tipo === 'docente' ? [c.lineas[1] ?? '', codigo(c)]
    : [c.lineas[0] ?? '', codigo(c)]
  return {
    titulo: TITULO_SABANA[tipo],
    dias: diasVista(e, ajuste),
    codigos,
    filas: lista.map(({ id, nombre, jornada: j }) => ({
      nombre,
      celdas: tablaDe(e, tipo, id, ajuste, j).celdas.map((dia) => dia.map((cs) => cs.map((c) => ({ ...c, lineas: corto(c) })))),
    })),
  }
}

/**
 * Las tablas de un docente, grupo o aula: un docente de mañana y tarde, sin jornada elegida, sale en dos tablas
 * (una por jornada), porque la franja 1 de la mañana y la de la tarde son horas distintas.
 */
export const tablasDe = (e: Estado, tipo: Exclude<TipoVista, 'general'>, id: Id, ajuste?: AjusteDia, jornada?: Jornada): Tabla[] => {
  if (jornada) return [tablaDe(e, tipo, id, ajuste, jornada)]
  const d = tipo === 'docente' ? e.docentes.find((x) => x.id === id) : undefined
  const g = tipo === 'grupo' ? e.grupos.find((x) => x.id === id) : undefined
  const js = d ? jornadasConClase(e, d) : g ? jornadasDeGrupo(e, g) : []
  return js.length > 1 ? js.map((j) => tablaDe(e, tipo, id, ajuste, j)) : [tablaDe(e, tipo, id, ajuste)]
}
