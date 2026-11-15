import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { aulaDeClase, avisosAulas, detectarCruces, sesiones } from './cruces'
import type { Clase, Estado } from './tipos'

const tipos = (e: Estado) => detectarCruces(e).map((c) => c.tipo)
const lleno = (asignacionId: string, dias: number[], franjas = [1, 2, 3, 4, 5, 6]): Clase[] =>
  dias.flatMap((dia) => franjas.map((f) => cls(asignacionId, dia, f)))

describe('cruces obligatorios', () => {
  it('docente en dos clases a la misma franja', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d')],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 2, 3), cls('d|b|mat', 2, 3)],
    })
    const cruce = detectarCruces(e).find((c) => c.tipo === 'docente')
    expect(cruce).toMatchObject({ docenteId: 'd', dia: 2, franja: 3 })
    expect(cruce?.claseIds).toHaveLength(2)
    expect(cruce?.mensaje).toContain('martes')
  })
  it('grupo con dos clases a la misma franja', () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d'), doc('x')],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('x', 'a', 'len', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('x|a|len', 1, 1)],
    })
    expect(tipos(e)).toContain('grupo')
    expect(tipos(e)).toContain('aula')
  })
  it('aula ocupada por dos clases a la vez', () => {
    const e = mini({
      grupos: [grp('a', 7, { aulaId: 'sala' }), grp('b', 8, { aulaId: 'sala' })], docentes: [doc('d'), doc('x')],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('x', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('x|b|mat', 1, 1)],
    })
    expect(tipos(e)).toContain('aula')
    expect(tipos(e)).not.toContain('docente')
  })
  it('la misma aula en jornadas distintas no es cruce', () => {
    const e = mini({
      grupos: [grp('a', 7, { aulaId: 'sala' }), grp('b', 8, { aulaId: 'sala', jornada: 'tarde' })],
      docentes: [doc('d'), doc('x', { jornada: 'tarde' })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('x', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('x|b|mat', 1, 1)],
    })
    expect(tipos(e)).not.toContain('aula')
  })
  it('clase en una franja donde el docente no está disponible', () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { noDisponible: ['1-1', '1-2'] })],
      asignaciones: [asg('d', 'a', 'mat', 1)], clases: [cls('d|a|mat', 1, 2)],
    })
    expect(tipos(e)).toContain('disponibilidad')
  })
  it('carga distinta a la asignada y horas sin ubicar', () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 2)], clases: [cls('d|a|mat', 1, 1)],
    })
    expect(tipos(e).sort()).toEqual(['carga', 'sinUbicar'])
  })
  it('sin clases no hay horario y por tanto no hay cruces', () => {
    const e = mini({ grupos: [grp('a', 7)], docentes: [doc('d')], asignaciones: [asg('d', 'a', 'mat', 22)] })
    expect(detectarCruces(e)).toEqual([])
  })
})

describe('reglas configurables', () => {
  const tres = (p: Partial<Estado> = {}) =>
    mini({
      grupos: [grp('a', 8)], docentes: [doc('d', { cargaSemanal: 3 })],
      asignaciones: [asg('d', 'a', 'mat', 3)],
      clases: [cls('d|a|mat', 1, 1), cls('d|a|mat', 1, 2), cls('d|a|mat', 1, 3)],
      ...p,
    })
  it('avisa 3 horas de Matemáticas el mismo día en un grupo de bachillerato', () => {
    const cruce = detectarCruces(tres()).find((c) => c.tipo === 'maxMateria')
    expect(cruce).toMatchObject({ grupoId: 'a', dia: 1 })
    expect(cruce?.mensaje).toContain('máximo es 2')
    expect(tipos(tres())).toContain('maxDocente')
  })
  it('con las reglas inactivas no avisa', () => {
    const e = tres()
    e.colegio.reglas.maxMateriaDia.activa = false
    e.colegio.reglas.maxDocenteDia.activa = false
    expect(tipos(e)).toEqual([])
  })
  it('el máximo con el mismo docente no aplica al titular de primaria', () => {
    const e = mini({
      grupos: [grp('p', 3)],
      docentes: [doc('t', { nivel: 'primaria', rolPrimaria: 'titular', cargaSemanal: 4, direccionGrupoId: 'p' })],
      asignaciones: [asg('t', 'p', 'mat', 2), asg('t', 'p', 'len', 2)],
      clases: [cls('t|p|mat', 1, 1), cls('t|p|mat', 1, 2), cls('t|p|len', 1, 3), cls('t|p|len', 1, 4)],
    })
    expect(tipos(e)).toEqual([])
  })
  it('a un especialista de primaria se le aplica solo si el colegio lo activa', () => {
    const e = mini({
      grupos: [grp('p', 3)],
      docentes: [doc('s', { nivel: 'primaria', rolPrimaria: 'especialista', cargaSemanal: 3, areaId: 'ing' })],
      asignaciones: [asg('s', 'p', 'ing', 2), asg('s', 'p', 'len', 1)],
      clases: [cls('s|p|ing', 1, 1), cls('s|p|ing', 1, 2), cls('s|p|len', 1, 3)],
    })
    expect(tipos(e)).toEqual(['maxDocente'])
    e.colegio.reglas.maxDocenteDia.aplicaEspecialistas = false
    expect(tipos(e)).toEqual([])
  })
})

