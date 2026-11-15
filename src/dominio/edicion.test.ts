import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { detectarCruces } from './cruces'
import { cambiarCicloColegio, cambiarCicloGrupo, cambiarClase, eliminarArea, eliminarAula, eliminarDocente, eliminarGrupo, moverClase, quitarAjustesFuturos, sincronizarClases, intensidadDesdeAsignacion, unirAreas, unirDocentes, docentesRepetidos } from './edicion'

const dos = () =>
  mini({
    grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d'), doc('x')],
    asignaciones: [asg('d', 'a', 'mat', 2), asg('d', 'b', 'mat', 1), asg('x', 'a', 'len', 1)],
    clases: [
      cls('d|a|mat', 1, 1, { id: 'm1' }), cls('d|a|mat', 1, 2, { id: 'm2' }),
      cls('d|b|mat', 2, 1, { id: 'mb' }), cls('x|a|len', 3, 1, { id: 'l1' }),
    ],
  })

describe('edición manual', () => {
  it('mueve una clase a una celda vacía', () => {
    const e = moverClase(dos(), 'm1', 4, 5)
    expect(e.clases.find((c) => c.id === 'm1')).toMatchObject({ dia: 4, franja: 5 })
  })
  it('si el grupo ya tiene clase en el destino, las intercambia', () => {
    const e = moverClase(dos(), 'm1', 3, 1)
    expect(e.clases.find((c) => c.id === 'm1')).toMatchObject({ dia: 3, franja: 1 })
    expect(e.clases.find((c) => c.id === 'l1')).toMatchObject({ dia: 1, franja: 1 })
  })
  it('un movimiento que choca con otra clase del mismo docente se guarda y queda como cruce', () => {
    const e = moverClase(dos(), 'm1', 2, 1)
    expect(e.clases.find((c) => c.id === 'm1')).toMatchObject({ dia: 2, franja: 1 })
    expect(detectarCruces(e).some((c) => c.tipo === 'docente' && c.claseIds.includes('m1'))).toBe(true)
  })
  it('no modifica el estado original', () => {
    const e = dos()
    moverClase(e, 'm1', 4, 5)
    expect(e.clases.find((c) => c.id === 'm1')).toMatchObject({ dia: 1, franja: 1 })
  })
  it('fija una clase y le cambia el aula', () => {
    const e = cambiarClase(dos(), 'm1', { fijada: true, aulaId: 'lab' })
    expect(e.clases.find((c) => c.id === 'm1')).toMatchObject({ fijada: true, aulaId: 'lab' })
  })
})

describe('borrar en cascada', () => {
  const completo = () => ({
    ...dos(),
    ajustes: [{
      fecha: '2026-11-10', diaCiclo: 2,
      ausencias: [{ docenteId: 'd', franjas: [1] }, { docenteId: 'x', franjas: [1] }],
      reemplazos: [{ claseId: 'mb', docenteId: 'x' }, { claseId: 'l1', docenteId: 'd' }],
      movimientos: [], gruposAusentes: ['a', 'b'],
    }],
  })
  it('borrar un docente quita sus asignaciones, clases, ausencias y reemplazos', () => {
    const e = eliminarDocente(completo(), 'd')
    expect(JSON.stringify(e)).not.toContain('"d"')
    expect(e.asignaciones.map((a) => a.id)).toEqual(['x|a|len'])
    expect(e.clases.map((c) => c.id)).toEqual(['l1'])
    expect(e.ajustes[0].ausencias).toEqual([{ docenteId: 'x', franjas: [1] }])
    expect(e.ajustes[0].reemplazos).toEqual([])
  })
  it('borrar un grupo quita sus asignaciones, clases y direcciones de grupo', () => {
    const inicial = completo()
    inicial.docentes[0].direccionGrupoId = 'a'
    const e = eliminarGrupo(inicial, 'a')
    expect(e.grupos.map((g) => g.id)).toEqual(['b'])
    expect(e.asignaciones.map((a) => a.id)).toEqual(['d|b|mat'])
    expect(e.clases.map((c) => c.id)).toEqual(['mb'])
    expect(e.docentes[0].direccionGrupoId).toBeUndefined()
    expect(e.ajustes[0].gruposAusentes).toEqual(['b'])
  })
  it('borrar un área la quita de afines, intensidad, asignaciones y nombramientos', () => {
    const inicial = { ...dos(), intensidad: { 7: { mat: 5, len: 5 } } }
    const e = eliminarArea(inicial, 'mat')
    expect(e.areas.some((a) => a.id === 'mat' || a.afines.includes('mat'))).toBe(false)
    expect(e.intensidad[7]).toEqual({ len: 5 })
    expect(e.asignaciones.map((a) => a.id)).toEqual(['x|a|len'])
    expect(e.clases.map((c) => c.id)).toEqual(['l1'])
    expect(e.docentes.map((d) => d.areaId)).toEqual(['', ''])
  })
  it('borrar un aula la quita de grupos, docentes y clases', () => {
    const inicial = dos()
    inicial.docentes[0].aulaId = 'aula-a'
    inicial.clases[0].aulaId = 'aula-a'
    const e = eliminarAula(inicial, 'aula-a')
    expect(JSON.stringify(e)).not.toContain('aula-a')
  })
})

