import { describe, expect, it } from 'vitest'
import { repartirAcompanamiento } from './acompanamiento'
import { detectarCruces } from './cruces'
import { eliminarArea } from './edicion'
import { asignarMediaTecnica, elegirPrograma, grupoMezcladoNuevo, horasPrograma, quitarMediaTecnica } from './mediaTecnica'
import { horasRequeridas, horasSinAsignar, validarAsignacion } from './asignacion'
import { asg, doc, grp, mini } from './ayudaPruebas'
import { jornadaDeAsignacion, nombreGrupo, tieneMediaTecnica } from './tiempo'
import type { Estado } from './tipos'

/** 10-1 y 10-2 en la mañana; el programa «Sistemas» tiene 6 horas en 10.°. */
const colegio = (p: Partial<Estado> = {}): Estado => {
  const e = mini({
    areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'sis', nombre: 'Sistemas', afines: [], mediaTecnica: true }],
    intensidad: { 10: { mat: 4, sis: 6 } },
    grupos: [grp('a', 10), grp('b', 10, { numero: 2 })],
    ...p,
  })
  e.colegio.mediaTecnica = true
  return e
}

describe('media técnica como programa aparte del plan de estudios', () => {
  it('un grupo que no ve media técnica no tiene horas pendientes del programa', () => {
    const e = colegio()
    expect(horasRequeridas(e, e.grupos[0], 'sis')).toBe(0)
    expect(horasSinAsignar(e).filter((p) => p.areaId === 'sis')).toEqual([])
  })

  it('el grupo completo que ve un programa sí lo pide', () => {
    const e = colegio()
    e.grupos[0].programaMT = 'sis'
    expect(horasRequeridas(e, e.grupos[0], 'sis')).toBe(6)
    expect(horasRequeridas(e, e.grupos[1], 'sis')).toBe(0)
  })

  it('un grupo mezclado (estudiantes de 10-1 y 10-2) solo pide su programa, con su nombre y en su propia jornada', () => {
    const e = colegio()
    e.grupos.push(grp('m', 10, { numero: 0, nombre: '10.° Sistemas', jornada: 'tarde', programaMT: 'sis', de: ['a', 'b'] }))
    const m = e.grupos[2]
    expect(nombreGrupo(m)).toBe('10.° Sistemas')
    expect(horasRequeridas(e, m, 'sis')).toBe(6)
    expect(horasRequeridas(e, m, 'mat')).toBe(0)
    expect(jornadaDeAsignacion(e, { grupoId: 'm', areaId: 'sis' })).toBe('tarde')
  })

  it('un instructor externo no tiene avisos de carga ni de área; un docente de planta dicta el programa sin aviso de área', () => {
    const e = colegio({
      docentes: [doc('ext', { nombre: 'Instructor', areaId: 'sis', externo: true, jornada: 'tarde', cargaSemanal: 0 }), doc('pla', { nombre: 'Planta', jornada: 'ambas', cargaSemanal: 6 })],
    })
    e.grupos[0].programaMT = 'sis'
    e.grupos[1].programaMT = 'sis'
    e.asignaciones = [asg('ext', 'a', 'sis', 6), asg('pla', 'b', 'sis', 6)]
    const avisos = validarAsignacion(e).filter((a) => a.docenteId)
    expect(avisos.filter((a) => a.docenteId === 'ext')).toEqual([])
    expect(avisos.filter((a) => a.tipo === 'areaNoAfin')).toEqual([])
  })

  it('los instructores externos no acompañan descansos', () => {
    const e = colegio({ docentes: [doc('ext', { nombre: 'Instructor', externo: true }), doc('pla', { nombre: 'Planta' })] })
    e.asignaciones = [asg('ext', 'a', 'mat', 4), asg('pla', 'b', 'mat', 4)]
    e.clases = [1, 2, 3, 4].flatMap((d) => [{ id: `x${d}`, asignacionId: 'ext|a|mat', dia: d, franja: 3, fijada: false }, { id: `y${d}`, asignacionId: 'pla|b|mat', dia: d, franja: 3, fijada: false }])
    e.acompanamiento = { zonas: [{ id: 'z', nombre: 'Patio', personas: 1, descansos: [1], jornada: 'manana' }], turnos: [] }
    const turnos = repartirAcompanamiento(e).acompanamiento!.turnos
    expect(turnos.flatMap((t) => t.docenteIds)).not.toContain('ext')
  })

  it('el colegio tiene media técnica si la activó o si ya tiene programas', () => {
    const e = colegio()
    expect(tieneMediaTecnica(e)).toBe(true)
    e.colegio.mediaTecnica = false
    expect(tieneMediaTecnica(e)).toBe(false)
    delete e.colegio.mediaTecnica
    expect(tieneMediaTecnica(e)).toBe(true)
    expect(tieneMediaTecnica(mini())).toBe(false)
  })
})

