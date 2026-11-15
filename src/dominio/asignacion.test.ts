import { describe, expect, it } from 'vitest'
import { esMediaTecnica, horasDocente, horasSemanaGrupo, horasSinAsignar, sugerirParaDocente, validarAsignacion } from './asignacion'
import { asg, doc, grp, mini } from './ayudaPruebas'
import { areasIniciales, colegioEjemplo, intensidadInicial } from './ejemplo'

const tipos = (e: ReturnType<typeof mini>, docenteId?: string) =>
  validarAsignacion(e).filter((a) => !docenteId || a.docenteId === docenteId).map((a) => a.tipo)

describe('precargas y colegio de ejemplo', () => {
  it('la intensidad inicial suma 25 horas en primaria y 30 en bachillerato', () => {
    const intensidad = intensidadInicial(areasIniciales())
    for (let grado = 1; grado <= 11; grado++) {
      const suma = Object.values(intensidad[grado]).reduce((a, b) => a + b, 0)
      expect(suma, `grado ${grado}`).toBe(grado <= 5 ? 25 : 30)
    }
  })
  it('el colegio de ejemplo tiene una asignación sin errores', () => {
    const e = colegioEjemplo()
    expect(e.docentes.length).toBeGreaterThan(10)
    expect(validarAsignacion(e).filter((a) => a.gravedad === 'error')).toEqual([])
  })
  it('el colegio de ejemplo tiene un docente con disponibilidad restringida', () => {
    expect(colegioEjemplo().docentes.some((d) => d.noDisponible.length > 0)).toBe(true)
  })
})

describe('validación de la asignación', () => {
  const g = grp('g', 7)
  it('avisa carga distinta a la asignada', () => {
    const e = mini({ grupos: [g], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 21)] })
    expect(tipos(e, 'd')).toContain('carga')
  })
  it('acepta 12 horas en el área y 10 en un área afín', () => {
    const e = mini({
      grupos: [g], docentes: [doc('d', { areaId: 'len' })],
      asignaciones: [asg('d', 'g', 'len', 12), asg('d', 'g', 'ing', 10)],
    })
    expect(tipos(e, 'd')).toEqual([])
    expect(horasDocente(e, 'd')).toEqual({ total: 22, enArea: 12, enAfines: 10, otras: 0 })
  })
  it('rechaza menos de 12 horas en el área de nombramiento', () => {
    const e = mini({
      grupos: [g], docentes: [doc('d', { areaId: 'len' })],
      asignaciones: [asg('d', 'g', 'len', 8), asg('d', 'g', 'ing', 14)],
    })
    expect(tipos(e, 'd')).toContain('minimoArea')
  })
  it('no revisa el mínimo ni las áreas a un titular de primaria', () => {
    const e = mini({
      grupos: [grp('p', 3)],
      docentes: [doc('t', { nivel: 'primaria', rolPrimaria: 'titular', cargaSemanal: 25, direccionGrupoId: 'p' })],
      asignaciones: [asg('t', 'p', 'len', 10), asg('t', 'p', 'soc', 10), asg('t', 'p', 'ing', 5)],
    })
    expect(tipos(e, 't')).toEqual([])
  })
  it('sí revisa el mínimo a un especialista de primaria', () => {
    const e = mini({
      grupos: [grp('p', 3)],
      docentes: [doc('s', { nivel: 'primaria', rolPrimaria: 'especialista', cargaSemanal: 25, areaId: 'ing' })],
      asignaciones: [asg('s', 'p', 'ing', 8), asg('s', 'p', 'len', 17)],
    })
    expect(tipos(e, 's')).toContain('minimoArea')
  })
  it('avisa un área que no es la de nombramiento ni afín', () => {
    const e = mini({ grupos: [g], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 18), asg('d', 'g', 'soc', 4)] })
    expect(tipos(e, 'd')).toContain('areaNoAfin')
  })
  it('avisa horas en área afín cuando quedan horas sin docente en el área propia', () => {
    const e = mini({
      intensidad: { 7: { mat: 20, tec: 4 } },
      grupos: [g], docentes: [doc('d')],
      asignaciones: [asg('d', 'g', 'mat', 18), asg('d', 'g', 'tec', 4)],
    })
    expect(horasSinAsignar(e)).toEqual([{ grupoId: 'g', areaId: 'mat', horas: 2 }])
    expect(tipos(e, 'd')).toContain('afinConHorasPropias')
  })
  it('marca como excepción a un docente de primaria en bachillerato', () => {
    const e = mini({ grupos: [g], docentes: [doc('d', { nivel: 'primaria' })], asignaciones: [asg('d', 'g', 'mat', 22)] })
    const aviso = validarAsignacion(e).find((a) => a.tipo === 'nivel')
    expect(aviso?.gravedad).toBe('excepcion')
  })
  it('avisa un grupo que no recibe exactamente las horas de su intensidad', () => {
    const e = mini({ intensidad: { 7: { mat: 5 } }, grupos: [g], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 4)] })
    const aviso = validarAsignacion(e).find((a) => a.tipo === 'intensidad')
    expect(aviso).toMatchObject({ grupoId: 'g', areaId: 'mat' })
    expect(aviso?.mensaje).toContain('4 de 5')
  })
  it('avisa un docente de la mañana en un grupo de la tarde', () => {
    const e = mini({ grupos: [grp('g', 7, { jornada: 'tarde' })], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 22)] })
    expect(tipos(e, 'd')).toContain('jornada')
  })
  it('las horas extra se suman a la carga, pero sin ellas la regla de 22 se mantiene', () => {
    const g = grp('g', 7)
    const con = (horasExtra: number | undefined, horas: number) =>
      mini({ grupos: [g], docentes: [doc('d', { nombre: 'Ana', horasExtra })], asignaciones: [asg('d', 'g', 'mat', horas)] })
    expect(tipos(con(2, 24), 'd')).toEqual([])
    expect(tipos(con(undefined, 24), 'd')).toContain('carga')
    const falta = validarAsignacion(con(2, 22)).find((a) => a.tipo === 'carga')
    expect(falta?.mensaje).toBe('Ana tiene 22 de 24 horas (22 de carga más 2 extra).')
  })
  it('en ciclo de 10 días la carga es 44 y el mínimo en el área es 24', () => {
    const colegio = { ...mini().colegio, ciclo: 10 as const }
    const bien = mini({ colegio, grupos: [g], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 24), asg('d', 'g', 'tec', 20)] })
    expect(tipos(bien, 'd')).toEqual([])
    const mal = mini({ colegio, grupos: [g], docentes: [doc('d')], asignaciones: [asg('d', 'g', 'mat', 22)] })
    expect(tipos(mal, 'd')).toContain('carga')
  })
  it('un grupo de ciclo 5 en un horario de 10 días cuenta doble en la carga', () => {
    const e = mini({
      grupos: [grp('a', 7), grp('b', 8, { ciclo: 10 })], docentes: [doc('d')],
      asignaciones: [asg('d', 'a', 'mat', 12), asg('d', 'b', 'mat', 20)],
    })
    expect(horasDocente(e, 'd').total).toBe(44)
    expect(tipos(e, 'd')).toEqual([])
  })
})