describe('cambios que arrastran otros datos', () => {
  it('al cambiar el ciclo del colegio las horas de la asignación se duplican o se dividen', () => {
    const e = { ...dos(), grupos: [grp('a', 7), grp('b', 8, { ciclo: 5 })] }
    const diez = cambiarCicloColegio(e, 10)
    expect(diez.colegio.ciclo).toBe(10)
    expect(diez.asignaciones.map((a) => a.horas)).toEqual([4, 1, 2]) // 8-1 tiene ciclo propio y no cambia
    expect(cambiarCicloColegio(diez, 5).asignaciones.map((a) => a.horas)).toEqual([2, 1, 1])
    expect(cambiarCicloColegio(e, 5)).toBe(e)
  })
  it('al cambiar el ciclo de un grupo solo cambian sus horas', () => {
    const e = cambiarCicloGrupo(dos(), 'a', 10)
    expect(e.grupos[0].ciclo).toBe(10)
    expect(e.asignaciones.map((a) => a.horas)).toEqual([4, 1, 2])
    expect(cambiarCicloGrupo(e, 'a', undefined).asignaciones.map((a) => a.horas)).toEqual([2, 1, 1])
  })
  it('al regenerar se quitan reemplazos y cambios desde hoy, y se conserva lo pasado', () => {
    const dia = (fecha: string) => ({
      fecha, diaCiclo: 2, ausencias: [{ docenteId: 'd', franjas: [1] }],
      reemplazos: [{ claseId: 'mb', docenteId: 'x' }], movimientos: [{ claseId: 'l1', franja: 2 }], gruposAusentes: ['a'],
    })
    const e = quitarAjustesFuturos({ ...dos(), ajustes: [dia('2026-11-03'), dia('2026-11-10'), dia('2026-11-17')] }, '2026-11-10')
    expect(e.ajustes[0]).toEqual(dia('2026-11-03'))
    for (const aj of e.ajustes.slice(1)) expect(aj).toMatchObject({ ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [], movimientos: [], gruposAusentes: ['a'] })
  })
})

describe('ajustes guardados que dejan de valer', () => {
  it('al pasar de ciclo 10 a 5 se quitan los días de incapacidad de los días 6 a 10', () => {
    const dia = (fecha: string, diaCiclo: number) => ({ fecha, diaCiclo, ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [], movimientos: [], gruposAusentes: [] })
    const e = sincronizarClases({ ...dos(), ajustes: [dia('2026-11-10', 2), dia('2026-11-12', 8)] })
    expect(e.ajustes.map((a) => a.diaCiclo)).toEqual([2])
  })
  it('al sincronizar se quitan ausencias y reemplazos de docentes y grupos que ya no existen', () => {
    const e = sincronizarClases({
      ...dos(),
      ajustes: [{ fecha: '2026-11-10', diaCiclo: 2, ausencias: [{ docenteId: 'borrado', franjas: [1] }, { docenteId: 'd', franjas: [1] }], reemplazos: [{ claseId: 'mb', docenteId: 'borrado' }], movimientos: [], gruposAusentes: ['borrado', 'a'] }],
    })
    expect(e.ajustes[0]).toMatchObject({ ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [], gruposAusentes: ['a'] })
  })
})