describe('regla de hora libre', () => {
  const con = (clases: Clase[], ciclo: 5 | 10 = 5) =>
    mini({
      colegio: { ...mini().colegio, ciclo, reglas: { ...mini().colegio.reglas, maxMateriaDia: { activa: false, valor: 2 }, maxDocenteDia: { activa: false, valor: 2, aplicaEspecialistas: true } } },
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: (clases.length * 5) / ciclo })],
      asignaciones: [asg('d', 'a', 'mat', clases.length)], clases,
    })
  it('6 clases el martes con lunes y miércoles llenos se rechaza', () => {
    const cruces = detectarCruces(con(lleno('d|a|mat', [1, 2, 3]))).filter((c) => c.tipo === 'horaLibre')
    expect(cruces.map((c) => c.dia)).toContain(2)
  })
  it('6 clases el lunes y 5 el martes se acepta', () => {
    const e = con([...lleno('d|a|mat', [1]), ...lleno('d|a|mat', [2], [1, 2, 3, 4, 5])])
    expect(tipos(e)).toEqual([])
  })
  it('el día 10 solo mira el día 9: el día 1 no es contiguo', () => {
    const e = con([...lleno('d|a|mat', [8, 9, 10]), cls('d|a|mat', 1, 1)], 10)
    expect(detectarCruces(e).filter((c) => c.tipo === 'horaLibre').map((c) => c.dia)).toEqual([9, 10])
  })
  it('desactivada no avisa', () => {
    const e = con(lleno('d|a|mat', [1, 2, 3]))
    e.colegio.reglas.horaLibre.activa = false
    expect(tipos(e)).toEqual([])
  })
})

describe('sesiones y aulas', () => {
  it('un grupo de ciclo 5 en un horario de 10 días repite su semana', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { ciclo: 10 })], docentes: [doc('d')],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 3, 2), cls('d|b|mat', 8, 2)],
    })
    expect(sesiones(e).map((s) => [s.grupoId, s.dia])).toEqual([['a', 3], ['a', 8], ['b', 8]])
    expect(tipos(e)).toContain('docente')
  })
  it('el aula sale del modelo: grupo, docente o mixto', () => {
    const base = mini({
      grupos: [grp('a', 7, { aulaId: 'del-grupo' })],
      docentes: [doc('fijo', { aulaId: 'del-docente' }), doc('rota')],
      asignaciones: [asg('fijo', 'a', 'mat', 1), asg('rota', 'a', 'mat', 1)],
    })
    const [c1, c2] = [cls('fijo|a|mat', 1, 1), cls('rota|a|mat', 1, 2)]
    const con = (modeloAula: Estado['colegio']['modeloAula']) => ({ ...base, colegio: { ...base.colegio, modeloAula } })
    expect(aulaDeClase(con('grupo'), c1)).toBe('del-grupo')
    expect(aulaDeClase(con('docente'), c1)).toBe('del-docente')
    expect(aulaDeClase(con('mixto'), c1)).toBe('del-docente')
    expect(aulaDeClase(con('mixto'), c2)).toBe('del-grupo')
    expect(aulaDeClase(con('grupo'), { ...c1, aulaId: 'otra' })).toBe('otra')
  })
  it('una clase sin aula se avisa', () => {
    const e = mini({
      grupos: [grp('a', 7, { aulaId: undefined })], docentes: [doc('d', { cargaSemanal: 1 })],
      asignaciones: [asg('d', 'a', 'mat', 1)], clases: [cls('d|a|mat', 1, 1)],
    })
    expect(tipos(e)).toEqual(['sinAula'])
  })
  it('con aula por grupo avisa si hay menos aulas que grupos', () => {
    const e = mini({ grupos: [grp('a', 7, { aulaId: 'x' }), grp('b', 8, { aulaId: 'x' })] })
    expect(avisosAulas(e).join(' ')).toContain('menos aulas que grupos')
  })
})

