import type { Estado, Id } from '../dominio/tipos'

export const TINTA = '#1B2B4B'

/** Colores de cartulina para las áreas, en el orden en que se reparten. */
export const PALETA_AREAS = [
  '#FF7A45', '#4FB3E8', '#3CC47C', '#A5D152', '#FFC93C', '#C3A6F0', '#F58BB4', '#6A4BC4',
  '#3FD0E0', '#C9B7AE', '#5CC9BB', '#F2A65A', '#9FB4C7', '#EE9393', '#8FD694', '#1F5FBF',
]

const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contraste = (a: string, b: string): number => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Tinta que mejor se lee sobre un color: azul noche o blanco. */
export const tintaSobre = (color: string): string => (contraste(color, TINTA) >= contraste(color, '#FFFFFF') ? TINTA : '#FFFFFF')

const valido = (c?: string): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c)

/** Color de un área: el que eligió el colegio o, si no, el que le toca por su posición. */
export const colorDeArea = (e: Estado, areaId: Id): string => {
  const i = e.areas.findIndex((a) => a.id === areaId)
  const propio = e.areas[i]?.color
  return valido(propio) ? propio : i < 0 ? '#DDE6F3' : PALETA_AREAS[i % PALETA_AREAS.length]
}