describe('sincronizar clases con la asignación', () => {
  it('quita las clases sobrantes al bajar las horas, primero las no fijadas', () => {
    const e = dos()
    e.clases[1].fijada = true
    e.asignaciones[0].horas = 1
    expect(sincronizarClases(e).clases.map((c) => c.id)).toEqual(['m2', 'mb', 'l1'])
  })
  it('las horas que faltan por ubicar aparecen como cruce', () => {
    const e = dos()
    e.asignaciones[0].horas = 3
    expect(detectarCruces(sincronizarClases(e)).some((c) => c.tipo === 'sinUbicar')).toBe(true)
  })
  it('al pasar de ciclo 10 a 5 descarta clases y disponibilidad de los días 6 a 10', () => {
    const e = dos()
    e.clases[0].dia = 8
    e.docentes[0].noDisponible = ['2-1', '7-1']
    const r = sincronizarClases(e)
    expect(r.clases.map((c) => c.id)).toEqual(['m2', 'mb', 'l1'])
    expect(r.docentes[0].noDisponible).toEqual(['2-1'])
  })
})

describe('intensidad desde la asignación y unir áreas', () => {
  const colegio = () =>
    mini({
      intensidad: { 7: { mat: 5 } },
      grupos: [grp('a', 7), grp('b', 7, { numero: 2 }), grp('c', 8)],
      docentes: [doc('d', { cargaSemanal: 12 }), doc('x', { cargaSemanal: 6, areaId: 'len' })],
      asignaciones: [asg('d', 'a', 'mat', 5), asg('d', 'a', 'tec', 2), asg('d', 'b', 'tec', 2), asg('x', 'c', 'len', 4), asg('x', 'b', 'len', 3), asg('d', 'c', 'mat', 3)],
    })
  it('propone la intensidad de cada grado con las horas asignadas, sin tocar la que ya hay', () => {
    const r = intensidadDesdeAsignacion(colegio())
    expect(r.cambios).toEqual([
      { grado: 7, areaId: 'tec', antes: 0, despues: 2 },
      { grado: 7, areaId: 'len', antes: 0, despues: 3 },
      { grado: 8, areaId: 'len', antes: 0, despues: 4 },
      { grado: 8, areaId: 'mat', antes: 0, despues: 3 },
    ])
    expect(r.estado.intensidad[7]).toEqual({ mat: 5, tec: 2, len: 3 })
  })
  it('si los grupos de un grado tienen horas distintas, toma la más repetida y lo avisa', () => {
    const e = colegio()
    e.asignaciones.push(asg('x', 'a', 'len', 4))
    e.grupos.push(grp('z', 7, { numero: 3 }))
    e.asignaciones.push(asg('x', 'z', 'len', 4))
    const r = intensidadDesdeAsignacion(e)
    expect(r.cambios.find((c) => c.grado === 7 && c.areaId === 'len')).toEqual({ grado: 7, areaId: 'len', antes: 0, despues: 4 })
    expect(r.distintas).toEqual(['Lengua Castellana en 7.°: 7-1 tiene 4, 7-2 tiene 3, 7-3 tiene 4'])
  })
  it('con «también las que ya tienen intensidad» reemplaza las que no coinciden', () => {
    const e = colegio()
    e.asignaciones = e.asignaciones.map((a) => (a.id === 'd|a|mat' ? { ...a, horas: 4 } : a))
    expect(intensidadDesdeAsignacion(e).cambios.some((c) => c.areaId === 'mat' && c.grado === 7)).toBe(false)
    expect(intensidadDesdeAsignacion(e, true).cambios).toContainEqual({ grado: 7, areaId: 'mat', antes: 5, despues: 4 })
  })
  it('unir un área con otra pasa sus horas, su intensidad, sus docentes y sus clases a la otra', () => {
    const e = { ...colegio(), intensidad: { 7: { mat: 3, tec: 2 } }, clases: [cls('d|a|tec', 1, 1, { id: 'ct' }), cls('d|a|mat', 1, 2, { id: 'cm' })] }
    e.docentes.push(doc('t', { areaId: 'tec', cargaSemanal: 1 }))
    e.areas = e.areas.map((a) => (a.id === 'len' ? { ...a, afines: ['ing', 'tec'] } : a))
    const r = unirAreas(e, 'tec', 'mat')
    expect(r.areas.some((a) => a.id === 'tec' || a.afines.includes('tec'))).toBe(false)
    expect(r.intensidad[7]).toEqual({ mat: 5 })
    expect(r.asignaciones.filter((a) => a.grupoId === 'a' && a.docenteId === 'd')).toEqual([{ ...asg('d', 'a', 'mat', 7) }])
    expect(r.clases.map((c) => c.asignacionId)).toEqual(['d|a|mat', 'd|a|mat'])
    expect(r.docentes.find((d) => d.id === 't')!.areaId).toBe('mat')
  })
})

