import { describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { abrirBorrador, borrarBorrador, nombreHorario, nuevoBorrador, renombrarHorario, resumenVersion } from './borradores'
import { cambiarCicloColegio, eliminarDocente, unirAreas } from './edicion'

const base = () =>
  mini({
    grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 4 }), doc('x', { cargaSemanal: 4, areaId: 'len' })],
    asignaciones: [asg('d', 'a', 'mat', 4), asg('x', 'a', 'len', 4)],
    clases: [cls('d|a|mat', 1, 1, { id: 'm1' }), cls('x|a|len', 1, 2, { id: 'l1' })],
  })

describe('versiones del horario', () => {
  it('una versión nueva guarda una copia completa de la que está en uso y sigue con otra igual', () => {
    const e = nuevoBorrador(base(), 'Con Luis en matemáticas', '2026-11-12T10:00')
    expect(nombreHorario(e)).toBe('Con Luis en matemáticas')
    const [v] = e.borradores!
    expect(v).toMatchObject({ nombre: 'Horario principal', guardado: '2026-11-12T10:00' })
    expect(v.estado.docentes).toEqual(base().docentes)
    expect(v.estado.aulas).toEqual(base().aulas)
    expect(v.estado.asignaciones).toEqual(base().asignaciones)
    expect(v.estado.clases).toEqual(base().clases)
    expect(v.estado.borradores).toBeUndefined()
  })
  it('cambiar docentes, aulas o reglas en una versión no toca las demás', () => {
    let e = nuevoBorrador(base(), 'B')
    e = { ...e, docentes: e.docentes.map((d) => ({ ...d, noDisponible: ['1-1'] })), aulas: [], colegio: { ...e.colegio, modeloAula: 'ninguna' } }
    e = eliminarDocente(e, 'x')
    e = unirAreas(cambiarCicloColegio(e, 10), 'len', 'mat')
    const [v] = e.borradores!
    expect(v.estado.docentes).toEqual(base().docentes)
    expect(v.estado.aulas).toEqual(base().aulas)
    expect(v.estado.colegio).toEqual(base().colegio)
    expect(v.estado.asignaciones).toEqual(base().asignaciones)
  })
  it('abrir una versión la pone en uso completa y deja guardada en su lugar la que estaba', () => {
    const e = nuevoBorrador(base(), 'Prueba', 't1')
    const cambiada = { ...e, docentes: [doc('d', { nombre: 'Otra' })], asignaciones: [asg('d', 'a', 'mat', 4)], clases: [] }
    const id = cambiada.borradores![0].id
    const abierto = abrirBorrador(cambiada, id, '2026-11-12', 't2')
    expect(nombreHorario(abierto)).toBe('Horario principal')
    expect(abierto.docentes).toEqual(base().docentes)
    expect(abierto.asignaciones).toEqual(base().asignaciones)
    expect(abierto.clases.map((c) => c.id)).toEqual(['m1', 'l1'])
    const [guardada] = abierto.borradores!
    expect(guardada).toMatchObject({ id, nombre: 'Prueba', guardado: 't2' })
    expect(guardada.estado.docentes.map((d) => d.nombre)).toEqual(['Otra'])
  })
  it('el nombre del colegio y las incapacidades son los mismos en todas las versiones', () => {
    const e = { ...nuevoBorrador(base(), 'B'), colegio: { ...base().colegio, nombre: 'Colegio Nuevo Nombre' } }
    const conAusencia = { ...e, ajustes: [{ fecha: '2026-11-10', diaCiclo: 1, ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [], movimientos: [], gruposAusentes: [] }] }
    const abierto = abrirBorrador(conAusencia, e.borradores![0].id, '2026-11-12')
    expect(abierto.colegio.nombre).toBe('Colegio Nuevo Nombre')
    expect(abierto.ajustes).toHaveLength(1)
  })
  it('al abrir una versión se quitan los reemplazos guardados de hoy en adelante, porque las clases cambian', () => {
    const e = { ...nuevoBorrador(base(), 'Prueba'), ajustes: [
      { fecha: '2026-11-10', diaCiclo: 1, ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [{ claseId: 'm1', docenteId: 'x' }], movimientos: [], gruposAusentes: [] },
      { fecha: '2026-11-13', diaCiclo: 1, ausencias: [{ docenteId: 'd', franjas: [1] }], reemplazos: [{ claseId: 'm1', docenteId: 'x' }], movimientos: [], gruposAusentes: [] },
    ] }
    const abierto = abrirBorrador(e, e.borradores![0].id, '2026-11-12')
    expect(abierto.ajustes.map((a) => a.reemplazos.length)).toEqual([1, 0])
    expect(abierto.ajustes.map((a) => a.ausencias.length)).toEqual([1, 1])
  })
  it('renombrar la versión en uso o una guardada, y borrar una guardada', () => {
    let e = nuevoBorrador(base(), 'B')
    const id = e.borradores![0].id
    e = renombrarHorario(renombrarHorario(e, null, 'Opción B'), id, 'Opción A')
    expect(nombreHorario(e)).toBe('Opción B')
    expect(e.borradores![0].nombre).toBe('Opción A')
    expect(borrarBorrador(e, id).borradores).toEqual([])
  })
  it('el resumen de una versión cuenta grupos, docentes, horas, clases y cruces', () => {
    expect(resumenVersion(base())).toEqual({ grupos: 1, docentes: 2, horas: 8, clases: 2, cruces: 4 })
  })
})