describe('ayuda para completar la carga', () => {
  it('propone primero el área propia en grupos propios, luego la dirección, y no supera lo que falta', () => {
    const e = mini({
      intensidad: { 7: { mat: 5, tec: 2 }, 8: { mat: 5, tec: 2 } },
      grupos: [grp('a', 7), grp('b', 7, { numero: 2 }), grp('c', 8)],
      docentes: [doc('d', { cargaSemanal: 13, direccionGrupoId: 'b' })],
      asignaciones: [asg('d', 'a', 'mat', 3)],
    })
    expect(sugerirParaDocente(e, 'd')).toEqual([
      { grupoId: 'a', areaId: 'mat', horas: 2, motivo: 'areaGrupoPropio' },
      { grupoId: 'b', areaId: 'mat', horas: 5, motivo: 'areaDireccion' },
      { grupoId: 'c', areaId: 'mat', horas: 3, motivo: 'areaNivel' },
    ])
  })
  it('propone áreas afines cuando ya no hay horas del área propia', () => {
    const e = mini({
      intensidad: { 7: { mat: 5, tec: 2, soc: 4 } },
      grupos: [grp('a', 7)], docentes: [doc('d', { cargaSemanal: 6 })],
      asignaciones: [asg('d', 'a', 'mat', 5)],
    })
    expect(sugerirParaDocente(e, 'd')).toEqual([{ grupoId: 'a', areaId: 'tec', horas: 1, motivo: 'afinGrupoPropio' }])
  })
  it('no propone nada a quien ya tiene la carga completa', () => {
    const e = mini({ intensidad: { 7: { mat: 30 } }, grupos: [grp('a', 7)], docentes: [doc('d')], asignaciones: [asg('d', 'a', 'mat', 22)] })
    expect(sugerirParaDocente(e, 'd')).toEqual([])
  })
})