describe('hora libre todos los días y carga pareja', () => {
  const con = (clases: Clase[], reglas: { libre?: boolean; pareja?: boolean }, p: Partial<Estado['docentes'][0]> = {}) => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { nombre: 'Ana', cargaSemanal: clases.length, ...p })],
      asignaciones: [asg('d', 'a', 'mat', clases.length)], clases,
    })
    e.colegio.reglas = { ...e.colegio.reglas, maxMateriaDia: { activa: false, valor: 2 }, maxDocenteDia: { activa: false, valor: 2, aplicaEspecialistas: true }, horaLibre: { activa: false } }
    e.colegio.reglas.libreDiaria = { activa: !!reglas.libre }
    e.colegio.reglas.cargaPareja = { activa: !!reglas.pareja }
    return e
  }
  it('avisa el día en que el docente no tiene ninguna hora libre', () => {
    const e = con([...lleno('d|a|mat', [1]), ...lleno('d|a|mat', [2, 3, 4, 5], [1, 2, 3, 4])], { libre: true })
    const c = detectarCruces(e).filter((x) => x.tipo === 'libreDiaria')
    expect(c.map((x) => x.dia)).toEqual([1])
    expect(c[0].mensaje).toBe('Ana no tiene ninguna hora libre el lunes.')
  })
  it('cuenta como día lleno el que tiene clase en todas las franjas en que el docente está disponible', () => {
    const e = con(lleno('d|a|mat', [1], [1, 2, 3, 4]), { libre: true }, { noDisponible: ['1-5', '1-6'] })
    expect(detectarCruces(e).filter((x) => x.tipo === 'libreDiaria').map((x) => x.dia)).toEqual([1])
  })
  it('avisa la carga dispareja: un día lleno y otro con más de dos horas libres', () => {
    const e = con([...lleno('d|a|mat', [1, 2]), ...lleno('d|a|mat', [3, 4, 5], [1, 2, 3])], { pareja: true })
    const c = detectarCruces(e).filter((x) => x.tipo === 'cargaPareja')
    expect(c).toHaveLength(1)
    expect(c[0].mensaje).toBe('La carga de Ana no está pareja: el lunes tiene 0 horas libres y el miércoles 3.')
  })
  it('una diferencia de una hora libre entre días es pareja', () => {
    const e = con([...lleno('d|a|mat', [1, 2], [1, 2, 3, 4, 5]), ...lleno('d|a|mat', [3, 4, 5], [1, 2, 3, 4])], { pareja: true, libre: true })
    expect(tipos(e)).toEqual([])
  })
  it('desactivadas no avisan', () => {
    const e = con([...lleno('d|a|mat', [1, 2]), ...lleno('d|a|mat', [3, 4, 5], [1, 2, 3])], {})
    expect(tipos(e)).toEqual([])
  })
})

