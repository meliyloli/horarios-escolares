import { describe, expect, it } from 'vitest'
import { avisosAcompanamiento, cargaAcompanamiento, repartirAcompanamiento, turnosSinCubrir } from './acompanamiento'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { eliminarDocente } from './edicion'
import type { Estado, Zona } from './tipos'

const seis = [1, 2, 3, 4, 5, 6]
/** Cuatro docentes con clase todos los días; «Ana» tiene el doble de horas que los demás. */
const colegio = (zonas: Zona[]): Estado => {
  const e = mini({
    grupos: [grp('a', 6), grp('b', 7), grp('c', 8), grp('d', 9)],
    docentes: [doc('ana', { nombre: 'Ana' }), doc('beto', { nombre: 'Beto' }), doc('caro', { nombre: 'Caro' }), doc('dani', { nombre: 'Dani' })],
    asignaciones: [asg('ana', 'a', 'mat', 20), asg('beto', 'b', 'mat', 10), asg('caro', 'c', 'mat', 10), asg('dani', 'd', 'mat', 10)],
    clases: [
      ...[1, 2, 3, 4, 5].flatMap((d) => seis.slice(0, 4).map((f) => cls('ana|a|mat', d, f))),
      ...[1, 2, 3, 4, 5].flatMap((d) => [1, 5].map((f) => cls('beto|b|mat', d, f))),
      ...[1, 2, 3, 4, 5].flatMap((d) => [3, 6].map((f) => cls('caro|c|mat', d, f))),
      ...[1, 2, 3, 4, 5].flatMap((d) => [2, 4].map((f) => cls('dani|d|mat', d, f))),
    ],
  })
  e.acompanamiento = { zonas, turnos: [] }
  return e
}
const zona = (id: string, p: Partial<Zona> = {}): Zona => ({ id, nombre: id, personas: 1, descansos: [1, 2], jornada: 'manana', ...p })
const turnosDe = (e: Estado, docente: string) => (e.acompanamiento?.turnos ?? []).filter((t) => t.docenteIds.includes(docente)).length

describe('acompañamiento en descansos', () => {
  it('cubre cada zona en cada descanso del ciclo, sin que nadie esté en dos zonas a la vez', () => {
    const e = repartirAcompanamiento(colegio([zona('patio'), zona('cancha')]))
    const turnos = e.acompanamiento!.turnos
    expect(turnos).toHaveLength(2 * 2 * 5)
    expect(turnos.every((t) => t.docenteIds.length === 1)).toBe(true)
    for (const d of [1, 2, 3, 4, 5]) for (const k of [1, 2]) {
      const ese = turnos.filter((t) => t.dia === d && t.descanso === k).flatMap((t) => t.docenteIds)
      expect(new Set(ese).size).toBe(ese.length)
    }
    expect(avisosAcompanamiento(e)).toEqual([])
  })
  it('reparte en proporción al espacio libre: quien tiene más horas de clase cuida menos', () => {
    const e = repartirAcompanamiento(colegio([zona('patio'), zona('cancha')]))
    expect(turnosDe(e, 'ana')).toBeLessThan(turnosDe(e, 'beto'))
    const carga = cargaAcompanamiento(e)
    const otros = carga.filter((c) => c.docenteId !== 'ana').map((c) => c.turnos)
    expect(Math.max(...otros) - Math.min(...otros)).toBeLessThanOrEqual(1)
  })
  it('en una zona álgida nadie repite el día anterior ni el siguiente', () => {
    const e = repartirAcompanamiento(colegio([zona('baños', { algida: true, descansos: [1] })]))
    const quien = new Map(e.acompanamiento!.turnos.map((t) => [t.dia, t.docenteIds[0]]))
    for (const d of [1, 2, 3, 4]) expect(quien.get(d)).not.toBe(quien.get(d + 1))
  })
  it('una zona por parejas solo la cubren esos dos: se turnan, o van juntos si la zona pide dos', () => {
    const turnante = repartirAcompanamiento(colegio([zona('tienda', { pareja: ['beto', 'caro'] })]))
    expect(turnante.acompanamiento!.turnos.flatMap((t) => t.docenteIds).every((d) => d === 'beto' || d === 'caro')).toBe(true)
    // Se dividen los días completos: en una semana de 5 días, 3 días para uno y 2 para el otro (2 descansos por día).
    expect([turnosDe(turnante, 'beto'), turnosDe(turnante, 'caro')].sort()).toEqual([4, 6])
    const juntos = repartirAcompanamiento(colegio([zona('tienda', { pareja: ['beto', 'caro'], personas: 2 })]))
    expect(juntos.acompanamiento!.turnos.every((t) => [...t.docenteIds].sort().join() === 'beto,caro')).toBe(true)
  })
  it('solo asigna a quien ese día está en el colegio', () => {
    const e = colegio([zona('patio', { descansos: [1] })])
    e.clases = e.clases.filter((c) => !(c.asignacionId.startsWith('dani') && c.dia === 3)) // Dani no viene el miércoles
    const r = repartirAcompanamiento(e)
    expect(r.acompanamiento!.turnos.find((t) => t.dia === 3)!.docenteIds).not.toContain('dani')
  })
  it('avisa lo que no cuadra después de cambiar un turno a mano', () => {
    const e = repartirAcompanamiento(colegio([zona('patio'), zona('cancha', { algida: true })]))
    const turnos = e.acompanamiento!.turnos
    const lunes1 = turnos.filter((t) => t.dia === 1 && t.descanso === 1)
    // El mismo docente en las dos zonas el lunes en el primer descanso.
    lunes1[1].docenteIds = [...lunes1[0].docenteIds]
    expect(avisosAcompanamiento(e).some((a) => /dos zonas a la vez/.test(a))).toBe(true)
  })
})

