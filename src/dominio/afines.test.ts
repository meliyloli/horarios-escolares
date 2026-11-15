import { describe, expect, it } from 'vitest'
import { conAfinesComunes, tipoDeArea } from './afines'
import { mini } from './ayudaPruebas'
import { aplicarImportacion } from './importar'
import { areasIniciales } from './ejemplo'
import type { Area } from './tipos'

const nombres = (areas: Area[], id: string) => areas.find((a) => a.id === id)!.afines.map((x) => areas.find((a) => a.id === x)!.nombre).sort()

describe('áreas afines comunes en colegios de Colombia', () => {
  it('por defecto, Ética es afín a Sociales, Religión y Filosofía; Matemáticas a Tecnología y Naturales, y todas pueden completar con Ética y Religión', () => {
    const areas = areasIniciales()
    expect(nombres(areas, 'eti')).toEqual(['Ciencias Sociales', 'Educación Religiosa', 'Filosofía'])
    expect(nombres(areas, 'mat')).toEqual(['Ciencias Naturales', 'Educación Religiosa', 'Tecnología e Informática', 'Ética y Valores'])
    expect(nombres(areas, 'ing')).toEqual(['Educación Religiosa', 'Lengua Castellana', 'Ética y Valores'])
    expect(areas.find((a) => a.id === 'mat')!.afines.slice(0, 2)).toEqual(['tec', 'nat']) // primero las más cercanas
  })

  it('reconoce el área por su nombre aunque venga largo, como en el plan de estudios', () => {
    expect(tipoDeArea('Humanidades: Lengua Castellana')).toBe('len')
    expect(tipoDeArea('Educación Ética y en Valores Humanos')).toBe('eti')
    expect(tipoDeArea('Educación Física, Recreación y Deportes')).toBe('efi')
    expect(tipoDeArea('Ciencias Naturales y Educación Ambiental')).toBe('nat')
    expect(tipoDeArea('Ciencias Económicas y Políticas')).toBe('eco')
    expect(tipoDeArea('Emprendimiento')).toBeUndefined()
  })

  it('pone las afines comunes a las áreas que reconoce, sin tocar las demás ni la media técnica', () => {
    const e = mini({
      areas: [
        { id: 'a1', nombre: 'Educación Ética y en Valores Humanos', afines: [] },
        { id: 'a2', nombre: 'Ciencias Sociales, Historia y Geografía', afines: [] },
        { id: 'a3', nombre: 'Filosofía', afines: [] },
        { id: 'a4', nombre: 'Educación Religiosa', afines: [] },
        { id: 'a5', nombre: 'Ciencias Económicas y Políticas', afines: [] },
        { id: 'a6', nombre: 'Emprendimiento', afines: ['a2'] },
        { id: 'a7', nombre: 'Media técnica en sistemas', afines: [], mediaTecnica: true },
        { id: 'a8', nombre: 'Matemáticas', afines: [] },
      ],
    })
    const areas = conAfinesComunes(e).areas
    expect(nombres(areas, 'a1')).toEqual(['Ciencias Sociales, Historia y Geografía', 'Educación Religiosa', 'Filosofía'])
    expect(nombres(areas, 'a5')).toEqual(['Ciencias Sociales, Historia y Geografía', 'Educación Ética y en Valores Humanos', 'Filosofía'])
    expect(areas.find((a) => a.id === 'a2')!.afines).toContain('a5')
    expect(areas.find((a) => a.id === 'a6')!.afines).toEqual(['a2'])
    expect(areas.find((a) => a.id === 'a7')!.afines).toEqual([])
    expect(areas.flatMap((a) => a.afines)).not.toContain('a7')
  })

  it('con «solo vacías» no cambia las afines que el colegio ya eligió', () => {
    const e = mini({ areas: [{ id: 'm', nombre: 'Matemáticas', afines: ['s'] }, { id: 's', nombre: 'Ciencias Sociales', afines: [] }, { id: 't', nombre: 'Tecnología', afines: [] }] })
    const areas = conAfinesComunes(e, true).areas
    expect(areas.find((a) => a.id === 'm')!.afines).toEqual(['s'])
    expect(areas.find((a) => a.id === 't')!.afines).toEqual(['m'])
  })
})

describe('al importar un Word o PDF', () => {
  it('las áreas nuevas llegan con las afines comunes y las que ya tenía el colegio no cambian', () => {
    const e = mini({ areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }] })
    const { estado } = aplicarImportacion(e, { intensidad: [{ area: 'Tecnología e Informática', horas: { 6: 2 } }, { area: 'Ética y Valores', horas: { 6: 1 } }] })
    const tec = estado.areas.find((a) => a.nombre === 'Tecnología e Informática')!
    expect(tec.afines).toContain('mat')
    expect(estado.areas.find((a) => a.id === 'mat')!.afines).toEqual([])
  })
})
