// Lectura de las tablas de un documento del colegio (intensidad horaria y asignación por docente).
// Aquí no se abre ningún archivo: llegan las tablas ya extraídas como filas de texto.
import { conAfinesComunes } from './afines'
import { normal } from './texto'
import { nivelDeGrado, nombreGrupo, nuevoId } from './tiempo'
import type { Area, Estado, Grupo, Id } from './tipos'

export type Tabla = string[][]
export type TipoTabla = 'intensidad' | 'asignacion' | 'ninguna'
export interface GrupoLeido { grado: number; numero?: number }
export interface FilaIntensidad { area: string; horas: Record<number, number> }
/** Sin `horas`, se toman de la intensidad horaria del área en el grado de cada grupo. */
export interface FilaAsignacion { docente: string; area: string; grupos: GrupoLeido[]; horas?: number }
export interface Columnas { encabezado: number; docente: number; area: number; grupos: number; horas: number }

/** Minúsculas, sin tildes ni signos: para comparar nombres escritos de formas distintas. */
export { normal } from './texto'

const ORDINALES = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'septimo', 'octavo', 'noveno', 'decimo', 'once']

/** Grado escrito como "6", "6°", "Sexto" o "Grado 9". */
export const gradoDe = (texto: string): number | undefined => {
  const t = normal(texto).replace(/^grado /, '')
  if (t === 'undecimo') return 11
  const palabra = ORDINALES.indexOf(t)
  if (palabra >= 0) return palabra + 1
  const n = /^\d{1,2}( ?[oa])?$/.test(t) ? parseInt(t, 10) : NaN
  return n >= 1 && n <= 11 ? n : undefined
}

/** Grupos escritos como "6-1", "601", "7°2", "6A" o solo el grado ("10°" = todos los grupos de décimo). */
const EN_PALABRAS: [RegExp, string][] = [
  [/\b(undecimos?|once)\b/g, '11°'], [/\bdecimos?\b/g, '10°'], [/\bnovenos?\b/g, '9°'], [/\boctavos?\b/g, '8°'], [/\bseptimos?\b/g, '7°'],
  [/\bsextos?\b/g, '6°'], [/\bquintos?\b/g, '5°'], [/\bcuartos?\b/g, '4°'], [/\btercer(os?)?\b/g, '3°'], [/\bsegundos?\b/g, '2°'], [/\bprimer(os?)?\b/g, '1°'],
]

export const gruposDe = (texto: string): GrupoLeido[] => {
  const grupos: GrupoLeido[] = []
  // "Séptimo 1" es "7° 1": se pasan a número los grados escritos en palabras.
  let t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  for (const [palabra, numero] of EN_PALABRAS) t = t.replace(palabra, numero)
  const patron = /(\d{3,4})\b|(\d{1,2})\s*(?:[°º]\s*|[-.]\s*)+(\d{1,2})|(\d{1,2})\s*[°º]?\s*-?\s*([a-f])\b|(\d{1,2})\s*[°º]?/g
  for (const m of t.matchAll(patron)) {
    const [grado, numero] = m[1] ? [Math.floor(Number(m[1]) / 100), Number(m[1]) % 100]
      : m[2] ? [Number(m[2]), Number(m[3])]
      : m[4] ? [Number(m[4]), m[5].toLowerCase().charCodeAt(0) - 96]
      : [Number(m[6]), undefined]
    if (grado < 1 || grado > 11 || numero === 0) continue
    grupos.push(numero === undefined ? { grado } : { grado, numero })
  }
  return grupos
}

