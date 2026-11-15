import { describe, expect, it } from 'vitest'
import { asg, doc, grp, mini } from './ayudaPruebas'
import { diagnosticar, prechequear } from './diagnostico'
import { generarHorario } from './generador'
import type { Estado } from './tipos'

const sinMaxDocente = (e: Estado): Estado => {
  e.colegio.reglas.maxDocenteDia.activa = false
  return e
}
const diagnostico = (e: Estado) => diagnosticar(e, generarHorario(e, { tiempoMs: 300 }))

describe('diagnóstico cuando no hay solución', () => {
  it('docente con más horas que franjas disponibles: lo nombra y propone cambiar su disponibilidad', () => {
    const bloqueadas = [1, 2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`)).filter((k) => !(k < '3' && !k.endsWith('6')))
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8), grp('c', 9)], docentes: [doc('d', { nombre: 'Ana', noDisponible: bloqueadas })],
      asignaciones: [asg('d', 'a', 'mat', 8), asg('d', 'b', 'mat', 8), asg('d', 'c', 'mat', 6)],
    })
    const antes = JSON.stringify(e)
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos[0]).toMatchObject({ tipo: 'docenteSinFranjas', docenteId: 'd' })
    expect(bloqueos[0].mensaje).toContain('Ana')
    const propuesta = propuestas.find((p) => p.tipo === 'disponibilidad')!
    expect(propuesta.resuelve).toBe(true)
    expect(propuesta.aplicar(e).docentes[0].noDisponible).toEqual([])
    expect(JSON.stringify(e)).toBe(antes)
  })
  it('materia que no cabe con el máximo diario: propone relajar la regla y no la relaja sola', () => {
    const e = sinMaxDocente(mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 12 })], asignaciones: [asg('d', 'a', 'mat', 12)],
    }))
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos.map((b) => b.tipo)).toContain('materiaNoCabe')
    const propuesta = propuestas.find((p) => p.tipo === 'relajarRegla')!
    expect(propuesta.resuelve).toBe(true)
    expect(propuesta.aplicar(e).colegio.reglas.maxMateriaDia.valor).toBe(3)
    expect(e.colegio.reglas.maxMateriaDia.valor).toBe(2)
  })
  it('demasiadas horas con el mismo docente para un grupo', () => {
    const e = mini({ grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 12 })], asignaciones: [asg('d', 'a', 'mat', 6), asg('d', 'a', 'tec', 6)] })
    expect(prechequear(e).map((b) => b.tipo)).toEqual(['docenteGrupoNoCabe'])
  })
  it('aula con más clases que franjas: propone agregar un aula', () => {
    const e = sinMaxDocente(mini({
      grupos: [grp('a', 7, { aulaId: 'sala' }), grp('b', 8, { aulaId: 'sala' })],
      docentes: [doc('d', { cargaSemanal: 16 }), doc('x', { cargaSemanal: 16, areaId: 'len' })],
      asignaciones: [asg('d', 'a', 'mat', 8), asg('d', 'a', 'tec', 8), asg('x', 'b', 'len', 8), asg('x', 'b', 'ing', 8)],
    }))
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos.map((b) => b.tipo)).toContain('aulaSinFranjas')
    const propuesta = propuestas.find((p) => p.tipo === 'aula')!
    expect(propuesta.resuelve).toBe(true)
    const despues = propuesta.aplicar(e)
    expect(despues.aulas).toHaveLength(e.aulas.length + 1)
    expect(new Set(despues.grupos.map((g) => g.aulaId)).size).toBe(2)
  })
  it('choque que solo aparece al buscar: propone reasignar a otro docente del área', () => {
    // Ana solo puede los lunes y debe dictar 4 horas a un grupo: el máximo diario de 2 lo impide.
    const soloLunes = [2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`))
    const e = mini({
      grupos: [grp('a', 7)],
      docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 4, noDisponible: soloLunes }), doc('x', { nombre: 'Luis', cargaSemanal: 4 })],
      asignaciones: [asg('d', 'a', 'mat', 4)],
    })
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos.map((b) => b.tipo)).toEqual(['busqueda'])
    const reasignar = propuestas.find((p) => p.tipo === 'reasignar')!
    expect(reasignar.descripcion).toContain('Luis')
    expect(reasignar.resuelve).toBe(true)
    const despues = reasignar.aplicar(e)
    expect(despues.asignaciones.filter((a) => a.docenteId === 'x').reduce((s, a) => s + a.horas, 0)).toBe(2)
    expect(despues.asignaciones.reduce((s, a) => s + a.horas, 0)).toBe(4)
  })
  it('solo propone reasignar a un docente que tenga cupo para esas horas', () => {
    const soloLunes = [2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`))
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)],
      docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 4, noDisponible: soloLunes }), doc('x', { nombre: 'Luis', cargaSemanal: 2 }), doc('z', { nombre: 'Zoe', cargaSemanal: 6 })],
      asignaciones: [asg('d', 'a', 'mat', 4), asg('x', 'b', 'mat', 2), asg('z', 'b', 'len', 2)],
    })
    const reasignar = diagnostico(e).propuestas.filter((p) => p.tipo === 'reasignar')
    expect(reasignar.map((p) => p.descripcion).join(' ')).toContain('Zoe') // Zoe tiene 4 horas libres en su carga
    expect(reasignar.map((p) => p.descripcion).join(' ')).not.toContain('Luis') // Luis ya está completo
  })
  it('ordena las propuestas de menor a mayor impacto', () => {
    const soloLunes = [2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`))
    const e = mini({
      grupos: [grp('a', 7)],
      docentes: [doc('d', { cargaSemanal: 4, noDisponible: soloLunes }), doc('x', { cargaSemanal: 4 })],
      asignaciones: [asg('d', 'a', 'mat', 4)],
    })
    const impactos = diagnostico(e).propuestas.map((p) => p.impacto)
    expect(impactos).toEqual([...impactos].sort())
    expect(new Set(impactos).size).toBeGreaterThan(1)
    expect(impactos.length).toBeLessThanOrEqual(8)
  })
  it('un horario completo no tiene bloqueos ni propuestas', () => {
    const e = mini({ grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 5 })], asignaciones: [asg('d', 'a', 'mat', 5)] })
    expect(diagnostico(e)).toEqual({ bloqueos: [], propuestas: [] })
  })
})

