import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { resolverDia, resumenDia } from './novedades'
import { ajusteVacio, impactoAjuste, sesionesDelDia } from './reemplazos'
import type { AjusteDia, DecisionAusencia, Estado } from './tipos'

const seis = [1, 2, 3, 4, 5, 6]
/** Martes: Dora (mat) dicta a 7-1 en las franjas 1, 3 y 5 y a 8-1 en la 2 y la 4. Zoe completa 7-1 y no viene en la franja 1. */
const colegio = (): Estado =>
  mini({
    grupos: [grp('a', 7), grp('b', 8), grp('c', 9)],
    docentes: [
      doc('d', { nombre: 'Dora' }), doc('x', { nombre: 'Ximena' }), doc('y', { nombre: 'Yolanda', areaId: 'len' }),
      doc('z', { nombre: 'Zoe', areaId: 'len', noDisponible: ['2-1'] }), doc('w', { nombre: 'Walter', areaId: 'len' }),
    ],
    asignaciones: [asg('d', 'a', 'mat', 30), asg('d', 'b', 'mat', 30), asg('x', 'b', 'mat', 30), asg('y', 'c', 'len', 30), asg('w', 'c', 'len', 30), asg('z', 'a', 'len', 30)],
    clases: [
      cls('d|a|mat', 2, 1, { id: 'da1' }), cls('d|b|mat', 2, 2, { id: 'db2' }), cls('d|a|mat', 2, 3, { id: 'da3' }),
      cls('d|b|mat', 2, 4, { id: 'db4' }), cls('d|a|mat', 2, 5, { id: 'da5' }),
      cls('x|b|mat', 2, 1, { id: 'xb1' }), cls('x|b|mat', 2, 3, { id: 'xb3' }),
      ...[1, 2, 3, 4, 5].map((f) => cls('y|c|len', 2, f)),
      ...seis.flatMap((f) => [cls('w|c|len', 1, f), cls('w|c|len', 3, f)]),
      cls('z|a|len', 2, 2, { id: 'za2' }), cls('z|a|len', 2, 4, { id: 'za4' }), cls('z|a|len', 2, 6, { id: 'za6' }),
    ],
  })

const dia = (decision: Omit<DecisionAusencia, 'docenteId'>): AjusteDia => ({
  ...ajusteVacio('2026-11-17', 2), ausencias: [{ docenteId: 'd', franjas: seis }], decisiones: [{ docenteId: 'd', ...decision }],
})
const quien = (aj: AjusteDia) => Object.fromEntries(aj.reemplazos.map((r) => [r.claseId, r.docenteId]))

describe('decidir cómo se cubre a quien falta', () => {
  it('«el que más convenga» pone en cada clase al mejor candidato libre, sin cruzarlo', () => {
    const r = resolverDia(colegio(), dia({ modo: 'conviene' }))
    expect(quien(r)).toMatchObject({ da3: 'z', da5: 'x' })
    expect(r.reemplazos.find((x) => x.claseId === 'da1')).toBeUndefined() // nadie puede en la franja 1
  })

  it('«ya tengo a alguien» le da todas las clases en que está libre; las demás quedan pendientes', () => {
    const r = resolverDia(colegio(), dia({ modo: 'elegido', elegidoId: 'x' }))
    expect(quien(r)).toEqual({ db2: 'x', db4: 'x', da5: 'x' })
  })

  it('sin reemplazo: si se prefiere salir temprano pero no se puede, el grupo llega tarde', () => {
    const e = colegio()
    const r = resolverDia(e, dia({ modo: 'reorganizar', preferencia: 'saleTemprano' }))
    expect(r.reemplazos).toEqual([])
    const impacto = impactoAjuste(e, r)
    expect(impacto.gruposLleganTarde).toContain('a')
    expect(sesionesDelDia(e, r).find((s) => s.claseId === 'za2')?.franja).toBe(5)
  })

  it('las horas que nadie puede cubrir siguen la preferencia (aquí, llegar tarde)', () => {
    const e = colegio()
    const r = resolverDia(e, dia({ modo: 'conviene', preferencia: 'llegaTarde' }))
    expect(impactoAjuste(e, r).horasSinCubrir).toBeGreaterThan(0)
    // 7-1 solo queda sin docente en la franja 1: ya llega tarde sin mover nada.
    expect(impactoAjuste(e, r).gruposLleganTarde).toContain('a')
  })
})

describe('resumen para enviar', () => {
  it('a familias: solo qué grupos entran tarde o salen temprano, sin nombres de docentes', () => {
    const e = colegio()
    const { familias } = resumenDia(e, resolverDia(e, dia({ modo: 'reorganizar', preferencia: 'llegaTarde' })))
    expect(familias).toContain('jornada del martes 17 de noviembre')
    expect(familias).toContain('Grupo 7-1: ingresa a la 4.ª hora')
    expect(familias).not.toContain('Dora')
  })

  it('a docentes: quién falta, quién reemplaza y qué clases se movieron de franja', () => {
    const e = colegio()
    const conReemplazo = resumenDia(e, resolverDia(e, dia({ modo: 'conviene' }))).docentes
    expect(conReemplazo).toContain('Falta Dora (todo el día)')
    expect(conReemplazo).toContain('7-1, 5.ª hora, Matemáticas: la cubre Ximena')
    const movido = resumenDia(e, resolverDia(e, dia({ modo: 'reorganizar', preferencia: 'llegaTarde' }))).docentes
    expect(movido).toContain('Zoe: Lengua Castellana con 7-1 pasa de la 2.ª a la 5.ª hora')
  })
})