describe('materias de pocas horas en días separados', () => {
  const con = (horas: number, dias: number[][], reglas: Partial<Estado['colegio']['reglas']> = {}) => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: horas })],
      asignaciones: [asg('d', 'a', 'ing', horas)],
      clases: dias.flatMap(([dia, ...franjas]) => franjas.map((f) => cls('d|a|ing', dia, f))),
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, espaciarMaterias: { activa: true }, ...reglas }
    return e
  }
  it('avisa una materia de 4 horas con sus dos bloques en días seguidos', () => {
    const c = detectarCruces(con(4, [[1, 1, 2], [2, 3, 4]])).filter((x) => x.tipo === 'diasSeguidos')
    expect(c.map((x) => x.mensaje)).toEqual(['Inglés de 7-1 queda en días seguidos (lunes y martes); con 4 horas o menos por semana va en días separados.'])
  })
  it('lunes, miércoles y viernes está bien para una materia de 3 horas', () => {
    expect(tipos(con(3, [[1, 1], [3, 2], [5, 6]]))).toEqual([])
    expect(tipos(con(3, [[1, 1], [2, 2], [4, 6]]))).toContain('diasSeguidos')
  })
  it('el límite de horas se puede cambiar: con 3, una materia de 4 horas ya no se separa', () => {
    const tres = { espaciarMaterias: { activa: true, horas: 3 } }
    expect(tipos(con(4, [[1, 1, 2], [2, 3, 4]], tres))).not.toContain('diasSeguidos')
    const c = detectarCruces(con(3, [[1, 1], [2, 2], [4, 6]], tres)).filter((x) => x.tipo === 'diasSeguidos')
    expect(c[0].mensaje).toBe('Inglés de 7-1 queda en días seguidos (lunes y martes); con 3 horas o menos por semana va en días separados.')
  })
  it('no aplica a materias de más de 4 horas, ni cuando no se puede cumplir, ni con la regla apagada', () => {
    expect(tipos(con(5, [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]))).not.toContain('diasSeguidos')
    // 4 horas sueltas con máximo 1 por día necesitan 4 de los 5 días: imposible separarlas.
    expect(tipos(con(4, [[1, 1], [2, 1], [3, 1], [4, 1]], { maxMateriaDia: { activa: true, valor: 1 } }))).not.toContain('diasSeguidos')
    expect(tipos(con(2, [[1, 1], [2, 1]], { espaciarMaterias: { activa: false } }))).toEqual([])
  })
})

describe('materias excluidas de los bloques', () => {
  const con = (franjas: number[]) => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: franjas.length })],
      asignaciones: [asg('d', 'a', 'soc', franjas.length)], clases: franjas.map((f) => cls('d|a|soc', 1, f)),
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, bloques: { activa: true, primaria: false, sinBloque: ['soc'] } }
    return e
  }
  it('avisa dos horas pegadas en el mismo par de franjas de una materia excluida', () => {
    const c = detectarCruces(con([1, 2])).filter((x) => x.tipo === 'bloqueExcluido')
    expect(c.map((x) => x.mensaje)).toEqual(['Ciencias Sociales de 7-1 tiene dos horas seguidas el lunes (franjas 1 y 2) y está excluida de los bloques.'])
  })
  it('dos horas separadas por el descanso no son un bloque', () => {
    expect(tipos(con([2, 3]))).not.toContain('bloqueExcluido')
  })
})

describe('materias de 2 horas siempre en bloque', () => {
  const con = (clases: [number, number][], reglas: Partial<Estado['colegio']['reglas']> = {}) => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 2, areaId: 'ing' })],
      asignaciones: [asg('d', 'a', 'ing', 2)], clases: clases.map(([dia, f]) => cls('d|a|ing', dia, f)),
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false }, bloquesDeDos: { activa: true }, ...reglas }
    return e
  }
  it('avisa las dos horas separadas, aunque sea en días distintos o con el descanso en medio', () => {
    expect(detectarCruces(con([[1, 1], [3, 3]])).filter((x) => x.tipo === 'bloqueDeDos').map((x) => x.mensaje))
      .toEqual(['Inglés de 7-1 con Ana tiene sus 2 horas separadas; van juntas en bloque (franjas 1-2, 3-4 o 5-6).'])
    expect(tipos(con([[1, 2], [1, 3]]))).toContain('bloqueDeDos')
  })
  it('en bloque está bien; la regla apagada o la materia excluida de los bloques no avisan', () => {
    expect(tipos(con([[1, 3], [1, 4]]))).toEqual([])
    expect(tipos(con([[1, 1], [3, 3]], { bloquesDeDos: { activa: false } }))).toEqual([])
    expect(tipos(con([[1, 1], [3, 3]], { bloques: { activa: false, primaria: false, sinBloque: ['ing'] } }))).not.toContain('bloqueDeDos')
  })
})

