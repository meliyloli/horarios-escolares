/** Texto sin tildes, en minúscula y con solo letras, números y espacios simples: para comparar nombres. */
export const normal = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
