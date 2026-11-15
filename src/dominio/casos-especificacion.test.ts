// Los 12 casos de prueba de la especificación, uno por uno y con su mismo texto.
import { describe, expect, it } from 'vitest'
import { validarAsignacion } from './asignacion'
import { asg, cls, doc, grp, mini } from './ayudaPruebas'
import { detectarCruces, sesiones } from './cruces'
import { diagnosticar } from './diagnostico'
import { moverClase } from './edicion'
import { colegioEjemplo } from './ejemplo'
import { generarHorario } from './generador'
import { ajusteVacio, candidatosReemplazo, clasesSinDocente, opcionesReorganizar, puedeFaltarGrupo } from './reemplazos'
import { cargaEnCiclo, diasVecinos, FRANJAS } from './tiempo'
import type { AjusteDia, Clase, Estado } from './tipos'

const seis = [1, 2, 3, 4, 5, 6]
const avisosDe = (e: Estado, docenteId: string) => validarAsignacion(e).filter((a) => a.docenteId === docenteId).map((a) => a.tipo)
const ausencia = (docenteId: string, franjas: number[], diaCiclo = 2): AjusteDia => ({
  ...ajusteVacio('2026-11-10', diaCiclo), ausencias: [{ docenteId, franjas }],
})

describe('casos de prueba de la especificación', () => {
  it('1. Docente de Lengua Castellana con 22 horas: 12 en su área y 10 en Inglés (afín) → se acepta', () => {
    const e = mini({
      grupos: [grp('g', 7)], docentes: [doc('d', { areaId: 'len' })],
      asignaciones: [asg('d', 'g', 'len', 12), asg('d', 'g', 'ing', 10)],
    })
    expect(avisosDe(e, 'd')).toEqual([])
  })

  it('2. Docente con 8 horas en su área y el resto en área afín → se rechaza: menos de 12 horas en su área', () => {
    const e = mini({
      grupos: [grp('g', 7)], docentes: [doc('d', { areaId: 'len' })],
      asignaciones: [asg('d', 'g', 'len', 8), asg('d', 'g', 'ing', 14)],
    })
    expect(avisosDe(e, 'd')).toEqual(['minimoArea'])
  })

  it('3. Docente titular de primaria con 4 horas diarias con su grupo → se acepta', () => {
    const e = mini({
      grupos: [grp('p', 3)],
      docentes: [doc('t', { nivel: 'primaria', rolPrimaria: 'titular', direccionGrupoId: 'p', cargaSemanal: 20 })],
      asignaciones: [asg('t', 'p', 'mat', 10), asg('t', 'p', 'len', 10)],
      clases: [1, 2, 3, 4, 5].flatMap((dia) => [cls('t|p|mat', dia, 1), cls('t|p|mat', dia, 2), cls('t|p|len', dia, 3), cls('t|p|len', dia, 4)]),
    })
    expect(detectarCruces(e)).toEqual([])
  })

  it('4. Grupo de bachillerato con 3 horas de Matemáticas el mismo día → se avisa: máximo 2 horas de la misma materia por día', () => {
    const e = mini({
      grupos: [grp('a', 8)], docentes: [doc('d', { cargaSemanal: 3 }), doc('x', { cargaSemanal: 0 })],
      asignaciones: [asg('d', 'a', 'mat', 2), asg('x', 'a', 'mat', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|a|mat', 1, 2), cls('x|a|mat', 1, 3)],
    })
    e.docentes[0].cargaSemanal = 2
    e.docentes[1].cargaSemanal = 1
    expect(detectarCruces(e).map((c) => c.tipo)).toEqual(['maxMateria'])
  })

  it('5. Docente con 6 clases el martes y el lunes y el miércoles llenos → se rechaza: falta una franja libre', () => {
    const clases: Clase[] = [1, 2, 3].flatMap((dia) => seis.map((f) => cls(f % 2 ? 'd|a|mat' : 'd|b|mat', dia, f)))
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d', { cargaSemanal: 18 })],
      asignaciones: [asg('d', 'a', 'mat', 9), asg('d', 'b', 'mat', 9)], clases,
    })
    e.colegio.reglas.maxMateriaDia.activa = e.colegio.reglas.maxDocenteDia.activa = false
    const cruces = detectarCruces(e)
    expect(cruces.every((c) => c.tipo === 'horaLibre')).toBe(true)
    expect(cruces.map((c) => c.dia)).toContain(2)
  })

  it('6. Docente que entra desde la 3.ª franja → sin clase en las franjas 1 y 2, ni en el horario base ni en reemplazos', () => {
    const tarde = [1, 2, 3, 4, 5].flatMap((d) => [`${d}-1`, `${d}-2`])
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)],
      docentes: [doc('d', { cargaSemanal: 10, noDisponible: tarde }), doc('x', { cargaSemanal: 10, areaId: 'len' })],
      asignaciones: [asg('d', 'a', 'mat', 5), asg('d', 'b', 'mat', 5), asg('x', 'a', 'len', 5), asg('x', 'b', 'len', 5)],
    })
    const r = generarHorario(e, { semilla: 1 })
    expect(r.completo).toBe(true)
    expect(r.clases.filter((c) => c.asignacionId.startsWith('d|') && c.franja <= 2)).toEqual([])
    // x falta todo el martes: d no se propone para las clases de las franjas 1 y 2.
    const conHorario = { ...e, clases: [...r.clases, cls('x|a|len', 2, 1, { id: 'temprano' })] }
    expect(candidatosReemplazo(conHorario, ausencia('x', seis), 'temprano').map((c) => c.docenteId)).not.toContain('d')
  })

  it('7. Ciclo de 10 días → carga de 44 horas en bachillerato y 50 en primaria', () => {
    expect(cargaEnCiclo(doc('b'), 10)).toBe(44)
    expect(cargaEnCiclo(doc('p', { cargaSemanal: 25 }), 10)).toBe(50)
    const e = mini({
      colegio: { ...mini().colegio, ciclo: 10 },
      grupos: [grp('a', 7), grp('p', 3)],
      docentes: [doc('b'), doc('t', { nivel: 'primaria', rolPrimaria: 'titular', cargaSemanal: 25 })],
      asignaciones: [asg('b', 'a', 'mat', 44), asg('t', 'p', 'len', 50)],
    })
    expect(avisosDe(e, 'b')).toEqual([])
    expect(avisosDe(e, 't')).toEqual([])
  })

  it('8. Docente falta el martes en las franjas 1, 3 y 5 → reemplazos con 2 o más franjas libres ese día y una en el día anterior o siguiente', () => {
    const base = colegioEjemplo()
    const e = { ...base, clases: generarHorario(base, { semilla: 1 }).clases }
    const todas = sesiones(e)
    const delMartes = (id: string) => todas.filter((s) => s.docenteId === id && s.dia === 2)
    const falta = e.docentes.find((d) => delMartes(d.id).filter((s) => [1, 3, 5].includes(s.franja)).length === 3)!
    const aj = ausencia(falta.id, [1, 3, 5])
    const sin = clasesSinDocente(e, aj)
    expect(sin.map((s) => s.franja).sort()).toEqual([1, 3, 5])
    const candidatos = sin.flatMap((s) => candidatosReemplazo(e, aj, s.claseId).map((c) => ({ ...c, franja: s.franja })))
    expect(candidatos.length).toBeGreaterThan(0)
    for (const c of candidatos) {
      const ocupadas = delMartes(c.docenteId).map((s) => s.franja)
      expect(ocupadas).not.toContain(c.franja)
      expect(FRANJAS - ocupadas.length).toBeGreaterThanOrEqual(2)
      const libreVecino = diasVecinos(2, 5).some((v) => todas.filter((s) => s.docenteId === c.docenteId && s.dia === v).length < FRANJAS)
      expect(libreVecino).toBe(true)
    }
  })

  it('9. Docente falta en las franjas 1 y 2 y no hay reemplazo → propone mover clases de otros docentes para que el grupo llegue tarde', () => {
    // Martes: d dicta a 7-1 en la franja 1 y a 8-1 en la 2. Nadie puede reemplazarlo:
    // y entra a la 2.ª franja y a esa hora ya tiene clase; z tiene el lunes y el miércoles llenos.
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8), grp('c', 9)],
      docentes: [doc('d'), doc('y', { areaId: 'len', noDisponible: ['2-1'] }), doc('z', { areaId: 'len' })],
      asignaciones: [
        asg('d', 'a', 'mat', 30), asg('d', 'b', 'mat', 30), asg('y', 'a', 'len', 30), asg('y', 'b', 'len', 30),
        asg('z', 'a', 'ing', 30), asg('z', 'b', 'ing', 30), asg('z', 'c', 'ing', 30),
      ],
      clases: [
        cls('d|a|mat', 2, 1, { id: 'da1' }), cls('y|a|len', 2, 2, { id: 'ya2' }), cls('z|a|ing', 2, 3), cls('y|a|len', 2, 4),
        cls('z|b|ing', 2, 1, { id: 'zb1' }), cls('d|b|mat', 2, 2, { id: 'db2' }), cls('y|b|len', 2, 3), cls('z|b|ing', 2, 4),
        ...seis.flatMap((f) => [cls('z|c|ing', 1, f), cls('z|c|ing', 3, f)]),
      ],
    })
    const aj = ausencia('d', [1, 2])
    expect(clasesSinDocente(e, aj).map((s) => s.claseId).sort()).toEqual(['da1', 'db2'])
    expect(candidatosReemplazo(e, aj, 'da1')).toEqual([])
    expect(candidatosReemplazo(e, aj, 'db2')).toEqual([])
    const opcion = opcionesReorganizar(e, aj, 'b').find((o) => o.tipo === 'llegaTarde')!
    expect(opcion.movimientos).toEqual(expect.arrayContaining([{ claseId: 'zb1', franja: 2 }, { claseId: 'db2', franja: 1 }]))
    expect(opcion.docentesQueCambian).toEqual(['z'])
  })

  it('10. Falta el titular de primaria todo el día → ofrece reemplazos o marcar que falta todo el grupo', () => {
    const e = mini({
      grupos: [grp('p', 3), grp('q', 4)],
      docentes: [
        doc('t', { nivel: 'primaria', rolPrimaria: 'titular', direccionGrupoId: 'p', cargaSemanal: 25 }),
        doc('s', { nivel: 'primaria', rolPrimaria: 'especialista', areaId: 'ing', cargaSemanal: 25 }),
      ],
      asignaciones: [asg('t', 'p', 'len', 30), asg('s', 'q', 'ing', 30)],
      clases: [...seis.map((f) => cls('t|p|len', 2, f, { id: `tp${f}` })), cls('s|q|ing', 2, 1)],
    })
    const aj = ausencia('t', seis)
    expect(clasesSinDocente(e, aj)).toHaveLength(6)
    expect(candidatosReemplazo(e, aj, 'tp3').map((c) => c.docenteId)).toEqual(['s'])
    expect(puedeFaltarGrupo(e, 'p')).toBe(true)
    expect(clasesSinDocente(e, { ...aj, gruposAusentes: ['p'] })).toEqual([])
  })

  it('11. Edición manual que choca con otra clase del mismo docente → guarda y muestra el cruce en la lista de pendientes', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8)], docentes: [doc('d', { cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1)],
      clases: [cls('d|a|mat', 1, 1, { id: 'una' }), cls('d|b|mat', 3, 4, { id: 'otra' })],
    })
    expect(detectarCruces(e)).toEqual([])
    const editado = moverClase(e, 'una', 3, 4)
    expect(editado.clases.find((c) => c.id === 'una')).toMatchObject({ dia: 3, franja: 4 })
    const cruces = detectarCruces(editado)
    expect(cruces).toHaveLength(1)
    expect(cruces[0]).toMatchObject({ tipo: 'docente', docenteId: 'd', dia: 3, franja: 4 })
  })

  it('12. Asignación que no cabe en el horario → explica qué regla bloquea y propone soluciones, sin relajar nada por sí sola', () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 14 })],
      asignaciones: [asg('d', 'a', 'mat', 14)],
    })
    e.colegio.reglas.maxDocenteDia.activa = false
    const antes = JSON.stringify(e)
    const r = generarHorario(e, { semilla: 1, tiempoMs: 300 })
    expect(r.completo).toBe(false)
    const { bloqueos, propuestas } = diagnosticar(e, r)
    expect(bloqueos[0].mensaje).toMatch(/14 horas de Matemáticas.*máximo 2 por día/)
    expect(propuestas.map((p) => p.tipo)).toContain('relajarRegla')
    expect(JSON.stringify(e)).toBe(antes)
    // El usuario elige la propuesta; solo entonces cambia la regla y se recalcula.
    const elegido = propuestas.find((p) => p.resuelve)!.aplicar(e)
    expect(elegido.colegio.reglas.maxMateriaDia.valor).toBe(3)
    expect(generarHorario(elegido, { semilla: 1 }).completo).toBe(true)
  })
})
