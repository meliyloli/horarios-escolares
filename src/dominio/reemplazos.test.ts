import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import {
  ajusteVacio, aplicarReorganizacion, candidatosReemplazo, clasesSinDocente, diaCicloDeFecha, guardarAjuste,
  impactoAjuste, normalizarAjuste, opcionesReorganizar, puedeFaltarGrupo, registroHorasCubiertas, sesionesDelDia,
} from './reemplazos'
import type { AjusteDia, Estado } from './tipos'

const MARTES = '2026-11-10'
const seis = [1, 2, 3, 4, 5, 6]

/** Martes: d dicta a 7-1 en las franjas 1, 3 y 5 y a 8-1 en la 2 y la 4. */
const colegio = (): Estado =>
  mini({
    grupos: [grp('a', 7), grp('b', 8), grp('c', 9), grp('p', 3)],
    docentes: [
      doc('d'), doc('x'), doc('y', { areaId: 'len' }), doc('z', { areaId: 'len', noDisponible: ['2-1'] }), doc('w', { areaId: 'len' }),
      doc('t', { nivel: 'primaria', rolPrimaria: 'titular', direccionGrupoId: 'p', cargaSemanal: 25 }),
    ],
    asignaciones: [
      asg('d', 'a', 'mat', 30), asg('d', 'b', 'mat', 30), asg('x', 'b', 'mat', 30), asg('y', 'c', 'len', 30),
      asg('w', 'c', 'len', 30), asg('z', 'a', 'len', 30), asg('t', 'p', 'len', 30),
    ],
    clases: [
      cls('d|a|mat', 2, 1, { id: 'da1' }), cls('d|b|mat', 2, 2, { id: 'db2' }), cls('d|a|mat', 2, 3, { id: 'da3' }),
      cls('d|b|mat', 2, 4, { id: 'db4' }), cls('d|a|mat', 2, 5, { id: 'da5' }),
      cls('x|b|mat', 2, 1, { id: 'xb1' }), cls('x|b|mat', 2, 3, { id: 'xb3' }),
      ...[1, 2, 3, 4, 5].map((f) => cls('y|c|len', 2, f)), // y solo tiene una franja libre el martes
      ...seis.flatMap((f) => [cls('w|c|len', 1, f), cls('w|c|len', 3, f)]), // w tiene lunes y miércoles llenos
      cls('z|a|len', 2, 2, { id: 'za2' }), cls('z|a|len', 2, 4, { id: 'za4' }), cls('z|a|len', 2, 6, { id: 'za6' }),
      ...seis.map((f) => cls('t|p|len', 2, f, { id: `tp${f}` })),
    ],
  })

const ausencia = (docenteId: string, franjas: number[], p: Partial<AjusteDia> = {}): AjusteDia => ({
  ...ajusteVacio(MARTES, 2), ausencias: [{ docenteId, franjas }], ...p,
})
const idsCandidatos = (e: Estado, aj: AjusteDia, claseId: string) => candidatosReemplazo(e, aj, claseId).map((c) => c.docenteId)

describe('día del ciclo', () => {
  it('en ciclo de 5 días sale del día de la semana', () => {
    expect(diaCicloDeFecha(colegio(), MARTES)).toBe(2)
    expect(diaCicloDeFecha(colegio(), '2026-11-14')).toBeUndefined() // sábado
  })
  it('en ciclo de 10 días continúa desde el último ajuste registrado', () => {
    const e = colegio()
    e.colegio.ciclo = 10
    expect(diaCicloDeFecha(e, MARTES)).toBe(2)
    e.ajustes = [ajusteVacio(MARTES, 7)]
    expect(diaCicloDeFecha(e, '2026-11-12')).toBe(9)
    expect(diaCicloDeFecha(e, '2026-11-17')).toBe(2)
  })
})

