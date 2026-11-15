import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { ajusteVacio } from './reemplazos'
import { codigosDeAreas, nombreCorto, tablaDe, tablaGeneral, tablaSabana, tablasDe, vistasDeAula } from './vistas'
import { areasIniciales } from './ejemplo'

const colegio = () =>
  mini({
    grupos: [grp('a', 7)],
    docentes: [doc('d', { nombre: 'Ana Ruiz', direccionGrupoId: 'a' }), doc('x', { nombre: 'Luis Gil', areaId: 'len' })],
    aulas: [{ id: 'aula-a', nombre: 'Aula 101' }],
    asignaciones: [asg('d', 'a', 'mat', 5), asg('x', 'a', 'len', 5)],
    clases: [cls('d|a|mat', 2, 3, { id: 'm', fijada: true }), cls('x|a|len', 2, 4, { id: 'l' })],
  })

describe('vistas del horario', () => {
  it('por grupo: cada franja muestra área, docente y aula', () => {
    const t = tablaDe(colegio(), 'grupo', 'a')
    expect(t.titulo).toBe('Grupo 7-1')
    expect(t.subtitulo).toContain('Ana Ruiz')
    expect(t.dias).toEqual([1, 2, 3, 4, 5])
    expect(t.celdas[1][2]).toEqual([{ claseId: 'm', lineas: ['Matemáticas', 'Ana Ruiz', 'Aula 101'], situacion: 'normal', fijada: true }])
    expect(t.celdas[0][0]).toEqual([])
  })
  it('por docente: área, grupo y aula', () => {
    const t = tablaDe(colegio(), 'docente', 'd')
    expect(t.titulo).toBe('Ana Ruiz')
    expect(t.celdas[1][2][0].lineas).toEqual(['Matemáticas', '7-1', 'Aula 101'])
    expect(t.celdas[1][3]).toEqual([])
  })
  it('por aula: qué grupo y docente la usan', () => {
    const t = tablaDe(colegio(), 'aula', 'aula-a')
    expect(t.titulo).toBe('Aula 101')
    expect(t.celdas[1][3][0].lineas).toEqual(['7-1', 'Luis Gil', 'Lengua Castellana'])
  })
  it('general: todos los docentes con sus clases', () => {
    const g = tablaGeneral(colegio())
    expect(g.docentes.map((d) => d.nombre)).toEqual(['Ana Ruiz', 'Luis Gil'])
    expect(g.celdas[0][1][2][0].lineas).toEqual(['7-1', 'Matemáticas', 'Aula 101'])
    expect(g.celdas[1][1][3][0].lineas).toEqual(['7-1', 'Lengua Castellana', 'Aula 101'])
  })
  it('dos clases en la misma celda aparecen las dos', () => {
    const e = colegio()
    e.clases[1].franja = 3
    expect(tablaDe(e, 'grupo', 'a').celdas[1][2].map((c) => c.claseId)).toEqual(['m', 'l'])
  })
  it('con un ajuste muestra solo ese día, con el reemplazo y las clases sin docente', () => {
    const e = colegio()
    const aj = { ...ajusteVacio('2026-11-10', 2), ausencias: [{ docenteId: 'd', franjas: [3] }] }
    const sin = tablaDe(e, 'grupo', 'a', aj)
    expect(sin.dias).toEqual([2])
    expect(sin.celdas[0][2][0]).toMatchObject({ lineas: ['Matemáticas', 'Sin docente', 'Aula 101'], situacion: 'sinDocente' })
    const con = { ...aj, reemplazos: [{ claseId: 'm', docenteId: 'x' }] }
    expect(tablaDe(e, 'grupo', 'a', con).celdas[0][2][0]).toMatchObject({ lineas: ['Matemáticas', 'Luis Gil (reemplazo)', 'Aula 101'], situacion: 'reemplazo' })
    expect(tablaDe(e, 'docente', 'x', con).celdas[0][2][0].lineas).toEqual(['Matemáticas', '7-1', 'Aula 101', 'Reemplaza a Ana Ruiz'])
    expect(tablaDe(e, 'docente', 'd', con).celdas[0][2][0].lineas).toEqual(['Matemáticas', '7-1', 'Aula 101', 'Cubre Luis Gil'])
  })
  it('un aula que usan las dos jornadas tiene una vista por jornada', () => {
    const e = colegio()
    e.grupos.push(grp('t', 7, { numero: 2, jornada: 'tarde', aulaId: 'aula-a' }))
    e.docentes.push(doc('w', { nombre: 'Eva Paz', jornada: 'tarde' }))
    e.asignaciones.push(asg('w', 't', 'mat', 5))
    e.clases.push(cls('w|t|mat', 2, 3, { id: 'tarde' }))
    expect(vistasDeAula(e).map((v) => v.nombre)).toEqual(['Aula 101 · mañana', 'Aula 101 · tarde'])
    const [manana, tarde] = vistasDeAula(e).map((v) => tablaDe(e, 'aula', v.id))
    expect(manana.celdas[1][2].map((c) => c.claseId)).toEqual(['m'])
    expect(tarde.celdas[1][2].map((c) => c.claseId)).toEqual(['tarde'])
    expect(tarde.titulo).toBe('Aula 101 · tarde')
    expect(vistasDeAula(colegio()).map((v) => v.nombre)).toEqual(['Aula 101'])
  })
  it('no falla con un id que ya no existe', () => {
    expect(tablaDe(colegio(), 'docente', 'borrado').celdas.flat(2)).toEqual([])
  })
})

