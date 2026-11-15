import type { Area, Asignacion, Docente, Estado, Grupo, Reglas } from './tipos'

export const reglasPorDefecto = (): Reglas => ({
  minimoAreaNombramiento: 12,
  maxMateriaDia: { activa: true, valor: 2 },
  maxDocenteDia: { activa: true, valor: 2, aplicaEspecialistas: true },
  horaLibre: { activa: true },
  bloques: { activa: false, primaria: false },
  libreDiaria: { activa: false },
  cargaPareja: { activa: false },
  espaciarMaterias: { activa: false, horas: 4 },
  bloquesDeDos: { activa: false },
})

/** Áreas obligatorias (Ley 115) con una lista inicial de afines que cada colegio edita. */
export const areasIniciales = (): Area[] => [
  { id: 'mat', nombre: 'Matemáticas', afines: ['tec', 'eti', 'rel'] },
  { id: 'len', nombre: 'Lengua Castellana', afines: ['ing', 'eti', 'rel'] },
  { id: 'ing', nombre: 'Inglés', afines: ['len', 'eti', 'rel'] },
  { id: 'nat', nombre: 'Ciencias Naturales', afines: ['tec', 'eti', 'rel'] },
  { id: 'soc', nombre: 'Ciencias Sociales', afines: ['fil', 'eti', 'rel'] },
  { id: 'fil', nombre: 'Filosofía', afines: ['soc', 'eti', 'rel'] },
  { id: 'art', nombre: 'Educación Artística', afines: ['efi', 'eti', 'rel'] },
  { id: 'efi', nombre: 'Educación Física', afines: ['art', 'eti', 'rel'] },
  { id: 'eti', nombre: 'Ética y Valores', afines: ['rel', 'soc', 'fil'] },
  { id: 'rel', nombre: 'Educación Religiosa', afines: ['eti', 'soc', 'fil'] },
  { id: 'tec', nombre: 'Tecnología e Informática', afines: ['mat', 'nat'] },
]

const PRIMARIA = { mat: 5, len: 5, ing: 2, nat: 3, soc: 3, art: 2, efi: 2, eti: 1, rel: 1, tec: 1 }
const BASICA = { mat: 5, len: 5, ing: 4, nat: 4, soc: 4, art: 2, efi: 2, eti: 1, rel: 1, tec: 2 }
const MEDIA = { mat: 5, len: 4, ing: 4, nat: 6, soc: 2, fil: 2, art: 1, efi: 2, eti: 1, rel: 1, tec: 2 }

/** Horas por semana de cada área en cada grado: 25 en primaria y 30 en bachillerato. */
export const intensidadInicial = (areas: Area[]): Estado['intensidad'] => {
  const ids = new Set(areas.map((a) => a.id))
  const intensidad: Estado['intensidad'] = {}
  for (let grado = 1; grado <= 11; grado++) {
    const base = grado <= 5 ? PRIMARIA : grado <= 9 ? BASICA : MEDIA
    intensidad[grado] = Object.fromEntries(Object.entries(base).filter(([id]) => ids.has(id)))
  }
  return intensidad
}

export const estadoVacio = (): Estado => {
  const areas = areasIniciales()
  return {
    version: 1,
    colegio: { nombre: 'Mi colegio', ciclo: 5, modeloAula: 'grupo', reglas: reglasPorDefecto() },
    areas,
    intensidad: intensidadInicial(areas),
    grupos: [], docentes: [], aulas: [], asignaciones: [], clases: [], ajustes: [],
  }
}