describe('docentes repetidos', () => {
  // Como quedó la versión importada: el docente con las clases se llama como en el PDF y el del colegio quedó en 0.
  const repetido = () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)],
      docentes: [doc('pdf', { nombre: 'Sonia P. (apellido pendiente)', cargaSemanal: 22 }), doc('real', { nombre: 'Sonia Pineda', cargaSemanal: 8, noDisponible: ['1-1'] }), doc('otro', { nombre: 'Sanny' })],
      asignaciones: [asg('pdf', 'a', 'mat', 4), asg('pdf', 'b', 'mat', 4), asg('real', 'b', 'mat', 1)],
      clases: [cls('pdf|a|mat', 1, 2, { id: 'c1' }), cls('pdf|b|mat', 2, 1, { id: 'c2' }), cls('real|b|mat', 3, 1, { id: 'c3' })],
    })
    e.ajustes = [{ fecha: '2026-11-20', diaCiclo: 1, ausencias: [{ docenteId: 'pdf', franjas: [2] }], reemplazos: [{ claseId: 'c1', docenteId: 'otro' }], movimientos: [], gruposAusentes: [] }]
    return e
  }
  it('unir pasa las horas, las clases y las ausencias al docente que queda, con su nombre, carga y disponibilidad', () => {
    const r = unirDocentes(repetido(), 'pdf', 'real')
    expect(r.docentes.map((d) => d.nombre)).toEqual(['Sonia Pineda', 'Sanny'])
    expect(r.docentes[0]).toMatchObject({ cargaSemanal: 8, noDisponible: ['1-1'] })
    expect(r.asignaciones.map((a) => [a.docenteId, a.grupoId, a.horas])).toEqual([['real', 'a', 4], ['real', 'b', 5]])
    expect(r.clases.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3'])
    expect(r.ajustes[0].ausencias[0].docenteId).toBe('real')
  })
  it('detecta nombres parecidos cuando uno de los dos no tiene horas, y propone pasar las horas al del colegio', () => {
    const e = repetido()
    e.asignaciones = e.asignaciones.filter((a) => a.docenteId !== 'real')
    e.clases = e.clases.filter((c) => c.id !== 'c3')
    expect(docentesRepetidos(e).map((p) => [p.origen.id, p.destino.id])).toEqual([['pdf', 'real']])
    // Si los dos tienen horas son dos personas distintas: no se propone nada.
    expect(docentesRepetidos(repetido())).toEqual([])
    // Los de tu colegio: Yesenia/Yessenia y Odilia se detectan; Sanny y Sonia no se confunden.
    const nombres = mini({
      grupos: [grp('a', 7)],
      docentes: [['k1', 'M.ª Yesenia (apellido'], ['k2', 'Yessenia'], ['a1', 'Odilia (apellido pendiente)'], ['a2', 'Odilia'], ['dy', 'Sanny'], ['di', 'Sonia Pineda']].map(([id, nombre]) => doc(id, { nombre })),
      asignaciones: [asg('k1', 'a', 'mat', 2), asg('a1', 'a', 'tec', 2), asg('dy', 'a', 'soc', 2)],
    })
    expect(docentesRepetidos(nombres).map((p) => [p.origen.id, p.destino.id])).toEqual([['a1', 'a2'], ['k1', 'k2']])
  })
})

describe('mover clases con dos jornadas', () => {
  it('mover una clase de media técnica (tarde) no intercambia con la clase de la mañana del grupo', () => {
    const e = mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'mt', nombre: 'Media técnica', afines: [] }],
      grupos: [grp('a', 10)],
      docentes: [doc('d'), doc('t', { jornada: 'tarde', areaId: 'mt' })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('t', 'a', 'mt', 1)],
      clases: [cls('d|a|mat', 1, 3, { id: 'manana' }), cls('t|a|mt', 2, 1, { id: 'tarde' })],
    })
    const r = moverClase(e, 'tarde', 1, 3)
    expect(r.clases.find((c) => c.id === 'tarde')).toMatchObject({ dia: 1, franja: 3 })
    expect(r.clases.find((c) => c.id === 'manana')).toMatchObject({ dia: 1, franja: 3 })
  })
})