describe('sábana: todos en una sola tabla', () => {
  it('cada área tiene un código corto y único para las celdas', () => {
    const c = codigosDeAreas(areasIniciales())
    const por = (nombre: string) => c.get(areasIniciales().find((a) => a.nombre === nombre)!.id)
    expect(por('Matemáticas')).toBe('MAT')
    expect(por('Ciencias Naturales')).toBe('CNA')
    expect(por('Ciencias Sociales')).toBe('CSO')
    expect(new Set(c.values()).size).toBe(c.size)
  })
  it('el nombre corto de un docente es su primer nombre y la inicial del apellido', () => {
    expect(nombreCorto('Luz Marina Restrepo')).toBe('Luz R.')
    expect(nombreCorto('Ana')).toBe('Ana')
  })
  it('una fila por grupo, ordenados, con el código del área y el docente en cada clase', () => {
    const e = mini({
      grupos: [grp('b', 8), grp('a', 7)],
      docentes: [doc('d', { nombre: 'Ana María Ruiz', cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|b|mat', 2, 3)],
    })
    const s = tablaSabana(e, 'grupo')
    expect(s.titulo).toBe('Horario de todos los grupos')
    expect(s.filas.map((f) => f.nombre)).toEqual(['7-1', '8-1'])
    expect(s.filas[0].celdas[0][0][0].lineas).toEqual(['MAT', 'Ana R.'])
    const d = tablaSabana(e, 'docente')
    expect(d.titulo).toBe('Horario de todos los docentes')
    expect(d.filas[0].celdas[1][2][0].lineas).toEqual(['8-1', 'MAT'])
  })
})

describe('vistas por jornada', () => {
  const e = () =>
    mini({
      grupos: [grp('a', 7), grp('b', 8, { jornada: 'tarde' })],
      docentes: [doc('d', { nombre: 'Ana Ruiz', jornada: 'ambas', cargaSemanal: 2 }), doc('x', { nombre: 'Luis Gil', cargaSemanal: 1 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1), asg('x', 'a', 'len', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1), cls('x|a|len', 1, 2)],
    })
  it('el horario de un docente de dos jornadas se ve por jornada', () => {
    const manana = tablaDe(e(), 'docente', 'd', undefined, 'manana')
    expect(manana.titulo).toBe('Ana Ruiz · mañana')
    expect(manana.celdas[0][0].map((c) => c.lineas[1])).toEqual(['7-1'])
    expect(tablaDe(e(), 'docente', 'd', undefined, 'tarde').celdas[0][0].map((c) => c.lineas[1])).toEqual(['8-1'])
  })
  it('en la vista general sale en una fila por jornada, y se puede ver solo una jornada', () => {
    expect(tablaGeneral(e()).docentes.map((d) => d.nombre)).toEqual(['Ana Ruiz · mañana', 'Ana Ruiz · tarde', 'Luis Gil'])
    const tarde = tablaGeneral(e(), undefined, 'tarde')
    expect(tarde.docentes.map((d) => d.nombre)).toEqual(['Ana Ruiz'])
    expect(tarde.celdas[0][0][0].map((c) => c.lineas[0])).toEqual(['8-1'])
  })
  it('los grupos y la sábana se filtran por jornada', () => {
    expect(tablaSabana(e(), 'grupo', undefined, 'tarde').filas.map((f) => f.nombre)).toEqual(['8-1'])
    expect(tablaSabana(e(), 'docente', undefined, 'manana').filas.map((f) => f.nombre)).toEqual(['Ana Ruiz', 'Luis Gil'])
  })
})

describe('vistas con contrajornada', () => {
  const e = () =>
    mini({
      grupos: [grp('a', 7)],
      docentes: [doc('d', { nombre: 'Ana Ruiz', jornada: 'ambas', cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 1), { ...asg('d', 'a', 'tec', 1), jornada: 'tarde' as const }],
      clases: [cls('d|a|mat', 1, 1), cls('d|a|tec', 1, 1)],
    })
  it('el grupo con materias en la tarde se ve en dos tablas', () => {
    const t = tablasDe(e(), 'grupo', 'a')
    expect(t.map((x) => x.titulo)).toEqual(['Grupo 7-1 · mañana', 'Grupo 7-1 · tarde'])
    expect(t[1].celdas[0][0].map((c) => c.lineas[0])).toEqual(['Tecnología'])
  })
  it('el grupo aparece también al ver solo la tarde, con lo de la tarde', () => {
    const s = tablaSabana(e(), 'grupo', undefined, 'tarde')
    expect(s.filas.map((f) => f.nombre)).toEqual(['7-1'])
    expect(s.filas[0].celdas[0][0][0].lineas[0]).toBe('TEC')
  })
})

describe('docente con clases en las dos jornadas', () => {
  it('aunque sea de la mañana, si dicta media técnica en la tarde se ve en dos tablas y dos filas', () => {
    const e = mini({
      areas: [{ id: 'nat', nombre: 'Química', afines: [] }, { id: 'mt', nombre: 'Media técnica', afines: [] }],
      grupos: [grp('a', 10)],
      docentes: [doc('d', { nombre: 'Ángela', areaId: 'nat', cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'nat', 1), asg('d', 'a', 'mt', 1)],
      clases: [cls('d|a|nat', 1, 3), cls('d|a|mt', 1, 3)],
    })
    expect(tablasDe(e, 'docente', 'd').map((t) => t.jornada)).toEqual(['manana', 'tarde'])
    expect(tablaGeneral(e).docentes.map((d) => d.nombre)).toEqual(['Ángela · mañana', 'Ángela · tarde'])
  })
})