describe('acompañamiento al borrar', () => {
  it('borrar un docente lo quita de sus turnos y de su pareja fija', () => {
    const e = repartirAcompanamiento(colegio([zona('tienda', { pareja: ['beto', 'caro'] }), zona('patio')]))
    const r = eliminarDocente(e, 'beto')
    expect(r.acompanamiento!.turnos.flatMap((t) => t.docenteIds)).not.toContain('beto')
    expect(r.acompanamiento!.zonas[0].pareja).toBeUndefined()
  })
})

describe('pareja fija en una zona álgida', () => {
  it('la pareja se divide los días: cada uno cubre su día completo y nadie repite días seguidos', () => {
    const e = repartirAcompanamiento(colegio([zona('tienda', { pareja: ['beto', 'caro'], algida: true })]))
    const porDia = new Map<number, Set<string>>()
    for (const t of e.acompanamiento!.turnos) porDia.set(t.dia, new Set([...(porDia.get(t.dia) ?? []), ...t.docenteIds]))
    for (const [, quienes] of porDia) expect(quienes.size).toBe(1)
    for (const d of [1, 2, 3, 4]) expect([...porDia.get(d)!][0]).not.toBe([...porDia.get(d + 1)!][0])
    expect(avisosAcompanamiento(e)).toEqual([])
  })
})

describe('acompañamiento cuando alguien falta', () => {
  it('lista los turnos que deja el ausente ese día y sugiere quién puede cubrirlos', () => {
    const e = repartirAcompanamiento(colegio([zona('patio', { descansos: [1] })]))
    const lunes = e.acompanamiento!.turnos.find((t) => t.dia === 1)!
    const ausente = lunes.docenteIds[0]
    const r = turnosSinCubrir(e, { fecha: '2026-11-16', diaCiclo: 1, ausencias: [{ docenteId: ausente, franjas: [1, 2, 3, 4, 5, 6] }], reemplazos: [], movimientos: [], gruposAusentes: [] })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ zonaId: 'patio', descanso: 1, ausente })
    expect(r[0].sugerido).toBeDefined()
    expect(r[0].sugerido).not.toBe(ausente)
  })
})