describe('materias compartidas y exceso de horas', () => {
  const g = grp('g', 7)
  const avisosDe = (e: ReturnType<typeof mini>, tipo: string) => validarAsignacion(e).filter((a) => a.tipo === tipo)

  it('avisa cuando dos docentes dictan la misma materia en el mismo grupo y la suma coincide con la intensidad', () => {
    const e = mini({
      intensidad: { 7: { mat: 5 } }, grupos: [g],
      docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 3 }), doc('x', { nombre: 'Luis', cargaSemanal: 2 })],
      asignaciones: [asg('d', 'g', 'mat', 3), asg('x', 'g', 'mat', 2)],
    })
    const [aviso] = avisosDe(e, 'compartida')
    expect(aviso).toMatchObject({ gravedad: 'excepcion', grupoId: 'g', areaId: 'mat' })
    expect(aviso.mensaje).toBe('Matemáticas en 7-1 la dictan 2 docentes: Ana (3 h) y Luis (2 h). Suman 5 de 5 horas.')
    expect(avisosDe(e, 'intensidad')).toEqual([])
  })
  it('si la suma de los docentes no coincide con la intensidad, el aviso es un error y no se repite', () => {
    const e = mini({
      intensidad: { 7: { mat: 5 } }, grupos: [g],
      docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 3 }), doc('x', { nombre: 'Luis', cargaSemanal: 3 })],
      asignaciones: [asg('d', 'g', 'mat', 3), asg('x', 'g', 'mat', 3)],
    })
    const avisos = validarAsignacion(e).filter((a) => a.grupoId === 'g' && a.areaId === 'mat')
    expect(avisos.map((a) => [a.tipo, a.gravedad])).toEqual([['compartida', 'error']])
    expect(avisos[0].mensaje).toContain('Suman 6 de 5 horas')
  })
  it('un solo docente en una materia no genera aviso de materia compartida', () => {
    const e = mini({ intensidad: { 7: { mat: 5 } }, grupos: [g], docentes: [doc('d', { cargaSemanal: 5 })], asignaciones: [asg('d', 'g', 'mat', 5)] })
    expect(avisosDe(e, 'compartida')).toEqual([])
  })
  it('avisa un grupo de bachillerato con más de 30 horas por semana y uno de primaria con más de 25', () => {
    const e = mini({
      grupos: [g, grp('p', 3)],
      docentes: [doc('d', { nombre: 'Ana', cargaSemanal: 31 }), doc('t', { nombre: 'Tito', nivel: 'primaria', rolPrimaria: 'titular', cargaSemanal: 26 })],
      asignaciones: [asg('d', 'g', 'mat', 31), asg('t', 'p', 'len', 26)],
    })
    expect(avisosDe(e, 'excesoGrupo').map((a) => a.mensaje)).toEqual([
      'El grupo 7-1 tiene 31 horas por semana asignadas; en bachillerato el máximo es 30.',
      'El grupo 3-1 tiene 26 horas por semana asignadas; en primaria el máximo es 25.',
    ])
    const justo = mini({ grupos: [g], docentes: [doc('d', { cargaSemanal: 30 })], asignaciones: [asg('d', 'g', 'mat', 30)] })
    expect(avisosDe(justo, 'excesoGrupo')).toEqual([])
  })
  it('en ciclo de 10 días cuenta las horas por semana (la mitad del ciclo)', () => {
    const colegio = { ...mini().colegio, ciclo: 10 as const }
    const e = mini({ colegio, grupos: [g], docentes: [doc('d', { cargaSemanal: 30 })], asignaciones: [asg('d', 'g', 'mat', 60)] })
    expect(avisosDe(e, 'excesoGrupo')).toEqual([])
  })
  it('avisa si la intensidad de un grado con grupos suma más de lo que cabe en la semana', () => {
    const e = mini({ intensidad: { 3: { mat: 20, len: 6 }, 9: { mat: 31 } }, grupos: [grp('p', 3)] })
    expect(avisosDe(e, 'excesoIntensidad').map((a) => a.mensaje)).toEqual(['La intensidad horaria de 3.° suma 26 horas por semana; en primaria el máximo es 25.'])
  })
})

describe('media técnica fuera de las 30 horas', () => {
  const colegio = (normales: number, mt: number) => {
    const e = mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'mt', nombre: 'Media técnica en sistemas', afines: [], mediaTecnica: true }],
      grupos: [grp('a', 10)],
      docentes: [doc('d', { cargaSemanal: normales }), doc('t', { cargaSemanal: mt, areaId: 'mt' })],
      asignaciones: [asg('d', 'a', 'mat', normales), asg('t', 'a', 'mt', mt)],
    })
    e.intensidad = { 10: { mat: normales, mt } }
    return e
  }
  it('las horas de media técnica no cuentan en el máximo del grupo ni en el de la intensidad', () => {
    const avisos = validarAsignacion(colegio(30, 6)).filter((a) => a.tipo === 'excesoGrupo' || a.tipo === 'excesoIntensidad')
    expect(avisos).toEqual([])
    expect(horasSemanaGrupo(colegio(30, 6), colegio(30, 6).grupos[0])).toEqual({ cuentan: 30, mediaTecnica: 6 })
  })
  it('si las demás pasan de 30 sí avisa, y dice cuántas de media técnica no contó', () => {
    const avisos = validarAsignacion(colegio(31, 6)).filter((a) => a.tipo === 'excesoGrupo')
    expect(avisos.map((a) => a.mensaje)).toEqual(['El grupo 10-1 tiene 31 horas por semana asignadas (sin contar 6 de media técnica); en bachillerato el máximo es 30.'])
  })
})

describe('el área llamada «Media técnica»', () => {
  it('se reconoce sola por su nombre, y la casilla puede corregirlo', () => {
    const e = mini({ areas: [{ id: 'mt', nombre: 'Media Técnica', afines: [] }, { id: 'x', nombre: 'Media tecnica en sistemas', afines: [] }, { id: 'tec', nombre: 'Tecnología', afines: [] }] })
    expect(e.areas.map((a) => esMediaTecnica(e, a.id))).toEqual([true, true, false])
    e.areas[0].mediaTecnica = false
    expect(esMediaTecnica(e, 'mt')).toBe(false)
  })
})
