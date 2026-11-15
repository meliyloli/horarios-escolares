import { describe, expect, it } from 'vitest'
import { asg, cargaDispareja, cls, doc, grp, mini } from './ayudaPruebas'
import { detectarCruces } from './cruces'
import { colegioEjemplo, estadoVacio } from './ejemplo'
import type { Estado } from './tipos'
import { completarHorario, emparejarHorario, generarHorario, organizarMediaTecnica, reacomodarHorario } from './generador'

const posiciones = (clases: { asignacionId: string; dia: number; franja: number }[]) =>
  clases.map((c) => `${c.asignacionId}@${c.dia}-${c.franja}`).sort()

describe('generador', () => {
  it('resuelve el colegio de ejemplo completo y sin cruces', { timeout: 30000 }, () => {
    const e = colegioEjemplo()
    const r = generarHorario(e, { semilla: 1 })
    expect(r.sinUbicar).toEqual([])
    expect(r.completo).toBe(true)
    expect(r.clases).toHaveLength(e.asignaciones.reduce((s, a) => s + a.horas, 0))
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
  it('no pone clase en las franjas donde el docente no está disponible', { timeout: 30000 }, () => {
    const e = colegioEjemplo()
    const oscar = e.docentes.find((d) => d.noDisponible.length > 0)!
    const suyas = new Set(e.asignaciones.filter((a) => a.docenteId === oscar.id).map((a) => a.id))
    const r = generarHorario(e, { semilla: 2 })
    const enBloqueadas = r.clases.filter((c) => suyas.has(c.asignacionId) && oscar.noDisponible.includes(`${c.dia}-${c.franja}`))
    expect(enBloqueadas).toEqual([])
  })
  it('un docente que entra desde la 3.ª franja no recibe clase en las franjas 1 y 2', () => {
    const tarde = [1, 2, 3, 4, 5].flatMap((d) => [`${d}-1`, `${d}-2`])
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)],
      docentes: [doc('d', { cargaSemanal: 20, noDisponible: tarde }), doc('x', { cargaSemanal: 10 })],
      asignaciones: [asg('d', 'a', 'mat', 10), asg('d', 'b', 'mat', 10), asg('x', 'a', 'len', 10)],
    })
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases.filter((c) => c.asignacionId.startsWith('d|') && c.franja <= 2)).toEqual([])
  })
  it('conserva las clases fijadas en su lugar', () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 5 })],
      asignaciones: [asg('d', 'a', 'mat', 5)],
      clases: [cls('d|a|mat', 5, 6, { id: 'fija', fijada: true }), cls('d|a|mat', 1, 1, { id: 'suelta' })],
    })
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases).toHaveLength(5)
    expect(r.clases.find((c) => c.id === 'fija')).toMatchObject({ dia: 5, franja: 6, fijada: true })
    expect(new Set(r.clases.map((c) => c.id)).size).toBe(5)
  })
  it('con la misma semilla da el mismo horario', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d'), doc('x')],
      asignaciones: [asg('d', 'a', 'mat', 10), asg('d', 'b', 'mat', 10), asg('x', 'a', 'len', 10), asg('x', 'b', 'len', 10)],
    })
    expect(posiciones(generarHorario(e, { semilla: 7 }).clases)).toEqual(posiciones(generarHorario(e, { semilla: 7 }).clases))
  })
  it('un grupo de ciclo 5 junto a uno de ciclo 10 queda sin cruces en los 10 días', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { ciclo: 10 })],
      docentes: [doc('d', { cargaSemanal: 15 }), doc('x', { cargaSemanal: 15 })],
      asignaciones: [asg('d', 'a', 'mat', 5), asg('d', 'b', 'mat', 20), asg('x', 'a', 'len', 10), asg('x', 'b', 'len', 10)],
    })
    const r = generarHorario(e, { semilla: 3 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
  it('respeta la regla de hora libre', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8), grp('c', 9)],
      docentes: [doc('d', { cargaSemanal: 26 })],
      asignaciones: [asg('d', 'a', 'mat', 10), asg('d', 'b', 'mat', 10), asg('d', 'c', 'mat', 6)],
    })
    const r = generarHorario(e, { semilla: 4 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
  it('sin docentes ni asignaciones termina de inmediato', () => {
    const inicio = Date.now()
    expect(generarHorario(estadoVacio())).toEqual({ clases: [], sinUbicar: [], completo: true })
    expect(Date.now() - inicio).toBeLessThan(100)
  })
  it('un grupo sin aula y una asignación en cero no lo cuelgan', () => {
    const e = mini({
      grupos: [grp('a', 7, { aulaId: undefined })], docentes: [doc('d', { cargaSemanal: 3 })],
      asignaciones: [asg('d', 'a', 'mat', 3), asg('d', 'a', 'tec', 0)],
    })
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases).toHaveLength(3)
  })
  it('una asignación imposible termina a tiempo y dice qué no pudo ubicar y por qué', () => {
    const libres = [1, 2].flatMap((d) => [1, 2, 3, 4, 5].map((f) => `${d}-${f}`))
    const bloqueadas = [1, 2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`)).filter((k) => !libres.includes(k))
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8), grp('c', 9)],
      docentes: [doc('d', { noDisponible: bloqueadas })],
      asignaciones: [asg('d', 'a', 'mat', 8), asg('d', 'b', 'mat', 8), asg('d', 'c', 'mat', 6)],
    })
    const inicio = Date.now()
    const r = generarHorario(e, { semilla: 1, tiempoMs: 300 })
    expect(Date.now() - inicio).toBeLessThan(1500)
    expect(r.completo).toBe(false)
    expect(r.sinUbicar.reduce((s, x) => s + x.horas, 0)).toBeGreaterThanOrEqual(12)
    expect(r.sinUbicar[0].causas.disponibilidad).toBeGreaterThan(0)
    expect(e.colegio.reglas.maxMateriaDia.valor).toBe(2)
  })
})

/** Cuántos bloques (franjas 1-2, 3-4 o 5-6 del mismo día) tiene una asignación. */
const bloquesDe = (clases: { asignacionId: string; dia: number; franja: number }[], asignacionId: string) => {
  const suyas = clases.filter((c) => c.asignacionId === asignacionId)
  return suyas.filter((c) => c.franja % 2 === 1 && suyas.some((o) => o.dia === c.dia && o.franja === c.franja + 1)).length
}

describe('clases en bloque de 2 horas', () => {
  const conBloques = (e: ReturnType<typeof mini>, primaria = false) => {
    e.colegio.reglas.bloques = { activa: true, primaria }
    return e
  }
  it('pone dos horas seguidas de la misma materia todas las veces que se puede', () => {
    const e = conBloques(mini({
      grupos: [grp('a', 7)],
      docentes: [doc('d', { cargaSemanal: 5 }), doc('x', { areaId: 'len', cargaSemanal: 4 }), doc('y', { areaId: 'ing', cargaSemanal: 3 })],
      asignaciones: [asg('d', 'a', 'mat', 5), asg('x', 'a', 'len', 4), asg('y', 'a', 'ing', 3)],
    }))
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases).toHaveLength(12)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    expect([bloquesDe(r.clases, 'd|a|mat'), bloquesDe(r.clases, 'x|a|len'), bloquesDe(r.clases, 'y|a|ing')]).toEqual([2, 2, 1])
  })
  it('si un bloque no cabe deja esas horas sueltas en vez de fallar', () => {
    const impares = [1, 2, 3, 4, 5].flatMap((d) => [2, 4, 6].map((f) => `${d}-${f}`))
    const e = conBloques(mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 5, noDisponible: impares })], asignaciones: [asg('d', 'a', 'mat', 5)],
    }))
    const r = generarHorario(e, { semilla: 1, tiempoMs: 1500 })
    expect(r.completo).toBe(true)
    expect(bloquesDe(r.clases, 'd|a|mat')).toBe(0)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
  it('en primaria solo se arman bloques si el colegio lo pide', () => {
    const base = () => mini({
      grupos: [grp('p', 3)], docentes: [doc('t', { nivel: 'primaria', rolPrimaria: 'titular', cargaSemanal: 4 })], asignaciones: [asg('t', 'p', 'mat', 4)],
    })
    expect(bloquesDe(generarHorario(conBloques(base(), true), { semilla: 2 }).clases, 't|p|mat')).toBe(2)
    const sin = generarHorario(conBloques(base(), false), { semilla: 2 })
    expect(sin.completo).toBe(true)
  })
  it('el colegio de ejemplo sale completo y sin cruces también con bloques', { timeout: 30000 }, () => {
    const e = conBloques(colegioEjemplo())
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    // Matemáticas en bachillerato tiene 5 horas: dos bloques y una hora suelta. (En primaria no se pidieron bloques.)
    const mat = e.asignaciones.filter((a) => a.areaId === 'mat' && e.grupos.find((g) => g.id === a.grupoId)!.grado >= 6)
    expect(mat.map((a) => bloquesDe(r.clases, a.id))).toEqual(mat.map(() => 2))
  })
})

describe('el generador nunca rompe una regla', () => {
  it('en 60 colegios al azar, con o sin solución completa, lo ubicado no tiene cruces', { timeout: 60000 }, () => {
    let semilla = 7
    const azar = (n: number) => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) % n
    for (let caso = 0; caso < 60; caso++) {
      const nGrupos = 2 + azar(3)
      const grupos = Array.from({ length: nGrupos }, (_, i) => grp(`g${i}`, 6 + i, { ciclo: azar(4) === 0 ? 10 : undefined, aulaId: azar(3) === 0 ? 'compartida' : `aula${i}` }))
      const docentes = Array.from({ length: 3 + azar(3) }, (_, i) =>
        doc(`d${i}`, { areaId: ['mat', 'len', 'ing'][i % 3], noDisponible: azar(3) === 0 ? [`${1 + azar(5)}-${1 + azar(6)}`, `${1 + azar(5)}-1`] : [] }))
      const asignaciones = grupos.flatMap((g) => docentes.filter(() => azar(2) === 0).map((d) => asg(d.id, g.id, d.areaId, 1 + azar(5))))
      const e = mini({ grupos, docentes, asignaciones })
      e.colegio.reglas.bloques = { activa: azar(2) === 0, primaria: false, sinBloque: azar(2) === 0 ? ['mat'] : [] }
      e.colegio.reglas.maxMateriaDia.valor = 1 + azar(3)
      e.colegio.reglas.libreDiaria = { activa: azar(2) === 0 }
      e.colegio.reglas.espaciarMaterias = { activa: azar(2) === 0 }
      e.colegio.reglas.bloquesDeDos = { activa: azar(2) === 0 }
      const r = generarHorario(e, { semilla: caso, tiempoMs: 150 })
      const cruces = detectarCruces({ ...e, clases: r.clases }).filter((c) => !['carga', 'sinUbicar'].includes(c.tipo))
      expect(cruces, `caso ${caso}: ${cruces[0]?.mensaje}`).toEqual([])
      const pedidas = asignaciones.reduce((s, a) => s + a.horas, 0)
      expect(r.clases.length + r.sinUbicar.reduce((s, x) => s + x.horas, 0)).toBe(pedidas)
    }
  })
})

describe('completar el horario cuando cambia la asignación', () => {
  it('ubica las horas nuevas sin mover ninguna clase que ya estaba', { timeout: 30000 }, () => {
    const base = colegioEjemplo()
    const e = { ...base, clases: generarHorario(base, { semilla: 1 }).clases }
    e.clases[0] = { ...e.clases[0], fijada: true }
    // Matemáticas de 6-1 pasa de Carlos a 4 horas y la hora libre se le da a Ética con Carlos: hay lugar sin mover nada.
    const sinUna = e.clases.filter((c) => c.id !== e.clases.findLast((x) => x.asignacionId === 'd6-6-1-mat')!.id)
    const conNueva = {
      ...e, clases: sinUna,
      asignaciones: [...e.asignaciones.map((a) => (a.id === 'd6-6-1-mat' ? { ...a, horas: 4 } : a)), { id: 'nueva', docenteId: 'd6', grupoId: 'g6-1', areaId: 'eti', horas: 1 }],
    }
    const r = completarHorario(conNueva)
    expect(r.ubicadas).toBe(1)
    expect(r.sinUbicar).toBe(0)
    expect(r.estado.clases).toHaveLength(sinUna.length + 1)
    for (const c of sinUna) expect(r.estado.clases.find((x) => x.id === c.id)).toEqual(c)
    const nueva = r.estado.clases.find((c) => c.asignacionId === 'nueva')!
    expect(nueva.fijada).toBe(false)
    expect(detectarCruces(r.estado).filter((c) => c.tipo !== 'carga')).toEqual([])
  })
  it('sin horario o sin horas nuevas no hace nada', () => {
    const e = colegioEjemplo()
    expect(completarHorario(e).estado).toBe(e)
    const conHorario = { ...e, clases: generarHorario(e, { semilla: 1 }).clases }
    expect(completarHorario(conHorario)).toEqual({ estado: conHorario, ubicadas: 0, sinUbicar: 0 })
  })
  it('lo que no cabe sin mover otras clases queda por ubicar', () => {
    const lleno = [1, 2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => cls('d|a|mat', d, f)))
    const e = mini({ grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 30 }), doc('x', { cargaSemanal: 1 })], asignaciones: [asg('d', 'a', 'mat', 30), asg('x', 'a', 'len', 1)], clases: lleno })
    e.colegio.reglas.maxMateriaDia.activa = e.colegio.reglas.maxDocenteDia.activa = e.colegio.reglas.horaLibre.activa = false
    const r = completarHorario(e)
    expect(r).toMatchObject({ ubicadas: 0, sinUbicar: 1 })
    expect(r.estado.clases).toEqual(e.clases)
  })
})

describe('hora libre todos los días y carga pareja', () => {
  /** Ana dicta matemáticas en tres grupos; los demás completan cada grupo. */
  const colegio = (horasAna: number, reglas: { libre?: boolean; pareja?: boolean }) => {
    const grupos = [grp('a', 7), grp('b', 8), grp('c', 9)]
    const reparto = [Math.ceil(horasAna / 3), Math.ceil((horasAna - Math.ceil(horasAna / 3)) / 2)]
    const horas = [reparto[0], reparto[1], horasAna - reparto[0] - reparto[1]]
    const e = mini({
      grupos,
      docentes: [doc('ana', { cargaSemanal: horasAna }), doc('x', { areaId: 'len', cargaSemanal: 12 }), doc('y', { areaId: 'ing', cargaSemanal: 12 })],
      asignaciones: [
        ...grupos.map((g, i) => asg('ana', g.id, 'mat', horas[i])),
        ...grupos.map((g) => asg('x', g.id, 'len', 4)),
        ...grupos.map((g) => asg('y', g.id, 'ing', 4)),
      ],
    })
    e.colegio.reglas.maxMateriaDia.valor = 3
    e.colegio.reglas.maxDocenteDia.valor = 3
    e.colegio.reglas.libreDiaria = { activa: !!reglas.libre }
    e.colegio.reglas.cargaPareja = { activa: !!reglas.pareja }
    return e
  }
  const porDia = (clases: { asignacionId: string; dia: number }[], docente: string) =>
    [1, 2, 3, 4, 5].map((d) => clases.filter((c) => c.asignacionId.startsWith(`${docente}|`) && c.dia === d).length)

  it('con hora libre diaria ningún docente tiene clase en las 6 franjas de un día', () => {
    for (let semilla = 1; semilla <= 5; semilla++) {
      const e = colegio(25, { libre: true })
      const r = generarHorario(e, { semilla, tiempoMs: 1500 })
      expect(r.completo).toBe(true)
      expect(porDia(r.clases, 'ana')).toEqual([5, 5, 5, 5, 5])
      expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    }
  })
  it('con carga pareja las horas libres de un docente difieren a lo sumo en una entre días', () => {
    for (let semilla = 1; semilla <= 5; semilla++) {
      const e = colegio(22, { pareja: true })
      const r = generarHorario(e, { semilla, tiempoMs: 1500 })
      expect(r.completo).toBe(true)
      const dias = porDia(r.clases, 'ana')
      expect(Math.max(...dias) - Math.min(...dias), `semilla ${semilla}: ${dias}`).toBeLessThanOrEqual(1)
      expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    }
  })
  it('el colegio de ejemplo sale completo y sin cruces con las dos reglas', { timeout: 30000 }, () => {
    const e = colegioEjemplo()
    // Óscar entra a la 3.ª franja lunes y martes: con hora libre diaria sus 22 horas no caben (ver diagnóstico).
    e.docentes = e.docentes.map((d) => ({ ...d, noDisponible: [] }))
    e.colegio.reglas.libreDiaria = { activa: true }
    e.colegio.reglas.cargaPareja = { activa: true }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
})

describe('emparejar la carga de un horario ya hecho', () => {
  it('una carga muy dispareja hecha a mano queda pareja sin cruces', () => {
    const e = cargaDispareja()
    e.colegio.reglas.cargaPareja = { activa: true }
    expect(detectarCruces(e).map((c) => c.tipo)).toEqual(['cargaPareja'])
    const r = emparejarHorario(e)
    expect(detectarCruces(r.estado)).toEqual([])
    expect([1, 2, 3, 4, 5].map((d) => r.estado.clases.filter((c) => c.dia === d).length)).toEqual([4, 4, 4, 4, 4])
    expect(r).toMatchObject({ emparejados: 1, quedan: 0 })
    // Hacen falta 6 movimientos como mínimo (2 clases fuera de cada uno de los 3 días llenos): mueve casi solo esas.
    expect(r.movidas).toBeGreaterThanOrEqual(6)
    expect(r.movidas).toBeLessThanOrEqual(8)
  })
  it('en el colegio de ejemplo empareja a todos sin perder clases ni mover las fijadas', { timeout: 30000 }, () => {
    for (const semilla of [1, 5, 9]) {
      const base = colegioEjemplo()
      const clases = generarHorario(base, { semilla }).clases.map((c, i) => (i % 40 === 0 ? { ...c, fijada: true } : c))
      const e = { ...base, clases, colegio: { ...base.colegio, reglas: { ...base.colegio.reglas, cargaPareja: { activa: true } } } }
      const r = emparejarHorario(e)
      expect(detectarCruces(r.estado), `semilla ${semilla}`).toEqual([])
      expect(r.estado.clases).toHaveLength(clases.length)
      for (const f of clases.filter((c) => c.fijada)) expect(r.estado.clases).toContainEqual(f)
    }
  })
  it('sin la regla o sin horario no cambia nada', () => {
    const e = colegioEjemplo()
    expect(emparejarHorario(e).estado).toBe(e)
  })
})

describe('reacomodar el horario después de cambiar docentes, aulas o reglas', () => {
  const hecho = () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)],
      docentes: [doc('ana', { cargaSemanal: 5 }), doc('luis', { areaId: 'len', cargaSemanal: 5 })],
      asignaciones: [asg('ana', 'a', 'mat', 5), asg('luis', 'b', 'len', 5)],
      clases: [1, 2, 3, 4, 5].flatMap((d) => [cls('ana|a|mat', d, 1, { id: `m${d}` }), cls('luis|b|len', d, 1, { id: `l${d}` })]),
    })
    e.colegio.reglas.horaLibre.activa = false
    return e
  }
  it('si un docente deja de estar disponible, solo se mueven sus clases en esas franjas', () => {
    const e = hecho()
    e.docentes[0].noDisponible = ['1-1', '3-1']
    expect(detectarCruces(e).map((c) => c.tipo)).toEqual(['disponibilidad', 'disponibilidad'])
    const r = reacomodarHorario(e)
    expect(detectarCruces(r.estado)).toEqual([])
    expect(r.movidas).toBe(2)
    const igual = r.estado.clases.filter((c) => e.clases.some((x) => x.id === c.id && x.dia === c.dia && x.franja === c.franja))
    expect(igual).toHaveLength(8)
  })
  it('con los grupos llenos mueve pocas clases: a lo sumo tres por cada clase que quedó mal', { timeout: 30000 }, () => {
    const base = colegioEjemplo()
    const e = { ...base, clases: generarHorario(base, { semilla: 1 }).clases }
    const luz = e.docentes[0]
    const suyas = new Set(e.asignaciones.filter((a) => a.docenteId === luz.id).map((a) => a.id))
    const malas = e.clases.filter((c) => suyas.has(c.asignacionId) && c.dia === 1).length
    e.docentes = e.docentes.map((d) => (d.id === luz.id ? { ...d, noDisponible: [1, 2, 3, 4, 5, 6].map((f) => `1-${f}`) } : d))
    const r = reacomodarHorario(e)
    expect(detectarCruces(r.estado).filter((c) => c.tipo !== 'carga')).toEqual([])
    // Antes de las cadenas cortas movía 21 a 26 clases para 5 que quedaron mal.
    expect(r.movidas, `${malas} clases quedaron mal`).toBeLessThanOrEqual(3 * malas)
  })
  it('una clase fijada no se mueve aunque choque, y sin nada que arreglar no cambia nada', () => {
    const e = hecho()
    e.clases = e.clases.map((c) => (c.id === 'm1' ? { ...c, fijada: true } : c))
    e.docentes[0].noDisponible = ['1-1']
    expect(reacomodarHorario(e).estado).toBe(e)
    expect(reacomodarHorario(hecho()).estado.clases).toEqual(hecho().clases)
  })
})

describe('materias de pocas horas en días separados', () => {
  /** Días en que cada materia de 4 horas o menos se dicta en cada grupo. */
  const diasPorMateria = (e: Estado, clases: { asignacionId: string; dia: number }[]) => {
    const r = new Map<string, Set<number>>()
    for (const c of clases) {
      const a = e.asignaciones.find((x) => x.id === c.asignacionId)!
      const llave = `${a.grupoId}|${a.areaId}`
      r.set(llave, (r.get(llave) ?? new Set()).add(c.dia))
    }
    return r
  }
  for (const bloques of [false, true])
    it(`el colegio de ejemplo sale completo, sin cruces y sin materias cortas en días seguidos${bloques ? ', con bloques' : ''}`, { timeout: 30000 }, () => {
      const e = colegioEjemplo()
      e.colegio.reglas.espaciarMaterias = { activa: true }
      e.colegio.reglas.bloques = { activa: bloques, primaria: false }
      const r = generarHorario(e, { semilla: 1 })
      expect(r.completo).toBe(true)
      expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
      const horas = new Map<string, number>()
      for (const a of e.asignaciones) horas.set(`${a.grupoId}|${a.areaId}`, (horas.get(`${a.grupoId}|${a.areaId}`) ?? 0) + a.horas)
      for (const [llave, dias] of diasPorMateria(e, r.clases)) {
        if (horas.get(llave)! > 4) continue
        const d = [...dias].sort()
        expect(d.some((x, i) => i > 0 && x - d[i - 1] === 1), `${llave}: ${d}`).toBe(false)
      }
    })
  it('al activar la regla con un horario hecho, el reacomodo separa las materias cortas', { timeout: 30000 }, () => {
    const base = colegioEjemplo()
    const e = { ...base, clases: generarHorario(base, { semilla: 3 }).clases }
    e.colegio = { ...e.colegio, reglas: { ...e.colegio.reglas, espaciarMaterias: { activa: true } } }
    const antes = detectarCruces(e).filter((c) => c.tipo === 'diasSeguidos').length
    expect(antes).toBeGreaterThan(0)
    const r = reacomodarHorario(e)
    expect(detectarCruces(r.estado).filter((c) => c.tipo !== 'carga')).toEqual([])
  })
})

describe('materias excluidas de los bloques', () => {
  /** Pares de horas seguidas (1-2, 3-4 o 5-6) de la misma materia el mismo día, por área. */
  const bloquesPorArea = (e: Estado, clases: { asignacionId: string; dia: number; franja: number }[]) => {
    const area = (id: string) => e.asignaciones.find((a) => a.id === id)!
    const r = new Map<string, number>()
    for (const c of clases)
      if (c.franja % 2 === 1) {
        const a = area(c.asignacionId)
        const par = clases.some((x) => x.dia === c.dia && x.franja === c.franja + 1 && area(x.asignacionId).grupoId === a.grupoId && area(x.asignacionId).areaId === a.areaId)
        if (par) r.set(a.areaId, (r.get(a.areaId) ?? 0) + 1)
      }
    return r
  }
  it('Educación Física excluida queda en horas sueltas y las demás materias siguen en bloque', { timeout: 30000 }, () => {
    const e = colegioEjemplo()
    e.colegio.reglas.bloques = { activa: true, primaria: false, sinBloque: ['efi'] }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    const b = bloquesPorArea(e, r.clases)
    expect(b.get('efi') ?? 0).toBe(0)
    expect(b.get('mat') ?? 0).toBeGreaterThan(0)
  })
})

describe('materias de 2 horas siempre en bloque', () => {
  const sueltas = (e: Estado, clases: { asignacionId: string; dia: number; franja: number }[]) =>
    e.asignaciones.filter((a) => a.horas === 2).filter((a) => {
      const suyas = clases.filter((c) => c.asignacionId === a.id)
      return !(suyas.length === 2 && suyas[0].dia === suyas[1].dia && Math.ceil(suyas[0].franja / 2) === Math.ceil(suyas[1].franja / 2))
    }).length
  it('el colegio de ejemplo sale completo y cada materia de 2 horas queda en bloque', { timeout: 30000 }, () => {
    const e = colegioEjemplo()
    e.colegio.reglas.bloquesDeDos = { activa: true }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    expect(sueltas(e, r.clases)).toBe(0)
  })
  it('al activarla con un horario hecho, el reacomodo junta las que estaban separadas', { timeout: 30000 }, () => {
    const base = colegioEjemplo()
    const e = { ...base, clases: generarHorario(base, { semilla: 2 }).clases }
    expect(sueltas(e, e.clases)).toBeGreaterThan(0)
    e.colegio = { ...e.colegio, reglas: { ...e.colegio.reglas, bloquesDeDos: { activa: true } } }
    const r = reacomodarHorario(e)
    expect(detectarCruces(r.estado).filter((c) => c.tipo !== 'carga')).toEqual([])
    expect(sueltas(r.estado, r.estado.clases)).toBe(0)
  })
})

describe('docentes de mañana y tarde', () => {
  it('usa la misma franja en la mañana y en la tarde del mismo día cuando hace falta', () => {
    // Ana solo puede venir el lunes: 6 horas en la mañana con 7-1 y 6 en la tarde con 8-1.
    const otrosDias = [2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].flatMap((f) => [`${d}-${f}`, `${d}-${f}-t`]))
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { jornada: 'tarde' })],
      docentes: [doc('ana', { jornada: 'ambas', cargaSemanal: 12, noDisponible: otrosDias })],
      asignaciones: [asg('ana', 'a', 'mat', 6), asg('ana', 'b', 'mat', 6)],
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, maxMateriaDia: { activa: false, valor: 2 }, maxDocenteDia: { activa: false, valor: 2, aplicaEspecialistas: true } }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases.every((c) => c.dia === 1)).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
})

describe('materias en contrajornada', () => {
  it('ubica en la tarde la materia marcada así, aunque la mañana del grupo esté llena', () => {
    const e = mini({
      grupos: [grp('a', 7)],
      docentes: [doc('x', { cargaSemanal: 30 }), doc('ana', { jornada: 'ambas', cargaSemanal: 2, areaId: 'tec' })],
      asignaciones: [asg('x', 'a', 'mat', 30), { ...asg('ana', 'a', 'tec', 2), jornada: 'tarde' as const }],
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, maxMateriaDia: { activa: false, valor: 2 }, maxDocenteDia: { activa: false, valor: 2, aplicaEspecialistas: true } }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases.filter((c) => c.asignacionId === 'ana|a|tec')).toHaveLength(2)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
})

describe('media técnica como jornada extra', () => {
  it('con la mañana del grupo llena, la media técnica va en la tarde y puede tener más de 2 horas el mismo día', () => {
    // La mañana de 10-1 se llena con 5 materias de 6 horas; Tomás (media técnica) solo viene el lunes.
    const regulares = ['mat', 'len', 'ing', 'soc', 'tec']
    const e = mini({
      grupos: [grp('a', 10)],
      docentes: [
        ...regulares.map((a) => doc(`x${a}`, { areaId: a, cargaSemanal: 6 })),
        doc('t', { jornada: 'tarde', areaId: 'mt', cargaSemanal: 6, noDisponible: [2, 3, 4, 5].flatMap((d) => [1, 2, 3, 4, 5, 6].map((f) => `${d}-${f}`)) }),
      ],
      asignaciones: [...regulares.map((a) => asg(`x${a}`, 'a', a, 6)), asg('t', 'a', 'mt', 6)],
    })
    e.areas.push({ id: 'mt', nombre: 'Media técnica', afines: [], mediaTecnica: true })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, maxMateriaDia: { activa: true, valor: 2 }, maxDocenteDia: { activa: true, valor: 2, aplicaEspecialistas: true } }
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases.filter((c) => c.asignacionId === 't|a|mt').every((c) => c.dia === 1)).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
  })
})

describe('organizar la media técnica', () => {
  const colegio = () => {
    const base = colegioEjemplo()
    base.areas.push({ id: 'mt', nombre: 'Media técnica', afines: [] })
    base.docentes.push(doc('tm', { nombre: 'Profe Técnica', jornada: 'tarde', areaId: 'mt', cargaSemanal: 18 }))
    for (const g of base.grupos.filter((x) => x.grado >= 10)) base.asignaciones.push(asg('tm', g.id, 'mt', 6))
    return base
  }
  it('el generador pone la media técnica con un grupo por día y todas sus horas juntas', { timeout: 30000 }, () => {
    const e = colegio()
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(detectarCruces({ ...e, clases: r.clases })).toEqual([])
    const dias = (g: string) => new Set(r.clases.filter((c) => c.asignacionId === `tm|${g}|mt`).map((c) => c.dia))
    for (const g of e.grupos.filter((x) => x.grado >= 10)) expect(dias(g.id).size, g.id).toBe(1)
  })
  it('organizarla no mueve ninguna otra clase', { timeout: 30000 }, () => {
    const base = colegio()
    const e = { ...base, clases: generarHorario(base, { semilla: 2 }).clases }
    // Se desordena a mano: la media técnica de 10-1 repartida en varios días.
    const mt101 = e.clases.filter((c) => c.asignacionId.startsWith('tm|') && c.asignacionId.includes('10-1'))
    const desordenada = { ...e, clases: e.clases.map((c, i) => (mt101.some((x) => x.id === c.id) ? { ...c, dia: (i % 5) + 1 } : c)) }
    const r = organizarMediaTecnica(desordenada)
    const otras = (x: typeof e) => x.clases.filter((c) => !c.asignacionId.startsWith('tm|')).map((c) => `${c.id}@${c.dia}-${c.franja}`).sort()
    expect(otras(r.estado)).toEqual(otras(desordenada))
    expect(detectarCruces(r.estado).filter((c) => c.tipo !== 'carga')).toEqual([])
  })
})
