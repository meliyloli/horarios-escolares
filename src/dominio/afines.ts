// Áreas afines comunes en los colegios oficiales de Colombia: un punto de partida que cada colegio ajusta.
// La norma no fija afinidades entre áreas: el Manual de Funciones (Resolución 3842 de 2022) dice qué títulos sirven
// para cada área, y el rector completa la carga «en áreas afines». Estas agrupan las áreas que comparten títulos
// (Humanidades; Matemáticas, Física y Tecnología; Sociales, Filosofía, Ética y Religión; Artística y Educación Física).
// Además, Ética y Religión (1 hora por grupo) son las que más se usan en la práctica para completar la carga de
// docentes de cualquier área: van al final de la lista de cada área.
import { normal } from './texto'
import type { Estado } from './tipos'

export type TipoArea = 'mat' | 'len' | 'ing' | 'nat' | 'soc' | 'fil' | 'eti' | 'rel' | 'art' | 'efi' | 'tec' | 'eco'

/** Lo que puede dictar un docente nombrado en cada área (fila), en orden de cercanía. */
export const AFINES_COMUNES: Record<TipoArea, TipoArea[]> = {
  mat: ['tec', 'nat', 'eti', 'rel'], // física y estadística; en media la física va en Naturales
  len: ['ing', 'fil', 'eti', 'rel'], // Humanidades
  ing: ['len', 'eti', 'rel'],
  nat: ['tec', 'mat', 'eti', 'rel'], // física y química
  soc: ['fil', 'eco', 'eti', 'rel'],
  fil: ['soc', 'eco', 'eti', 'rel'],
  eti: ['soc', 'rel', 'fil'],
  rel: ['eti', 'fil', 'soc'],
  art: ['efi', 'eti', 'rel'],
  efi: ['art', 'eti', 'rel'],
  tec: ['mat', 'nat', 'eti', 'rel'],
  eco: ['soc', 'fil', 'eti'],
}

// El orden importa: «Educación Física» antes que la física de Naturales; «Ética» antes que «Valores» de otras áreas.
const PATRONES: [RegExp, TipoArea][] = [
  [/\beducacion fisica\b|\bdeportes?\b|\brecreacion\b/, 'efi'],
  [/\betica\b|\bvalores\b/, 'eti'],
  [/\breligion\b|\breligiosa\b/, 'rel'],
  [/\beconomic|\bciencias politicas\b|\bpoliticas\b/, 'eco'],
  [/\bartistica\b|\bartes?\b|\bmusica\b|\bdanzas?\b|\bteatro\b/, 'art'],
  [/\binformatica\b|\btecnologia\b|\bcomputacion\b/, 'tec'],
  [/\bingles\b|\bidioma extranjero\b|\blengua extranjera\b/, 'ing'],
  [/\bespanol\b|\bcastellan[oa]\b|\blenguaje\b|\bhumanidades\b/, 'len'],
  [/\bnaturales\b|\bbiologia\b|\bquimica\b|\bfisica\b|\bambiental\b/, 'nat'],
  [/\bmatematicas?\b|\bgeometria\b|\bestadistica\b/, 'mat'],
  [/\bsociales\b|\bhistoria\b|\bgeografia\b|\bdemocracia\b|\bcatedra de (la )?paz\b/, 'soc'],
  [/\bfilosofia\b/, 'fil'],
]

/** Qué área del plan de estudios es, por su nombre; undefined si no se reconoce. */
export const tipoDeArea = (nombre: string): TipoArea | undefined => {
  const n = normal(nombre)
  return PATRONES.find(([p]) => p.test(n))?.[1]
}

/**
 * Pone las afines comunes a cada área que se reconoce por su nombre (los programas de media técnica no cuentan).
 * Con `soloVacias`, solo a las que todavía no tienen afines: así no se pisa lo que el colegio ya decidió.
 */
export const conAfinesComunes = (e: Estado, soloVacias = false): Estado => {
  const plan = e.areas.filter((a) => !a.mediaTecnica && !/media\s*t[eé]cnica/i.test(a.nombre))
  const tipo = new Map(plan.map((a) => [a.id, tipoDeArea(a.nombre)]))
  return {
    ...e,
    areas: e.areas.map((a) => {
      const t = tipo.get(a.id)
      if (!t || (soloVacias && a.afines.length > 0)) return a
      const afines = AFINES_COMUNES[t].flatMap((x) => plan.filter((o) => o.id !== a.id && tipo.get(o.id) === x).map((o) => o.id))
      return { ...a, afines }
    }),
  }
}