describe('docentes de mañana y tarde', () => {
  const dos = (clases: Clase[], p: Partial<Estado['docentes'][0]> = {}) => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { jornada: 'tarde' })],
      docentes: [doc('d', { nombre: 'Ana', jornada: 'ambas', cargaSemanal: clases.length, ...p })],
      asignaciones: [asg('d', 'a', 'mat', clases.filter((c) => c.asignacionId === 'd|a|mat').length), asg('d', 'b', 'mat', clases.filter((c) => c.asignacionId === 'd|b|mat').length)],
      clases,
    })
    e.colegio.reglas = { ...e.colegio.reglas, horaLibre: { activa: false } }
    return e
  }
  it('la franja 1 de la mañana y la de la tarde son horas distintas: no hay cruce', () => {
    expect(tipos(dos([cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1)]))).toEqual([])
  })
  it('la disponibilidad de la tarde se marca aparte de la de la mañana', () => {
    const e = dos([cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1)], { noDisponible: ['1-1-t'] })
    const c = detectarCruces(e).filter((x) => x.tipo === 'disponibilidad')
    expect(c.map((x) => x.mensaje)).toEqual(['Ana no está disponible el lunes en la franja 1 de la tarde.'])
  })
  it('un docente de una sola jornada sigue sin poder dar dos clases a la misma hora', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('c', 9)], docentes: [doc('d', { cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'c', 'mat', 1)], clases: [cls('d|a|mat', 1, 1), cls('d|c|mat', 1, 1)],
    })
    expect(tipos(e)).toContain('docente')
  })
})

describe('materias en contrajornada', () => {
  it('un grupo de la mañana puede tener en la tarde la materia que así se asignó, sin cruce con su mañana', () => {
    const e = mini({
      grupos: [grp('a', 7)],
      docentes: [doc('ana', { nombre: 'Ana', jornada: 'ambas', cargaSemanal: 2 })],
      asignaciones: [asg('ana', 'a', 'mat', 1), { ...asg('ana', 'a', 'tec', 1), jornada: 'tarde' as const }],
      clases: [cls('ana|a|mat', 1, 1), cls('ana|a|tec', 1, 1)],
    })
    e.colegio.reglas.horaLibre.activa = false
    expect(tipos(e)).toEqual([])
  })
})

describe('media técnica como jornada extra', () => {
  const colegio = (clases: Clase[]) => {
    const e = mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'mt', nombre: 'Media técnica', afines: [], mediaTecnica: true }],
      grupos: [grp('a', 10)],
      docentes: [doc('d', { cargaSemanal: 1 }), doc('t', { nombre: 'Tomás', jornada: 'tarde', areaId: 'mt', cargaSemanal: 4 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('t', 'a', 'mt', 4)],
      clases,
    })
    e.colegio.reglas.horaLibre.activa = false
    return e
  }
  it('va en la tarde del grupo de la mañana: no choca con su mañana y no tiene máximo diario', () => {
    const e = colegio([cls('d|a|mat', 1, 1), ...[1, 2, 3, 4].map((f) => cls('t|a|mt', 1, f))])
    expect(tipos(e)).toEqual([])
    expect(sesiones(e).filter((s) => s.areaId === 'mt').every((s) => s.jornada === 'tarde')).toBe(true)
  })
})

describe('media técnica: un grupo por día', () => {
  const colegio = (clases: Clase[]) => {
    const e = mini({
      areas: [{ id: 'mt', nombre: 'Media técnica', afines: [] }],
      grupos: [grp('a', 10), grp('b', 11)],
      docentes: [doc('t', { nombre: 'Tomás', jornada: 'tarde', areaId: 'mt', cargaSemanal: clases.length })],
      asignaciones: [asg('t', 'a', 'mt', clases.filter((c) => c.asignacionId === 't|a|mt').length), asg('t', 'b', 'mt', clases.filter((c) => c.asignacionId === 't|b|mt').length)],
      clases,
    })
    e.colegio.reglas.horaLibre.activa = false
    return e
  }
  it('avisa si el docente de media técnica tiene dos grupos el mismo día', () => {
    const c = detectarCruces(colegio([cls('t|a|mt', 1, 1), cls('t|b|mt', 1, 2)])).filter((x) => x.tipo === 'mediaTecnicaDia')
    expect(c.map((x) => x.mensaje)).toEqual(['Tomás tiene media técnica con 10-1 y 11-1 el lunes; va un grupo por día.'])
  })
  it('un grupo por día está bien', () => {
    expect(tipos(colegio([cls('t|a|mt', 1, 1), cls('t|a|mt', 1, 2), cls('t|b|mt', 2, 1)]))).toEqual([])
  })
})