// Reparto del ejemplo: [docente, área de nombramiento, dirección de grupo, { área: grupos }].
// Cada docente de bachillerato suma 22 horas con al menos 12 en su área.
const BACHILLERATO: [string, string, string | undefined, Record<string, string>][] = [
  ['Luz Marina Restrepo', 'len', '6-1', { len: '6-1 6-2 7-1 7-2', eti: '6-1 6-2' }],
  ['Jorge Iván Cardona', 'len', '8-1', { len: '8-1 8-2 9-1 9-2', eti: '8-1 8-2' }],
  ['Beatriz Elena Zapata', 'len', '10-1', { len: '10-1 10-2 11-1', ing: '10-1 10-2', eti: '10-1 10-2' }],
  ['Andrés Felipe Ospina', 'ing', '7-1', { ing: '6-1 6-2 7-1 7-2 8-1', eti: '7-1 7-2' }],
  ['Diana Patricia Mejía', 'ing', '9-1', { ing: '8-2 9-1 9-2 11-1', eti: '9-1 9-2 11-1', rel: '9-1 9-2 11-1' }],
  ['Carlos Mario Giraldo', 'mat', '6-2', { mat: '6-1 6-2 7-1 7-2', tec: '6-1' }],
  ['Gloria Inés Arango', 'mat', '9-2', { mat: '8-1 8-2 9-1 9-2', tec: '8-1' }],
  ['Juan David Henao', 'mat', '11-1', { mat: '10-1 10-2 11-1', tec: '10-1 10-2 11-1', rel: '10-1' }],
  ['Sandra Milena Ríos', 'nat', '7-2', { nat: '6-1 6-2 7-1 7-2 8-1', tec: '6-2' }],
  ['Óscar Darío Vélez', 'nat', '8-2', { nat: '8-2 9-1 9-2 10-1', rel: '8-2 10-2 6-1 6-2' }],
  ['Paola Andrea Castaño', 'nat', '10-2', { nat: '10-2 11-1', tec: '7-1 7-2 8-2 9-1 9-2' }],
  ['Hernán Darío Montoya', 'soc', undefined, { soc: '6-1 6-2 7-1 7-2 8-1', fil: '11-1' }],
  ['María Eugenia Londoño', 'soc', undefined, { soc: '8-2 9-1 9-2 10-1 10-2 11-1', fil: '10-1 10-2' }],
  ['Wilson Alberto Marín', 'efi', undefined, { efi: '6-1 6-2 7-1 7-2 8-1 8-2 9-1 9-2 10-1 10-2 11-1' }],
  ['Claudia Marcela Duque', 'art', undefined, { art: '6-1 6-2 7-1 7-2 8-1 8-2 9-1 9-2 10-1 10-2 11-1', rel: '7-1 7-2 8-1' }],
]

const TITULARES = ['Rosa Elvira Gómez', 'Martha Lucía Pérez', 'Ana Milena Torres', 'Luis Fernando Agudelo', 'Yolanda Quintero']

/** Colegio ficticio con la asignación completa y válida, sin horario generado. */
export const colegioEjemplo = (): Estado => {
  const e = estadoVacio()
  e.colegio.nombre = 'Institución Educativa de Ejemplo'
  const nombres = ['1-1', '2-1', '3-1', '4-1', '5-1', '6-1', '6-2', '7-1', '7-2', '8-1', '8-2', '9-1', '9-2', '10-1', '10-2', '11-1']
  e.grupos = nombres.map((nombre): Grupo => {
    const [grado, numero] = nombre.split('-').map(Number)
    return { id: `g${nombre}`, grado, numero, jornada: 'manana', aulaId: `a${nombre}` }
  })
  e.aulas = nombres.map((nombre, i) => ({ id: `a${nombre}`, nombre: `Aula ${101 + i}`, capacidad: 35 }))

  const asignar = (docenteId: string, grupo: string, areaId: string): Asignacion => ({
    id: `${docenteId}-${grupo}-${areaId}`, docenteId, grupoId: `g${grupo}`, areaId,
    horas: e.intensidad[Number(grupo.split('-')[0])][areaId],
  })

  BACHILLERATO.forEach(([nombre, areaId, direccion, reparto], i) => {
    const d: Docente = {
      id: `d${i + 1}`, nombre, areaId, nivel: 'bachillerato', jornada: 'manana', cargaSemanal: 22,
      direccionGrupoId: direccion && `g${direccion}`, noDisponible: [],
    }
    e.docentes.push(d)
    for (const [area, grupos] of Object.entries(reparto))
      for (const grupo of grupos.split(' ')) e.asignaciones.push(asignar(d.id, grupo, area))
  })
  // Óscar Darío Vélez entra desde la 3.ª franja lunes y martes.
  e.docentes[9].noDisponible = ['1-1', '1-2', '2-1', '2-2']

  TITULARES.forEach((nombre, i) => {
    const grupo = `${i + 1}-1`
    const d: Docente = {
      id: `p${i + 1}`, nombre, areaId: 'len', nivel: 'primaria', jornada: 'manana', cargaSemanal: 25,
      rolPrimaria: 'titular', direccionGrupoId: `g${grupo}`, noDisponible: [],
    }
    e.docentes.push(d)
    for (const area of Object.keys(e.intensidad[i + 1])) e.asignaciones.push(asignar(d.id, grupo, area))
  })
  return e
}