describe('reemplazos', () => {
  it('lista exactamente las clases que quedaron sin docente', () => {
    const sin = clasesSinDocente(colegio(), ausencia('d', [1, 3, 5]))
    expect(sin.map((s) => s.claseId).sort()).toEqual(['da1', 'da3', 'da5'])
    expect(sin.every((s) => s.situacion === 'sinDocente' && s.docenteOriginalId === 'd')).toBe(true)
  })
  it('propone solo docentes libres en esa franja, con 2 franjas libres ese día y 1 en un día vecino', () => {
    const [e, aj] = [colegio(), ausencia('d', [1, 3, 5])]
    expect(idsCandidatos(e, aj, 'da1')).toEqual([]) // x ocupado, z no disponible, y con 5 clases, w sin día vecino libre
    expect(idsCandidatos(e, aj, 'da3')).toEqual(['z'])
    expect(candidatosReemplazo(e, aj, 'da5')).toEqual([
      { docenteId: 'x', motivo: 'area', horasCubiertas: 0 },
      { docenteId: 'z', motivo: 'grupo', horasCubiertas: 0 },
    ])
  })
  it('entre docentes de la misma área prefiere al que menos horas ha cubierto', () => {
    const e = colegio()
    e.docentes.push(doc('v'))
    e.ajustes = [{ ...ajusteVacio('2026-11-03', 2), reemplazos: [{ claseId: 'da1', docenteId: 'v' }] }]
    expect(idsCandidatos(e, ausencia('d', [5]), 'da5')).toEqual(['x', 'v', 'z'])
  })
  it('las horas cubiertas no cuentan el mismo día que se está editando', () => {
    const e = colegio()
    const guardado = ausencia('d', [5], { reemplazos: [{ claseId: 'da5', docenteId: 'x' }] })
    e.ajustes = [guardado]
    expect(candidatosReemplazo(e, { ...guardado, reemplazos: [] }, 'da5')[0]).toEqual({ docenteId: 'x', motivo: 'area', horasCubiertas: 0 })
  })
  it('un docente ausente no se propone como reemplazo', () => {
    const aj: AjusteDia = { ...ausencia('d', [5]), ausencias: [{ docenteId: 'd', franjas: [5] }, { docenteId: 'x', franjas: seis }] }
    expect(idsCandidatos(colegio(), aj, 'da5')).toEqual(['z'])
  })
  it('el reemplazo confirmado aparece en el día y ocupa al docente', () => {
    const e = colegio()
    const aj = ausencia('d', [3, 5], { reemplazos: [{ claseId: 'da5', docenteId: 'x' }] })
    const s = sesionesDelDia(e, aj).find((x) => x.claseId === 'da5')!
    expect(s).toMatchObject({ docenteId: 'x', docenteOriginalId: 'd', situacion: 'reemplazo' })
    expect(clasesSinDocente(e, aj).map((x) => x.claseId)).toEqual(['da3'])
    // z ya cubre la franja 3: con sus clases de 2, 4 y 6 le quedan justo 2 franjas libres y aún puede cubrir la 5.
    const lleno = ausencia('d', [1, 3, 5], { reemplazos: [{ claseId: 'da3', docenteId: 'z' }, { claseId: 'da1', docenteId: 'w' }] })
    expect(idsCandidatos(e, lleno, 'da5')).toEqual(['x', 'z'])
    lleno.reemplazos.push({ claseId: 'da5', docenteId: 'z' })
    expect(sesionesDelDia(e, lleno).filter((x) => x.docenteId === 'z')).toHaveLength(5)
  })
  it('guardar el ajuste no cambia el horario base y lleva el registro de horas cubiertas', () => {
    const e = colegio()
    const r1 = guardarAjuste(e, ausencia('d', [5], { reemplazos: [{ claseId: 'da5', docenteId: 'x' }] }))
    expect(r1.clases).toBe(e.clases)
    const r2 = guardarAjuste(r1, { ...ajusteVacio('2026-11-17', 2), ausencias: [{ docenteId: 'd', franjas: [3, 5] }], reemplazos: [{ claseId: 'da5', docenteId: 'x' }, { claseId: 'da3', docenteId: 'z' }] })
    expect(r2.ajustes).toHaveLength(2)
    expect(registroHorasCubiertas(r2)).toEqual([{ docenteId: 'x', horas: 2 }, { docenteId: 'z', horas: 1 }])
    const r3 = guardarAjuste(r2, ausencia('d', [5]))
    expect(r3.ajustes).toHaveLength(2)
    expect(registroHorasCubiertas(r3)).toEqual([{ docenteId: 'x', horas: 1 }, { docenteId: 'z', horas: 1 }])
    expect(guardarAjuste(r3, ajusteVacio(MARTES, 2)).ajustes).toHaveLength(1)
  })
})

/** Martes de 7-1: z, y, d, d, z, y. z además dicta a 8-1 en la franja 3. */
const paraReorganizar = (): Estado =>
  mini({
    grupos: [grp('a', 7), grp('b', 8)],
    docentes: [doc('d'), doc('y', { areaId: 'len' }), doc('z', { areaId: 'len' })],
    asignaciones: [asg('d', 'a', 'mat', 30), asg('y', 'a', 'len', 30), asg('z', 'a', 'ing', 30), asg('z', 'b', 'len', 30)],
    clases: [
      cls('z|a|ing', 2, 1, { id: 'z1' }), cls('y|a|len', 2, 2, { id: 'y2' }), cls('d|a|mat', 2, 3, { id: 'd3' }),
      cls('d|a|mat', 2, 4, { id: 'd4' }), cls('z|a|ing', 2, 5, { id: 'z5' }), cls('y|a|len', 2, 6, { id: 'y6' }),
      cls('z|b|len', 2, 3, { id: 'zb3' }),
    ],
  })

