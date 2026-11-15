import { describe, expect, it } from 'vitest'
import { repartirAulas } from './aulas'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { aulaDeClase, avisosAulas, detectarCruces } from './cruces'
import { prechequear } from './diagnostico'
import { generarHorario } from './generador'
import type { Estado } from './tipos'

/** Modelo "libre": Fabio tiene el aula A fija; Rita y Raúl rotan. Hay además un aula B sin dueño. */
const colegio = (p: Partial<Estado> = {}): Estado => {
  const e = mini({
    grupos: [grp('g1', 7, { aulaId: undefined }), grp('g2', 8, { aulaId: undefined }), grp('g3', 9, { aulaId: undefined })],
    docentes: [doc('f', { nombre: 'Fabio', aulaId: 'A', cargaSemanal: 1 }), doc('r', { nombre: 'Rita', cargaSemanal: 2 }), doc('q', { nombre: 'Raúl', cargaSemanal: 1 })],
    aulas: [{ id: 'A', nombre: 'Aula A' }, { id: 'B', nombre: 'Aula B' }],
    asignaciones: [asg('f', 'g1', 'mat', 1), asg('r', 'g2', 'mat', 2), asg('q', 'g3', 'mat', 1)],
    ...p,
  })
  e.colegio.modeloAula = 'libre'
  return e
}
const aulaDe = (e: Estado, id: string) => aulaDeClase(e, e.clases.find((c) => c.id === id)!)

describe('aulas libres para docentes sin aula fija', () => {
  it('el docente con aula fija dicta en la suya y el que rota no tiene aula hasta repartirlas', () => {
    const e = colegio({ clases: [cls('f|g1|mat', 1, 1, { id: 'cf' }), cls('r|g2|mat', 1, 1, { id: 'cr' })] })
    expect(aulaDe(e, 'cf')).toBe('A')
    expect(aulaDe(e, 'cr')).toBeUndefined()
  })
  it('reparte al que rota un aula libre a esa hora, incluida la de un docente fijo que no tiene clase', () => {
    const e = repartirAulas(colegio({
      clases: [
        cls('f|g1|mat', 1, 1, { id: 'cf' }), cls('r|g2|mat', 1, 1, { id: 'cr1' }),
        cls('r|g2|mat', 1, 2, { id: 'cr2' }), cls('q|g3|mat', 1, 2, { id: 'cq' }),
      ],
    }))
    expect(aulaDe(e, 'cr1')).toBe('B') // la A la usa Fabio a esa hora
    expect(aulaDe(e, 'cr2')).toBe('B') // el grupo se queda en la misma aula
    expect(aulaDe(e, 'cq')).toBe('A') // Fabio no tiene clase en la franja 2: su aula está libre
    expect(detectarCruces(e)).toEqual([])
  })
  it('si no queda aula libre la clase queda sin aula y se avisa', () => {
    const e = repartirAulas(colegio({
      clases: [cls('f|g1|mat', 1, 1), cls('r|g2|mat', 1, 1), cls('r|g2|mat', 1, 2), cls('q|g3|mat', 1, 1, { id: 'cq' })],
    }))
    expect(aulaDe(e, 'cq')).toBeUndefined()
    expect(detectarCruces(e).map((c) => c.tipo)).toEqual(['sinAula'])
  })
  it('no cambia el aula que ya tiene una clase si sigue libre, ni las de otros modelos', () => {
    const e = colegio({ clases: [cls('r|g2|mat', 1, 1, { id: 'cr', aulaId: 'A' }), cls('r|g2|mat', 1, 2)] })
    expect(aulaDe(repartirAulas(e), 'cr')).toBe('A')
    const otro = { ...e, colegio: { ...e.colegio, modeloAula: 'grupo' as const } }
    expect(repartirAulas(otro)).toBe(otro)
  })
  it('el generador nunca pone más clases a la vez que aulas hay, y deja cada clase con su aula', () => {
    const e = colegio({
      docentes: [doc('f', { aulaId: 'A', cargaSemanal: 10 }), doc('r', { cargaSemanal: 20 }), doc('q', { cargaSemanal: 10 })],
      asignaciones: [asg('f', 'g1', 'mat', 10), asg('r', 'g2', 'mat', 10), asg('r', 'g1', 'len', 10), asg('q', 'g3', 'mat', 10)],
    })
    const r = generarHorario(e, { semilla: 5 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    expect(r.clases.every((c) => aulaDeClase({ ...e, clases: r.clases }, c))).toBe(true)
  })
  it('si las clases no caben en las aulas lo dice antes de buscar', () => {
    const e = colegio({
      docentes: [doc('f', { aulaId: 'A', cargaSemanal: 22 }), doc('r', { cargaSemanal: 22 }), doc('q', { cargaSemanal: 22 })],
      asignaciones: [asg('f', 'g1', 'mat', 22), asg('r', 'g2', 'mat', 22), asg('q', 'g3', 'mat', 22)],
    })
    e.colegio.reglas.maxMateriaDia.activa = e.colegio.reglas.maxDocenteDia.activa = false
    expect(prechequear(e).map((b) => b.mensaje).join(' ')).toMatch(/66 clases.*2 aulas.*solo caben 60/)
  })
  it('avisa si no hay aulas o ningún docente tiene aula fija', () => {
    const e = colegio({ docentes: [doc('r')], aulas: [] })
    expect(avisosAulas(e).join(' ')).toMatch(/No hay aulas/)
  })
})

describe('sin aulas', () => {
  it('con el modelo «sin aulas» ninguna clase lleva aula, no hay avisos de aula y el generador funciona', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { aulaId: 'compartida' })],
      docentes: [doc('d', { cargaSemanal: 10, aulaId: 'otra' }), doc('x', { cargaSemanal: 10 })],
      asignaciones: [asg('d', 'a', 'mat', 10), asg('x', 'b', 'mat', 10)],
      aulas: [],
    })
    e.colegio.modeloAula = 'ninguna'
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    const conHorario = { ...e, clases: r.clases }
    expect(r.clases.every((c) => aulaDeClase(conHorario, c) === undefined)).toBe(true)
    expect(detectarCruces(conHorario)).toEqual([])
    expect(avisosAulas(conHorario)).toEqual([])
  })
})
