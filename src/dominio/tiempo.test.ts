import { describe, expect, it } from 'vitest'
import { cargaEnCiclo, diasHorario, diasOcupados, diasVecinos, nivelDeGrado, nombreDia, nombreGrupo } from './tiempo'
import type { Docente, Estado, Grupo } from './tipos'

const grupo = (g: Partial<Grupo>): Grupo => ({ id: 'g', grado: 7, numero: 1, jornada: 'manana', ...g })

describe('tiempo', () => {
  it('un grupo de ciclo 5 en horario de 10 días ocupa el día y el día + 5', () => {
    expect(diasOcupados(3, 5, 10)).toEqual([3, 8])
  })
  it('un grupo de ciclo 10 ocupa solo su día', () => {
    expect(diasOcupados(3, 10, 10)).toEqual([3])
    expect(diasOcupados(3, 5, 5)).toEqual([3])
  })
  it('los días vecinos no dan la vuelta al ciclo', () => {
    expect(diasVecinos(1, 5)).toEqual([2])
    expect(diasVecinos(10, 10)).toEqual([9])
    expect(diasVecinos(5, 10)).toEqual([4, 6])
    expect(diasVecinos(5, 5)).toEqual([4])
  })
  it('la carga se duplica en ciclo de 10 días: 44 y 50', () => {
    expect(cargaEnCiclo({ cargaSemanal: 22 } as Docente, 10)).toBe(44)
    expect(cargaEnCiclo({ cargaSemanal: 25 } as Docente, 10)).toBe(50)
    expect(cargaEnCiclo({ cargaSemanal: 22 } as Docente, 5)).toBe(22)
  })
  it('el horario es de 10 días si algún grupo usa ciclo de 10', () => {
    const e = { colegio: { ciclo: 5 }, grupos: [grupo({}), grupo({ id: 'h', ciclo: 10 })] } as Estado
    expect(diasHorario(e)).toBe(10)
    expect(diasHorario({ colegio: { ciclo: 5 }, grupos: [grupo({})] } as Estado)).toBe(5)
  })
  it('el nombre del día nunca queda vacío', () => {
    expect(nombreDia(2, 5)).toBe('Martes')
    expect(nombreDia(8, 5)).toBe('Día 8')
    expect(nombreDia(8, 10)).toBe('Día 8')
  })
  it('grados 1 a 5 son primaria y 6 a 11 bachillerato', () => {
    expect(nivelDeGrado(5)).toBe('primaria')
    expect(nivelDeGrado(6)).toBe('bachillerato')
    expect(nombreGrupo(grupo({ grado: 7, numero: 2 }))).toBe('7-2')
  })
})