const aHoras = (texto: string): number | undefined => {
  const m = texto.replace(',', '.').match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

/**
 * Fila de encabezado de una tabla de intensidad: entre las primeras filas, la que tiene al menos dos columnas
 * que son grados distintos y en orden (6°, 7°, 8°…). Una fila de datos con números sueltos no cuenta.
 */
const encabezadoIntensidad = (t: Tabla): number =>
  t.slice(0, 8).findIndex((fila) => {
    const grados = fila.map(gradoDe).filter((g): g is number => g !== undefined)
    return grados.length >= 2 && grados.every((g, i) => i === 0 || g > grados[i - 1])
  })

const COLUMNAS: [keyof Omit<Columnas, 'encabezado'>, RegExp][] = [
  ['docente', /docente|profesor|maestr|educador|licenciad|nombre|funcionari/],
  ['area', /area|asignatura|materia|disciplina|catedra/],
  ['grupos', /grupo|grado|curso|salon/],
  ['horas', /hora|\bi ?h( ?s)?\b|\bh ?s\b|intensidad|\bint\b/],
]

/** Qué columna es cada cosa en una fila de títulos (-1 si no está). Un grado suelto ("Grado 6") no es la columna de grupos. */
const columnasDeFila = (fila: string[]): Omit<Columnas, 'encabezado'> => {
  const usadas = new Set<number>()
  const r = { docente: -1, area: -1, grupos: -1, horas: -1 }
  for (const [campo, patron] of COLUMNAS) {
    const i = fila.findIndex((c, j) => !usadas.has(j) && patron.test(normal(c)) && !(campo === 'grupos' && gradoDe(c) !== undefined))
    if (i >= 0) {
      r[campo] = i
      usadas.add(i)
    }
  }
  return r
}
const cuantas = (c: Omit<Columnas, 'encabezado'>) => Object.values(c).filter((i) => i >= 0).length
/** Primera fila (de las 10 primeras) que tiene al menos dos títulos de asignación, o -1. */
const encabezadoAsignacion = (t: Tabla): number => t.slice(0, 10).findIndex((f) => f.filter((c) => c.trim()).length >= 2 && cuantas(columnasDeFila(f)) >= 2)

/** Una fila que abre una tabla: la de títulos de una asignación o la de grados de una intensidad. */
export const esEncabezado = (fila: string[]): boolean => {
  const grados = fila.map(gradoDe).filter((g): g is number => g !== undefined)
  const c = columnasDeFila(fila)
  return (cuantas(c) >= 2 && (c.docente >= 0 || c.grupos >= 0)) || (grados.length >= 2 && grados.every((g, i) => i === 0 || g > grados[i - 1]))
}

export const adivinarTipo = (t: Tabla): TipoTabla => {
  const e = encabezadoAsignacion(t)
  const c = e >= 0 ? columnasDeFila(t[e]) : undefined
  return c && (c.docente >= 0 || (c.area >= 0 && c.grupos >= 0)) ? 'asignacion' : encabezadoIntensidad(t) >= 0 ? 'intensidad' : 'ninguna'
}

/** Lee una tabla de áreas (filas) por grados (columnas). Salta totales y filas sin horas. */
export const leerIntensidad = (t: Tabla): { filas: FilaIntensidad[]; sinEntender: string[] } => {
  const e = encabezadoIntensidad(t)
  const filas: FilaIntensidad[] = []
  const sinEntender: string[] = []
  if (e < 0) return { filas, sinEntender }
  const grados = t[e].map(gradoDe)
  for (const fila of t.slice(e + 1)) {
    const area = fila.find((c, i) => grados[i] === undefined && c.trim())?.trim() ?? ''
    if (!area || normal(area).startsWith('total')) continue
    const horas: Record<number, number> = {}
    fila.forEach((c, i) => {
      const h = grados[i] !== undefined ? aHoras(c) : undefined
      if (h !== undefined) horas[grados[i]!] = h
    })
    if (Object.keys(horas).length) filas.push({ area, horas })
    else sinEntender.push(fila.filter((c) => c.trim()).join(' · '))
  }
  return { filas, sinEntender }
}

/** Busca la fila de encabezado y qué columna es cada cosa. -1 = no encontrada. */
export const adivinarColumnas = (t: Tabla): Columnas => {
  const encabezado = Math.max(0, encabezadoAsignacion(t))
  return { encabezado, ...columnasDeFila(t[encabezado] ?? []) }
}

const PALABRAS_DE_TITULO = /^((del?|la|los|y|o|completo|apellidos?|nombres?|semanal(es)?|horari[ao]s?|asignad[ao]s?|docentes?|profesor(es)?|areas?|asignaturas?|materias?|grupos?|grados?|cursos?|horas?|intensidad)\s*)+$/
const ETIQUETA = /^\s*(docentes?|profesor(a|es)?|lic(enciad[oa])?\.?|educador(a)?|maestr[oa])\s*:?\s*/i
/** "Docente: Ana Ruiz" o "Lic. Ana Ruiz" → "Ana Ruiz". */
const nombreEtiquetado = (texto: string): string | undefined => {
  const m = texto.match(ETIQUETA)
  const resto = m && texto.slice(m[0].length).trim()
  return resto && /[a-zá-úñ]/i.test(resto) ? resto : undefined
}
const pareceNombre = (texto: string) => !/\d/.test(texto) && texto.trim().split(/\s+/).length >= 2 && texto.trim().split(/\s+/).length <= 6

/**
 * Lee una tabla de asignación. El docente puede venir en su columna (si está vacía se hereda de la fila
 * anterior, como en las celdas combinadas de Word), como título arriba de la tabla ("Docente: …"), como una
 * fila suelta con solo su nombre, o de la tabla anterior (`docenteAnterior`, cuando la tabla sigue en otra página).
 * Una fila sin área ni horas que trae más nombre o más grupos es la continuación de la de arriba (renglones de un PDF).
 * `horasPorGrupo`: la columna de horas vale para cada grupo (si no, es el total de la fila). Sin horas, salen de la intensidad.
 */
export const leerAsignacion = (t: Tabla, c: Columnas, horasPorGrupo = true, docenteFijo = '', docenteAnterior = '') => {
  const filas: FilaAsignacion[] = []
  const sinEntender: string[] = []
  const titulo = t.slice(0, c.encabezado).flat().map(nombreEtiquetado).find(Boolean)
  let docente = docenteFijo.trim() || titulo || docenteAnterior.trim()
  let area = ''
  let conNombreArriba = false // la fila anterior traía el nombre del docente en su celda
  let enTitulos = true // renglones que siguen al encabezado y son la otra mitad de sus títulos ("Nombre del" / "docente")
  for (const fila of t.slice(c.encabezado + 1)) {
    const celda = (i: number) => (i >= 0 ? (fila[i] ?? '').trim() : '')
    const llenas = fila.map((x) => x.trim()).filter(Boolean)
    if (llenas.length === 0) continue
    if (enTitulos && llenas.every((x) => !/\d/.test(x) && PALABRAS_DE_TITULO.test(normal(x)))) continue
    enTitulos = false
    if (normal(llenas.join(' ')).startsWith('total')) continue
    if (llenas.length === 1 && !docenteFijo) {
      const etiquetado = nombreEtiquetado(llenas[0])
      if (etiquetado || (c.docente < 0 && pareceNombre(llenas[0]))) {
        docente = etiquetado ?? llenas[0]
        conNombreArriba = false
        continue
      }
    }
    const nombre = celda(c.docente)
    const areaFila = celda(c.area)
    const grupos = gruposDe(celda(c.grupos))
    const horas = aHoras(celda(c.horas))
    // Solo es continuación si lo que trae está en las columnas de docente y grupos, y los grupos se entienden.
    const soloNombreYGrupos = fila.every((x, i) => !x.trim() || i === c.docente || i === c.grupos) && (!celda(c.grupos) || grupos.length > 0) && !/\d/.test(nombre)
    if (filas.length && soloNombreYGrupos && (nombre || grupos.length)) {
      const ultima = filas.at(-1)!
      if (nombre && conNombreArriba) {
        // El nombre siguió en el renglón de abajo: se completa en todas sus filas.
        const completo = `${docente} ${nombre}`
        for (const f of filas) if (f.docente === docente) f.docente = completo
        docente = completo
      } else if (nombre) docente = nombre
      if (grupos.length) ultima.grupos = [...ultima.grupos, ...grupos]
      continue
    }
    if (nombre) docente = nombre
    conNombreArriba = !!nombre
    if (areaFila) area = areaFila
    if (!docente || !area || grupos.length === 0) {
      sinEntender.push(llenas.join(' · '))
      continue
    }
    filas.push({ docente, area, grupos, ...(horas === undefined ? {} : { horas: horasPorGrupo ? horas : horas / grupos.length }) })
  }
  return { filas, sinEntender, ultimoDocente: docente }
}

/**
 * Asignaturas que los colegios suelen escribir con otro nombre, y una palabra del nombre del área a la que pertenecen.
 * El orden importa: "Educación física" se revisa antes que "Física" (que es de Ciencias Naturales).
 */
const ASIGNATURAS: [RegExp, string][] = [
  [/\beducacion fisica\b|\bdeportes?\b|\brecreacion\b/, 'fisica'],
  [/\betica\b|\bvalores\b/, 'etica'],
  [/\breligion\b|\breligiosa\b/, 'religios'],
  [/\bartistica\b|\bartes?\b|\bmusica\b|\bdanzas?\b|\bdibujo\b|\bteatro\b/, 'artistic'],
  [/\binformatica\b|\bsistemas\b|\btecnologia\b|\bcomputacion\b/, 'tecnologia'],
  [/\bespanol\b|\bcastellan[oa]\b|\blenguaje\b|\blectura\b|\bliteratura\b|\bcomprension lectora\b/, 'castellan'],
  [/\bingles\b|\bidioma extranjero\b|\blengua extranjera\b/, 'ingles'],
  [/\bfisica\b|\bquimica\b|\bbiologia\b|\bnaturales\b|\bambiental\b/, 'naturales'],
  [/\bgeometria\b|\bestadistica\b|\balgebra\b|\btrigonometria\b|\bcalculo\b|\baritmetica\b|\bmatematicas?\b/, 'matematic'],
  [/\bhistoria\b|\bgeografia\b|\bsociales\b|\bdemocracia\b|\bcivica\b|\bconstitucion\b|\bcatedra de (la )?paz\b|\bafrocolombian/, 'sociales'],
  [/\bfilosofia\b/, 'filosof'],
]

/** El área a la que pertenece una asignatura escrita en un documento, o undefined si no se puede saber. */
export const areaSugerida = (e: Pick<Estado, 'areas'>, nombre: string): Area | undefined => {
  const n = normal(nombre)
  const igual = e.areas.find((a) => normal(a.nombre) === n)
  if (igual) return igual
  for (const [patron, clave] of ASIGNATURAS)
    if (patron.test(n)) {
      const area = e.areas.find((a) => normal(a.nombre).includes(clave))
      if (area) return area
    }
  // "Humanidades: Lengua Castellana" es "Lengua Castellana" si solo una área encaja.
  const parecidas = e.areas.filter((a) => {
    const x = normal(a.nombre)
    return Math.min(x.length, n.length) >= 6 && (x.includes(n) || n.includes(x))
  })
  return parecidas.length === 1 ? parecidas[0] : undefined
}

/** Asignaturas leídas que no se llaman igual que un área del colegio, con el área que la app sugiere. */
export const asignaturasSinArea = (e: Pick<Estado, 'areas'>, leido: { intensidad?: FilaIntensidad[]; asignacion?: FilaAsignacion[] }) => {
  const vistas = new Set<string>()
  const lista: { nombre: string; sugerida: Id | undefined }[] = []
  for (const nombre of [...(leido.intensidad ?? []), ...(leido.asignacion ?? [])].map((f) => f.area.trim())) {
    const n = normal(nombre)
    if (vistas.has(n) || e.areas.some((a) => normal(a.nombre) === n)) continue
    vistas.add(n)
    lista.push({ nombre, sugerida: areaSugerida(e, nombre)?.id })
  }
  return lista
}

export interface ResumenImportacion {
  areasNuevas: string[]
  gruposNuevos: string[]
  docentesNuevos: string[]
  filasAsignacion: number
  celdasIntensidad: number
  /** Filas sin horas cuya área tampoco tiene intensidad en ese grado: no se importan. */
  sinHoras: string[]
}

/**
 * Pasa lo leído al colegio: llena la intensidad, crea las áreas, grupos y docentes que falten y agrega la asignación.
 * Lo que ya existe se reconoce por nombre (sin importar tildes ni mayúsculas) y no se duplica.
 */
export const aplicarImportacion = (
  e: Estado,
  leido: {
    intensidad?: FilaIntensidad[]
    asignacion?: FilaAsignacion[]
    reemplazarAsignacion?: boolean
    /** Por asignatura (nombre normalizado): el id del área a la que pertenece, o 'nueva' para crearla como área. */
    equivalencias?: Record<string, Id | 'nueva'>
  },
): { estado: Estado; resumen: ResumenImportacion } => {
  const resumen: ResumenImportacion = { areasNuevas: [], gruposNuevos: [], docentesNuevos: [], filasAsignacion: 0, celdasIntensidad: 0, sinHoras: [] }
  const areas = [...e.areas]
  const grupos = [...e.grupos]
  const docentes = [...e.docentes]
  const intensidad = Object.fromEntries(Object.entries(e.intensidad).map(([g, h]) => [g, { ...h }])) as Estado['intensidad']
  let asignaciones = leido.reemplazarAsignacion && leido.asignacion?.length ? [] : [...e.asignaciones]

  const areaDe = (nombre: string) => {
    const n = normal(nombre)
    const elegida = leido.equivalencias?.[n]
    let area = elegida === 'nueva'
      ? areas.find((a) => normal(a.nombre) === n)
      : (elegida && areas.find((a) => a.id === elegida)) || areaSugerida({ areas }, nombre)
    if (!area) {
      area = { id: nuevoId(), nombre: nombre.trim(), afines: [] }
      areas.push(area)
      resumen.areasNuevas.push(area.nombre)
    }
    return area
  }

  const gruposDeLeido = (g: GrupoLeido): Grupo[] => {
    const delGrado = grupos.filter((x) => x.grado === g.grado)
    if (g.numero === undefined && delGrado.length) return delGrado
    const numero = g.numero ?? 1
    let grupo = delGrado.find((x) => x.numero === numero)
    if (!grupo) {
      grupo = { id: nuevoId(), grado: g.grado, numero, jornada: 'manana' }
      grupos.push(grupo)
      resumen.gruposNuevos.push(nombreGrupo(grupo))
    }
    return [grupo]
  }

  for (const fila of leido.intensidad ?? []) {
    const area = areaDe(fila.area)
    for (const [grado, horas] of Object.entries(fila.horas)) {
      intensidad[Number(grado)] = { ...intensidad[Number(grado)], [area.id]: horas }
      resumen.celdasIntensidad++
    }
  }

  const nuevos = new Set<string>()
  const tocadas = new Set<Id>() // filas de asignación que ya vienen de este documento
  for (const fila of leido.asignacion ?? []) {
    const area = areaDe(fila.area)
    const destino = fila.grupos.flatMap(gruposDeLeido)
    let docente = docentes.find((d) => normal(d.nombre) === normal(fila.docente))
    if (!docente) {
      const nivel = nivelDeGrado(destino[0].grado)
      docente = { id: nuevoId(), nombre: fila.docente.trim(), areaId: area.id, nivel, jornada: destino[0].jornada, cargaSemanal: nivel === 'primaria' ? 25 : 22, rolPrimaria: nivel === 'primaria' ? 'especialista' : undefined, noDisponible: [] }
      docentes.push(docente)
      nuevos.add(docente.id)
      resumen.docentesNuevos.push(docente.nombre)
    }
    for (const g of destino) {
      const horas = Math.round(fila.horas ?? ((intensidad[g.grado]?.[area.id] ?? 0) * (g.ciclo ?? e.colegio.ciclo)) / 5)
      if (!horas) {
        resumen.sinHoras.push(`${area.nombre} en ${nombreGrupo(g)} (${docente.nombre})`)
        continue
      }
      const i = asignaciones.findIndex((a) => a.docenteId === docente.id && a.grupoId === g.id && a.areaId === area.id)
      // Lo que ya había se reemplaza (reimportar no duplica); dentro de este documento, las asignaturas de una misma área se suman.
      if (i >= 0) asignaciones[i] = { ...asignaciones[i], horas: tocadas.has(asignaciones[i].id) ? asignaciones[i].horas + horas : horas }
      else asignaciones = [...asignaciones, { id: nuevoId(), docenteId: docente.id, grupoId: g.id, areaId: area.id, horas }]
      tocadas.add(asignaciones[i >= 0 ? i : asignaciones.length - 1].id)
      resumen.filasAsignacion++
    }
  }
  // A cada docente nuevo se le pone como área de nombramiento la que más horas dicta; en primaria,
  // quien dicta todo a un solo grupo queda como titular.
  for (const d of docentes.filter((x) => nuevos.has(x.id))) {
    const suyas = asignaciones.filter((a) => a.docenteId === d.id)
    const porArea = new Map<string, number>()
    for (const a of suyas) porArea.set(a.areaId, (porArea.get(a.areaId) ?? 0) + a.horas)
    d.areaId = [...porArea].sort((x, y) => y[1] - x[1])[0]?.[0] ?? d.areaId
    const unSoloGrupo = new Set(suyas.map((a) => a.grupoId)).size === 1
    if (d.nivel === 'primaria' && unSoloGrupo && porArea.size >= 3) Object.assign(d, { rolPrimaria: 'titular', direccionGrupoId: suyas[0].grupoId })
  }
  // Las áreas que llegan nuevas del documento salen con las afines comunes; las del colegio no se tocan.
  const nuevas = new Set(areas.filter((a) => !e.areas.some((x) => x.id === a.id)).map((a) => a.id))
  const conAfines = conAfinesComunes({ ...e, areas }, true).areas.map((a, i) => (nuevas.has(a.id) ? a : areas[i]))
  return { estado: { ...e, areas: conAfines, grupos, docentes, intensidad, asignaciones }, resumen }
}
