import type { ClaseLeida, HorarioLeido } from '../dominio/importarHorario'
import { trozosDePdf, type Trozo } from './documentos'

const NO_ES = 'Este PDF no es un «Horario general» descargado de la app. Descárgalo desde Horario → General → PDF y vuelve a intentarlo.'
const SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const sinTilde = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const diaDe = (texto: string): number | undefined => {
  const t = sinTilde(texto.trim())
  const i = SEMANA.indexOf(t)
  if (i >= 0) return i + 1
  const n = /^dia (\d{1,2})$/.exec(t)
  return n ? Number(n[1]) : undefined
}
const centro = (t: Trozo) => t.x + t.ancho / 2
const GRUPO = /^\d{1,2}\s*-\s*\d{1,2}$/

/**
 * Lee el «Horario general» que descarga la app en PDF (una hoja por día, una fila por docente, una columna por franja).
 * Cada celda trae el grupo en la primera línea y el área (y, si hay, el aula) en las siguientes.
 */
export const leerHorarioGeneral = (paginas: Trozo[][]): HorarioLeido => {
  const leido: HorarioLeido = { dias: [], docentes: [], clases: [] }
  for (const pagina of paginas) {
    const textos = pagina.filter((t) => t.str.trim())
    const titulo = textos.find((t) => (t.tam ?? 0) >= 14 && /^Horario general · /.test(t.str.trim()))
    const dia = titulo && diaDe(titulo.str.trim().replace(/^Horario general · /, '').replace(/ \(continuación\)$/, ''))
    const franjas = textos.flatMap((t) => {
      const m = /^Franja (\d)$/.exec(t.str.trim())
      return m ? [{ franja: Number(m[1]), x: centro(t), y: t.y }] : []
    })
    if (!titulo || !dia || franjas.length < 2) continue
    if (!leido.dias.includes(dia)) leido.dias.push(dia)
    leido.colegio ??= textos.find((t) => t !== titulo && Math.abs(t.y - titulo.y) < 3 && t.x > titulo.x + titulo.ancho)?.str.trim()
    const ancho = Math.min(...franjas.slice(1).map((f, i) => Math.abs(f.x - franjas[i].x)))
    const izquierda = Math.min(...franjas.map((f) => f.x)) - ancho * 0.6
    const derecha = Math.max(...franjas.map((f) => f.x)) + ancho * 0.6
    const arriba = Math.min(...franjas.map((f) => f.y)) - 2
    // Nombres: a la izquierda de la tabla, en letra de 8,5 (la leyenda del pie va en 8 y las celdas en 7,5 o menos).
    const nombres = textos.filter((t) => t.y < arriba && t.x + t.ancho <= izquierda + 2 && (t.tam ?? 8.5) >= 8.3)
    for (const n of nombres) if (!leido.docentes.includes(n.str.trim())) leido.docentes.push(n.str.trim())
    if (nombres.length === 0) continue
    const celdas = new Map<string, Trozo[]>()
    for (const t of textos) {
      if (t.y >= arriba || (t.tam ?? 0) >= 8 || centro(t) < izquierda || centro(t) > derecha) continue
      const fila = nombres.reduce((a, b) => (Math.abs(b.y - t.y) < Math.abs(a.y - t.y) ? b : a))
      const col = franjas.reduce((a, b) => (Math.abs(b.x - centro(t)) < Math.abs(a.x - centro(t)) ? b : a))
      const llave = `${fila.str.trim()}|${col.franja}`
      celdas.set(llave, [...(celdas.get(llave) ?? []), t])
    }
    for (const [llave, trozos] of celdas) {
      const [docente, franja] = llave.split('|')
      // De arriba abajo; cada línea que es un grupo (7-3) empieza otra clase (más de una en la celda es un cruce).
      let actual: ClaseLeida | undefined
      for (const t of trozos.sort((a, b) => b.y - a.y || a.x - b.x)) {
        const linea = t.str.trim()
        if (GRUPO.test(linea)) {
          actual = { docente, grupo: linea.replace(/\s/g, ''), dia, franja: Number(franja), lineas: [] }
          leido.clases.push(actual)
        } else if (actual) actual.lineas.push(linea)
      }
    }
  }
  if (leido.dias.length === 0) throw new Error(NO_ES)
  leido.dias.sort((a, b) => a - b)
  return leido
}

export const leerHorarioPdf = async (archivo: File): Promise<HorarioLeido> => {
  if (!archivo.name.toLowerCase().endsWith('.pdf')) throw new Error(NO_ES)
  return leerHorarioGeneral(await trozosDePdf(await archivo.arrayBuffer()))
}
