import { describe, expect, it } from 'vitest'
import { doc, grp, mini } from './ayudaPruebas'
import { emparejarDocentes, versionDesdeHorario, type HorarioLeido } from './importarHorario'

// Nombres cambiados desde que se descargó el PDF, como pasa en un colegio real.
const colegio = () =>
  mini({
    grupos: [grp('g71', 7)],
    docentes: ['Sonia Pineda', 'Yessenia', 'Ruddy', 'Odilia', 'Marcela Ortiz', 'Sanny'].map((n, i) => doc(`d${i}`, { nombre: n })),
  })
const pdf: HorarioLeido = {
  dias: [1, 2, 3, 4, 5],
  docentes: ['Marcela Ortiz', 'Sonia P. (apellido pendiente)', 'M.ª Yesenia (apellido', 'Rudy E.', 'Odilia (apellido pendiente)', 'Sanny', 'Docente por asignar (X)'],
  clases: [
    { docente: 'Rudy E.', grupo: '7-1', dia: 1, franja: 1, lineas: ['Matemáticas'] },
    { docente: 'Docente por asignar (X)', grupo: '7-1', dia: 1, franja: 2, lineas: ['Matemáticas'] },
  ],
}

describe('reconocer a los docentes de un horario en PDF', () => {
  it('propone a qué docente del colegio corresponde cada nombre, aunque haya cambiado', () => {
    const r = Object.fromEntries(emparejarDocentes(colegio(), pdf).map((x) => [x.pdf, [x.docenteId ?? 'nuevo', x.exacto]]))
    expect(r).toEqual({
      'Marcela Ortiz': ['d4', true],
      'Sanny': ['d5', true],
      'Sonia P. (apellido pendiente)': ['d0', false],
      'M.ª Yesenia (apellido': ['d1', false],
      'Rudy E.': ['d2', false],
      'Odilia (apellido pendiente)': ['d3', false],
      'Docente por asignar (X)': ['nuevo', false],
    })
  })
  it('usa lo propuesto, o lo que la persona elija, sin duplicar docentes', () => {
    const auto = versionDesdeHorario(colegio(), pdf, 'V')
    expect(auto.resumen.docentesNuevos).toEqual(['Docente por asignar (X)'])
    expect(auto.estado.docentes).toHaveLength(7)
    expect(auto.estado.asignaciones.find((a) => a.docenteId === 'd2')?.horas).toBe(1)
    const elegido = versionDesdeHorario(colegio(), pdf, 'V', { 'Rudy E.': '', 'Docente por asignar (X)': 'd5' })
    expect(elegido.resumen.docentesNuevos).toEqual(['Rudy E.'])
    expect(elegido.estado.asignaciones.find((a) => a.docenteId === 'd5')?.horas).toBe(1)
  })
})
