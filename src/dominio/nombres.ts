import { normal } from './importar'

/** Palabras del nombre que sirven para comparar: sin lo que va entre paréntesis («(apellido pendiente)») ni iniciales. */
export const palabras = (nombre: string) => normal(nombre.replace(/\([^)]*(\)|$)/g, ' ')).split(' ').filter((w) => w.length > 2)

/** Cuántas letras hay que cambiar para pasar de una palabra a otra. */
export const distancia = (a: string, b: string): number => {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i]
    for (let j = 1; j <= b.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    fila = nueva
  }
  return fila[b.length]
}

/** Qué tan distintos son dos nombres (0 = la misma palabra): su par de palabras más parecido, si empiezan igual. */
export const lejania = (a: string, b: string): number =>
  Math.min(...palabras(a).flatMap((x) => palabras(b).map((y) => (x[0] === y[0] ? distancia(x, y) / Math.max(x.length, y.length) : 1))), 1)
