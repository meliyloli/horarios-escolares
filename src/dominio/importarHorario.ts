import { conAfinesComunes } from './afines'
import { nuevoBorrador } from './borradores'
import { sincronizarClases } from './edicion'
import { normal } from './importar'
import { lejania } from './nombres'
import { cicloDeGrupo, diasHorario, nivelDeGrado, nuevoId } from './tiempo'
import type { Area, Asignacion, Clase, Docente, Estado, Grupo, Id } from './tipos'

/** Una clase leída del horario general: quién, qué grupo, cuándo y las líneas de texto de la celda (área, aula…). */
export interface ClaseLeida { docente: string; grupo: string; dia: number; franja: number; lineas: string[] }

export interface HorarioLeido {
  /** El colegio que dice el encabezado del PDF. */
  colegio?: string
  dias: number[]
  /** Los docentes en el orden del PDF, aunque no tengan clases. */
  docentes: string[]
  clases: ClaseLeida[]
}

/** `sinAulas`: el PDF no trae aulas, así que la versión queda sin control de aulas. */
export interface ResumenImportacion { clases: number; docentesNuevos: string[]; gruposNuevos: string[]; areasNuevas: string[]; sinAulas: boolean }

export interface Emparejado {
  /** El nombre como sale en el PDF. */
  pdf: string
  /** El docente del colegio que le corresponde, o undefined si es nuevo. */
  docenteId?: Id
  /** Se llama igual (o el PDF lo trae cortado): no hace falta preguntar. */
  exacto: boolean
}

/**
 * A qué docente del colegio corresponde cada nombre del PDF. Primero los iguales (o cortados en el PDF); luego, entre los
 * que quedan, los más parecidos: el mismo primer nombre, «Odilia (apellido pendiente)» y «Odilia», «Yesenia» y «Yessenia».
 */
export const emparejarDocentes = (e: Estado, h: HorarioLeido): Emparejado[] => {
  const libres = new Set(e.docentes.map((d) => d.id))
  const r = new Map<string, Emparejado>()
  for (const nombre of h.docentes) {
    const n = normal(nombre)
    const d = e.docentes.find((x) => libres.has(x.id) && normal(x.nombre) === n) ??
      e.docentes.find((x) => libres.has(x.id) && n.length >= 6 && normal(x.nombre).startsWith(n))
    if (d) libres.delete(d.id)
    r.set(nombre, { pdf: nombre, docenteId: d?.id, exacto: !!d })
  }
  const pares = h.docentes.filter((n) => !r.get(n)!.exacto)
    .flatMap((n) => e.docentes.filter((d) => libres.has(d.id)).map((d) => ({ n, d, lejos: lejania(n, d.nombre) })))
    .filter((p) => p.lejos <= 0.6)
    .sort((a, b) => a.lejos - b.lejos)
  for (const { n, d } of pares)
    if (libres.has(d.id) && !r.get(n)!.docenteId) {
      r.get(n)!.docenteId = d.id
      libres.delete(d.id)
    }
  return h.docentes.map((n) => r.get(n)!)
}

/**
 * Crea una versión nueva, en uso, a partir de un horario general leído de un PDF. Parte de una copia de la versión
 * en uso (sus reglas, aulas, intensidad…) y reconoce sus docentes, grupos y áreas por nombre; lo que no reconoce lo crea.
 * La asignación sale de contar las clases de cada docente con cada grupo y área. La versión que estaba en uso queda guardada.
 */