describe('diagnóstico de la hora libre diaria', () => {
  it('un docente con más horas de las que caben dejando una libre cada día: lo nombra y propone quitar la regla', () => {
    const e = sinMaxDocente(mini({
      grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 27 })],
      asignaciones: [asg('d', 'a', 'mat', 14), asg('d', 'b', 'mat', 13)],
    }))
    e.colegio.reglas.maxMateriaDia.valor = 3
    e.colegio.reglas.horaLibre.activa = false
    e.colegio.reglas.libreDiaria = { activa: true }
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos[0].mensaje).toBe('Ana tiene 27 horas y, dejando una hora libre cada día, solo caben 25.')
    const p = propuestas.find((x) => x.descripcion === 'Desactivar la regla de una hora libre todos los días.')!
    expect(p.resuelve).toBe(true)
  })
})

describe('diagnóstico de materias cortas en días separados', () => {
  it('si solo caben en días seguidos, lo dice y propone quitar la regla', () => {
    // Ana solo viene lunes y martes, y su materia de 2 horas va con máximo 1 por día.
    const soloLunesMartes = [3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`))
    const e = sinMaxDocente(mini({ grupos: [grp('a', 7)], docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 2, noDisponible: soloLunesMartes })], asignaciones: [asg('d', 'a', 'ing', 2)] }))
    e.colegio.reglas.maxMateriaDia.valor = 1
    e.colegio.reglas.horaLibre.activa = false
    e.colegio.reglas.espaciarMaterias = { activa: true }
    const { bloqueos, propuestas } = diagnostico(e)
    expect(bloqueos[0].mensaje).toMatch(/materias cortas en días separados/)
    expect(propuestas.find((p) => p.descripcion === 'Desactivar la regla de materias cortas en días separados.')?.resuelve).toBe(true)
  })
})