describe('armar la media técnica', () => {
  it('asignar un docente de planta de la mañana lo deja en mañana y tarde, con las horas del programa', () => {
    const e = colegio({ docentes: [doc('pla', { nombre: 'Planta' })] })
    const r = asignarMediaTecnica(elegirPrograma(e, 'a', 'sis'), 'a', 'pla')
    expect(r.asignaciones).toEqual([expect.objectContaining({ docenteId: 'pla', grupoId: 'a', areaId: 'sis', horas: 6 })])
    expect(r.docentes[0].jornada).toBe('ambas')
    expect(asignarMediaTecnica(r, 'a', '').asignaciones).toEqual([])
  })

  it('cambiar el programa de un grupo quita lo asignado del programa anterior', () => {
    const e = colegio({ docentes: [doc('pla', { jornada: 'ambas' })] })
    const r = asignarMediaTecnica(elegirPrograma(e, 'a', 'sis'), 'a', 'pla')
    const sin = elegirPrograma(r, 'a', '')
    expect(sin.grupos[0].programaMT).toBeUndefined()
    expect(sin.asignaciones).toEqual([])
  })

  it('un grupo mezclado nuevo va en la jornada contraria, con el aula del primer grupo y el nombre del programa', () => {
    const g = grupoMezcladoNuevo(colegio(), 'sis', 10)
    expect(g).toMatchObject({ grado: 10, jornada: 'tarde', nombre: '10.° Sistemas', programaMT: 'sis', de: [], aulaId: 'aula-a' })
  })

  it('borrar un programa borra sus grupos mezclados y lo quita de los grupos que lo veían', () => {
    const e = colegio()
    e.grupos[0].programaMT = 'sis'
    e.grupos.push(grupoMezcladoNuevo(e, 'sis', 10))
    const r = eliminarArea(e, 'sis')
    expect(r.grupos.map((g) => g.id)).toEqual(['a', 'b'])
    expect(r.grupos[0].programaMT).toBeUndefined()
  })

  it('quitar la media técnica del colegio borra todos los programas', () => {
    const r = quitarMediaTecnica(colegio())
    expect(r.areas.map((a) => a.id)).toEqual(['mat'])
    expect(tieneMediaTecnica(r)).toBe(false)
  })
})

describe('horas de un programa', () => {
  it('cambiar las horas del programa en un grado actualiza lo asignado a sus grupos', () => {
    const e = colegio({ docentes: [doc('pla', { jornada: 'ambas' })] })
    const r = horasPrograma(asignarMediaTecnica(elegirPrograma(e, 'a', 'sis'), 'a', 'pla'), 'sis', 10, 8)
    expect(r.intensidad[10].sis).toBe(8)
    expect(r.asignaciones[0].horas).toBe(8)
  })
})

describe('cruces con instructores externos', () => {
  it('un instructor externo no tiene cruce de carga, ni de hora libre ni de carga pareja', () => {
    const e = colegio({ docentes: [doc('ext', { nombre: 'Instructor', areaId: 'sis', externo: true, jornada: 'ambas', cargaSemanal: 0 })] })
    e.grupos[0].programaMT = 'sis'
    e.asignaciones = [asg('ext', 'a', 'sis', 6)]
    e.clases = [1, 2, 3, 4, 5, 6].map((f) => ({ id: `c${f}`, asignacionId: 'ext|a|sis', dia: 1, franja: f, fijada: false }))
    e.colegio.reglas.libreDiaria = { activa: true }
    e.colegio.reglas.cargaPareja = { activa: true }
    expect(detectarCruces(e).filter((c) => c.docenteId === 'ext')).toEqual([])
  })
})