describe('reorganizar el día', () => {
  const franjas = (e: Estado, aj: AjusteDia, grupoId: string) =>
    Object.fromEntries(sesionesDelDia(e, aj).filter((s) => s.grupoId === grupoId).map((s) => [s.claseId, s.franja]))

  it('mueve clases de docentes que sí asisten para que el grupo llegue tarde, sin cruces', () => {
    const [e, aj] = [paraReorganizar(), ausencia('d', [3, 4])]
    const opcion = opcionesReorganizar(e, aj, 'a').find((o) => o.tipo === 'llegaTarde')!
    expect(opcion.horasSinClase).toBe(2)
    expect(opcion.docentesQueCambian.sort()).toEqual(['y', 'z'])
    const despues = aplicarReorganizacion(e, aj, opcion)
    // z no puede a la franja 3 (dicta a 8-1), así que pasa a la 4 e y a la 3.
    expect(franjas(e, despues, 'a')).toEqual({ d3: 1, d4: 2, y2: 3, z1: 4, z5: 5, y6: 6 })
    expect(clasesSinDocente(e, despues).map((s) => s.franja).sort()).toEqual([1, 2])
    const ocupadas = sesionesDelDia(e, despues).filter((s) => s.docenteId === 'z').map((s) => s.franja)
    expect(new Set(ocupadas).size).toBe(ocupadas.length)
  })
  it('también ofrece que el grupo salga temprano', () => {
    const [e, aj] = [paraReorganizar(), ausencia('d', [3, 4])]
    const opcion = opcionesReorganizar(e, aj, 'a').find((o) => o.tipo === 'saleTemprano')!
    expect(franjas(e, aplicarReorganizacion(e, aj, opcion), 'a')).toEqual({ z1: 1, y2: 2, y6: 3, z5: 4, d3: 5, d4: 6 })
  })
  it('si las horas sin docente ya están al final, sale temprano sin mover nada', () => {
    const e = paraReorganizar()
    const opcion = opcionesReorganizar(e, ausencia('y', [6]), 'a').find((o) => o.tipo === 'saleTemprano')!
    expect(opcion).toMatchObject({ movimientos: [], docentesQueCambian: [], horasSinClase: 1 })
  })
  it('no ofrece una reorganización que cruzaría a un docente o lo pondría donde no está disponible', () => {
    const e = paraReorganizar()
    e.docentes.find((d) => d.id === 'y')!.noDisponible = ['2-3', '2-4']
    e.clases.push(cls('z|b|len', 2, 4, { id: 'zb4' }))
    // Para llegar tarde, z e y tendrían que pasar a las franjas 3 y 4: ninguno puede.
    expect(opcionesReorganizar(e, ausencia('d', [3, 4]), 'a').map((o) => o.tipo)).toEqual([])
  })
  it('con el día reorganizado, los reemplazos se siguen evaluando en la franja del horario base', () => {
    const e = paraReorganizar()
    e.docentes.push(doc('q'))
    e.grupos.push(grp('c', 9))
    e.asignaciones.push(asg('q', 'c', 'mat', 30))
    e.clases.push(cls('q|c|mat', 2, 3, { id: 'qc3' }))
    const aj = ausencia('d', [3, 4])
    expect(idsCandidatos(e, aj, 'd3')).toEqual(['y'])
    const tarde = aplicarReorganizacion(e, aj, opcionesReorganizar(e, aj, 'a').find((o) => o.tipo === 'llegaTarde')!)
    expect(idsCandidatos(e, tarde, 'd3')).toEqual(['y']) // q dicta a 9-1 en la franja 3: no puede, aunque la clase se vea en la franja 1
  })
  it('al cambiar las ausencias se quitan los reemplazos y reorganizaciones que ya no valen', () => {
    const e = paraReorganizar()
    e.docentes.push(doc('v'))
    const completo = { ...ausencia('d', [3, 4]), reemplazos: [{ claseId: 'd3', docenteId: 'v' }, { claseId: 'd4', docenteId: 'v' }] }
    expect(normalizarAjuste(e, completo)).toEqual(completo)
    // La ausencia se acorta a la franja 3: el reemplazo de la franja 4 ya no corresponde.
    expect(normalizarAjuste(e, { ...completo, ausencias: [{ docenteId: 'd', franjas: [3] }] }).reemplazos).toEqual([{ claseId: 'd3', docenteId: 'v' }])
    // El reemplazo también falta ese día.
    const ambos = { ...completo, ausencias: [...completo.ausencias, { docenteId: 'v', franjas: [3, 4, 5, 6] }] }
    expect(normalizarAjuste(e, ambos).reemplazos).toEqual([])
    // Un docente o un grupo que ya no existen.
    const viejo = { ...completo, ausencias: [...completo.ausencias, { docenteId: 'borrado', franjas: [1] }], gruposAusentes: ['borrado'], reemplazos: [{ claseId: 'd3', docenteId: 'borrado' }] }
    expect(normalizarAjuste(e, viejo)).toMatchObject({ ausencias: [{ docenteId: 'd', franjas: [3, 4] }], gruposAusentes: [], reemplazos: [] })
    // Una reorganización deja de valer si cambia lo que estaba descubierto.
    const aj = ausencia('d', [3, 4])
    const tarde = aplicarReorganizacion(e, aj, opcionesReorganizar(e, aj, 'a').find((o) => o.tipo === 'llegaTarde')!)
    expect(normalizarAjuste(e, tarde).movimientos).toEqual(tarde.movimientos)
    expect(normalizarAjuste(e, { ...tarde, ausencias: [{ docenteId: 'd', franjas: [3] }] }).movimientos).toEqual([])
  })
  it('si falta todo el grupo, sus reemplazos no cuentan como horas cubiertas', () => {
    const e = colegio()
    const aj = { ...ausencia('t', seis), reemplazos: [{ claseId: 'tp6', docenteId: 'x' }], gruposAusentes: ['p'] }
    expect(normalizarAjuste(e, aj).reemplazos).toEqual([])
  })
  it('un grupo sin clases descubiertas no tiene nada que reorganizar', () => {
    expect(opcionesReorganizar(paraReorganizar(), ausencia('d', [3, 4]), 'b')).toEqual([])
  })
  it('resume el impacto del ajuste', () => {
    const [e, aj] = [paraReorganizar(), ausencia('d', [3, 4])]
    expect(impactoAjuste(e, aj)).toMatchObject({ horasCubiertas: 0, horasSinCubrir: 2, gruposLleganTarde: [], gruposSalenTemprano: [] })
    const opcion = opcionesReorganizar(e, aj, 'a').find((o) => o.tipo === 'llegaTarde')!
    expect(impactoAjuste(e, aplicarReorganizacion(e, aj, opcion))).toEqual({
      horasCubiertas: 0, horasSinCubrir: 2, gruposLleganTarde: ['a'], gruposSalenTemprano: [], gruposAusentes: [], docentesQueCambian: ['y', 'z'],
    })
  })
})