export const versionDesdeHorario = (
  e: Estado, h: HorarioLeido, nombre: string,
  /** Lo que la persona eligió: nombre en el PDF → docente del colegio, o '' para agregarlo como nuevo. */
  equivalencias: Record<string, Id | ''> = {},
): { estado: Estado; resumen: ResumenImportacion } => {
  const propuestos = new Map(emparejarDocentes(e, h).map((x) => [x.pdf, x.docenteId]))
  const base = nuevoBorrador(e, nombre)
  const docentes: Docente[] = [...base.docentes]
  const grupos: Grupo[] = [...base.grupos]
  const areas: Area[] = [...base.areas]
  const resumen: ResumenImportacion = { clases: 0, docentesNuevos: [], gruposNuevos: [], areasNuevas: [], sinAulas: true }

  // Los nombres largos salen cortados en el PDF: «M.ª Yesenia (apellido» es «M.ª Yesenia (apellido pendiente)».
  const docenteId = new Map<string, Id>()
  const docenteDe = (texto: string): Id => {
    if (docenteId.has(texto)) return docenteId.get(texto)!
    const elegido = texto in equivalencias ? equivalencias[texto] || undefined : propuestos.get(texto)
    const d = docentes.find((x) => x.id === elegido)
    const id = d?.id ?? nuevoId()
    if (!d) {
      const suyas = h.clases.filter((c) => c.docente === texto)
      const primaria = suyas.length > 0 && suyas.every((c) => nivelDeGrado(Number(c.grupo.split('-')[0])) === 'primaria')
      docentes.push({ id, nombre: texto, areaId: '', nivel: primaria ? 'primaria' : 'bachillerato', jornada: 'manana', cargaSemanal: suyas.length, noDisponible: [] })
      resumen.docentesNuevos.push(texto)
    }
    docenteId.set(texto, id)
    return id
  }
  const grupoDe = (texto: string): Grupo => {
    const [grado, numero] = texto.split('-').map(Number)
    let g = grupos.find((x) => x.grado === grado && x.numero === numero)
    if (!g) {
      g = { id: nuevoId(), grado, numero, jornada: 'manana' }
      grupos.push(g)
      resumen.gruposNuevos.push(texto)
    }
    return g
  }
  /** El área está en las primeras líneas de la celda (puede venir partida en dos); después puede venir el aula. */
  const areaDe = (lineas: string[]): Id => {
    for (let k = lineas.length; k >= 1; k--) {
      const n = normal(lineas.slice(0, k).join(' '))
      const a = areas.find((x) => normal(x.nombre) === n)
      if (a) {
        if (k < lineas.length) resumen.sinAulas = false // lo que sigue al área es el aula
        return a.id
      }
    }
    const nombreArea = lineas[0] ?? 'Sin área'
    const a = { id: nuevoId(), nombre: nombreArea, afines: [] }
    areas.push(a)
    resumen.areasNuevas.push(nombreArea)
    if (lineas.length > 1) resumen.sinAulas = false
    return a.id
  }

  const asignaciones = new Map<string, Asignacion>()
  const clases: Clase[] = []
  for (const docente of h.docentes) docenteDe(docente)
  for (const c of h.clases) {
    const docente = docenteDe(c.docente)
    const g = grupoDe(c.grupo)
    const areaId = areaDe(c.lineas)
    const llave = `${docente}|${g.id}|${areaId}`
    const a = asignaciones.get(llave) ?? { id: nuevoId(), docenteId: docente, grupoId: g.id, areaId, horas: 0 }
    // Un grupo de ciclo de 5 días en un horario de 10 se repite: su semana 2 no es otra clase.
    if (c.dia > cicloDeGrupo(base, g)) continue
    a.horas++
    asignaciones.set(llave, a)
    clases.push({ id: `${a.id}#${a.horas}`, asignacionId: a.id, dia: c.dia, franja: c.franja, fijada: false })
  }
  // El área de cada docente nuevo es la que más dicta.
  for (const d of docentes)
    if (!d.areaId) {
      const cuenta = new Map<Id, number>()
      for (const a of asignaciones.values()) if (a.docenteId === d.id) cuenta.set(a.areaId, (cuenta.get(a.areaId) ?? 0) + a.horas)
      d.areaId = [...cuenta].sort((x, y) => y[1] - x[1])[0]?.[0] ?? ''
    }
  resumen.clases = clases.length
  if (clases.length === 0) resumen.sinAulas = false
  const colegio = resumen.sinAulas ? { ...base.colegio, modeloAula: 'ninguna' as const } : base.colegio
  // Las áreas nuevas que trae el PDF salen con las afines comunes; las del colegio quedan como estaban.
  const nuevas = new Set(areas.filter((a) => !base.areas.some((x) => x.id === a.id)).map((a) => a.id))
  const conAfines = conAfinesComunes({ ...base, areas }, true).areas.map((a, i) => (nuevas.has(a.id) ? a : areas[i]))
  const estado = sincronizarClases({ ...base, colegio, docentes, grupos, areas: conAfines, asignaciones: [...asignaciones.values()], clases })
  return { estado, resumen }
}

/** Para avisar si el PDF es de otro colegio o de otro ciclo que el abierto. */
export const diferenciasConColegio = (e: Estado, h: HorarioLeido): string[] => {
  const avisos: string[] = []
  if (h.colegio && normal(h.colegio) !== normal(e.colegio.nombre))
    avisos.push(`El horario es de «${h.colegio}» y el colegio abierto es «${e.colegio.nombre}». Lo que no coincida se agrega como docente, grupo o área nueva.`)
  if (Math.max(...h.dias) > diasHorario(e)) avisos.push(`El horario tiene ${Math.max(...h.dias)} días y el colegio abierto usa un ciclo de ${diasHorario(e)}.`)
  return avisos
}
