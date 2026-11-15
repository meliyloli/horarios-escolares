import { describe, expect, it } from 'vitest'
import { contraste, PALETA_AREAS, tintaSobre } from './colores'

describe('colores de área', () => {
  it('todo color de la paleta deja leer el texto con contraste AA', () => {
    for (const color of PALETA_AREAS) expect(contraste(color, tintaSobre(color)), color).toBeGreaterThanOrEqual(4.5)
  })
  it('elige tinta oscura sobre colores claros y blanca sobre oscuros', () => {
    expect(tintaSobre('#FFFFFF')).toBe('#1B2B4B')
    expect(tintaSobre('#14285A')).toBe('#FFFFFF')
  })
  it('la paleta no repite colores', () => {
    expect(new Set(PALETA_AREAS).size).toBe(PALETA_AREAS.length)
  })
})