describe('primaria: falta todo el grupo', () => {
  it('solo se puede marcar en primaria', () => {
    expect(puedeFaltarGrupo(colegio(), 'p')).toBe(true)
    expect(puedeFaltarGrupo(colegio(), 'a')).toBe(false)
  })
  it('si falta el titular todo el día se ofrecen reemplazos o marcar que falta el grupo', () => {
    const e = colegio()
    const aj = ausencia('t', seis)
    expect(clasesSinDocente(e, aj)).toHaveLength(6)
    expect(idsCandidatos(e, aj, 'tp6')).toContain('x')
    const sinGrupo = { ...aj, gruposAusentes: ['p'] }
    expect(clasesSinDocente(e, sinGrupo)).toEqual([])
    expect(sesionesDelDia(e, sinGrupo).filter((s) => s.grupoId === 'p').every((s) => s.situacion === 'grupoAusente')).toBe(true)
    expect(impactoAjuste(e, sinGrupo)).toMatchObject({ gruposAusentes: ['p'], horasSinCubrir: 0 })
  })
})

describe('reemplazos con docentes de mañana y tarde', () => {
  it('quien tiene clase en la franja 1 de la mañana puede reemplazar en la franja 1 de la tarde', () => {
    const e = mini({
      grupos: [grp('m', 7), grp('t', 8, { jornada: 'tarde' })],
      docentes: [doc('ana', { jornada: 'ambas' }), doc('luis', { jornada: 'tarde' })],
      asignaciones: [asg('ana', 'm', 'mat', 30), asg('luis', 't', 'mat', 30)],
      clases: [cls('ana|m|mat', 2, 1, { id: 'am1' }), cls('luis|t|mat', 2, 1, { id: 'lt1' })],
    })
    expect(idsCandidatos(e, ausencia('luis', [1]), 'lt1')).toContain('ana')
    // Si no está disponible esa franja de la tarde, no.
    e.docentes[0].noDisponible = ['2-1-t']
    expect(idsCandidatos(e, ausencia('luis', [1]), 'lt1')).not.toContain('ana')
  })
})
