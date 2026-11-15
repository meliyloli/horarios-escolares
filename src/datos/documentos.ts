// Abre un Word (.docx) o un PDF del colegio y devuelve sus tablas como filas de texto.
import { esEncabezado, type Tabla } from '../dominio/importar'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const NO_ES_WORD = 'El archivo no es un documento de Word (.docx) o está dañado.'

/** Saca un archivo de un zip (un .docx es un zip). Usa la descompresión que ya trae el navegador. */
const archivoDelZip = async (buf: ArrayBuffer, nombre: string): Promise<Uint8Array> => {
  const v = new DataView(buf)
  let fin = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i
      break
    }
  if (fin < 0) throw new Error(NO_ES_WORD)
  const total = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const texto = new TextDecoder()
  for (let n = 0; n < total && p + 46 <= buf.byteLength && v.getUint32(p, true) === 0x02014b50; n++) {
    const [metodo, comprimido, largoNombre, largoExtra, largoComentario, local] = [
      v.getUint16(p + 10, true), v.getUint32(p + 20, true), v.getUint16(p + 28, true), v.getUint16(p + 30, true), v.getUint16(p + 32, true), v.getUint32(p + 42, true),
    ]
    if (texto.decode(new Uint8Array(buf, p + 46, largoNombre)) === nombre) {
      const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
      const datos = new Uint8Array(buf, inicio, comprimido)
      if (metodo === 0) return datos
      if (metodo !== 8) throw new Error(NO_ES_WORD)
      return new Uint8Array(await new Response(new Response(datos).body!.pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    }
    p += 46 + largoNombre + largoExtra + largoComentario
  }
  throw new Error(NO_ES_WORD)
}

const hijos = (el: Element, nombre: string) => [...el.children].filter((x) => x.localName === nombre)

/** Las tablas de un .docx. Una celda combinada a lo ancho ocupa sus columnas; una combinada hacia abajo queda vacía. */
export const leerDocx = async (buf: ArrayBuffer): Promise<Tabla[]> => {
  const xml = new TextDecoder().decode(await archivoDelZip(buf, 'word/document.xml'))
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error(NO_ES_WORD)
  const textoDe = (el: Element) => [...el.getElementsByTagNameNS(W, 't')].map((t) => t.textContent ?? '').join('').trim()
  /** El párrafo con texto justo encima de la tabla (ahí suele ir "Docente: …"), si es corto. */
  const tituloDe = (tbl: Element): string[][] => {
    let el = tbl.previousElementSibling
    for (let n = 0; el && n < 3; n++, el = el.previousElementSibling) {
      if (el.localName !== 'p') return []
      const texto = textoDe(el)
      if (texto) return texto.length <= 120 ? [[texto]] : []
    }
    return []
  }
  return [...doc.getElementsByTagNameNS(W, 'tbl')].map((tbl) => [
    ...tituloDe(tbl),
    ...hijos(tbl, 'tr').map((tr) =>
      hijos(tr, 'tc').flatMap((tc) => {
        const texto = [...tc.getElementsByTagNameNS(W, 'p')]
          .map((p) => [...p.getElementsByTagNameNS(W, 't')].map((t) => t.textContent ?? '').join(''))
          .filter((x) => x.trim())
          .join(' ')
          .trim()
        const span = Number(tc.getElementsByTagNameNS(W, 'gridSpan')[0]?.getAttributeNS(W, 'val') ?? 1) || 1
        return [texto, ...Array<string>(span - 1).fill('')]
      }),
    ),
  ])
}

/** Un pedazo de texto de una página de PDF, con su posición. */
/** `tam` es el tamaño de la letra, cuando se conoce. */
export interface Trozo { str: string; x: number; y: number; ancho: number; tam?: number }
interface Pedazo { texto: string; x: number }

/** Parte una lista de filas en tablas: empieza una nueva cada vez que aparece otro encabezado. */
const partir = <T>(filas: T[], textos: (f: T) => string[]): T[][] => {
  const tablas: T[][] = []
  let actual: T[] = []
  let conEncabezado = false
  for (const f of filas) {
    if (esEncabezado(textos(f))) {
      if (conEncabezado) {
        tablas.push(actual)
        actual = []
      }
      conEncabezado = true
    }
    actual.push(f)
  }
  if (actual.length) tablas.push(actual)
  return tablas
}
export const partirEnTablas = (filas: Tabla): Tabla[] => partir(filas, (f) => f)

/**
 * Ordena el texto de un PDF en tablas: agrupa los pedazos por renglón, junta los que van pegados
 * (las palabras de una misma celda) y alinea las celdas en columnas según dónde empiezan.
 */
export const tablasDeTexto = (paginas: Trozo[][]): Tabla[] => {
  const renglones: Pedazo[][] = []
  for (const pagina of paginas) {
    const orden = pagina.filter((t) => t.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
    const lineas: Trozo[][] = []
    for (const t of orden) {
      const ultima = lineas.at(-1)
      if (ultima && Math.abs(ultima[0].y - t.y) < 3) ultima.push(t)
      else lineas.push([t])
    }
    for (const linea of lineas) {
      const pedazos: (Pedazo & { finX: number })[] = []
      for (const t of linea.sort((a, b) => a.x - b.x)) {
        const previo = pedazos.at(-1)
        if (previo && t.x - previo.finX < 6) {
          previo.texto += (t.x - previo.finX > 0.5 ? ' ' : '') + t.str.trim()
          previo.finX = t.x + t.ancho
        } else pedazos.push({ texto: t.str.trim(), x: t.x, finX: t.x + t.ancho })
      }
      renglones.push(pedazos.map(({ texto, x }) => ({ texto, x })))
    }
  }
  return partir(renglones, (r) => r.map((p) => p.texto)).map((bloque) => {
    const columnas: number[] = []
    for (const x of bloque.flat().map((p) => p.x).sort((a, b) => a - b)) if (!columnas.length || x - columnas.at(-1)! > 12) columnas.push(x)
    return bloque.map((renglon) => {
      const fila = columnas.map(() => '')
      for (const p of renglon) {
        let i = columnas.length - 1
        while (i > 0 && columnas[i] > p.x + 12) i--
        fila[i] = fila[i] ? `${fila[i]} ${p.texto}` : p.texto
      }
      return fila
    })
  })
}

/** El texto de cada página de un PDF, con su posición. El lector de PDF se carga solo al usarlo y corre sin internet. */
export const trozosDePdf = async (buf: ArrayBuffer): Promise<Trozo[][]> => {
  const pdfjs = await import('pdfjs-dist')
  const g = globalThis as { pdfjsWorker?: unknown }
  // Sin archivo aparte para el trabajador: pdf.js lo usa directamente en esta página.
  g.pdfjsWorker ??= await import('pdfjs-dist/build/pdf.worker.min.mjs')
  let pdf
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  } catch {
    throw new Error('El archivo no es un PDF o está dañado.')
  }
  const paginas: Trozo[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent()
    paginas.push(items.flatMap((i) => ('str' in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], ancho: i.width, tam: i.transform[0] }] : [])))
  }
  return paginas
}

/** Las tablas de un PDF con texto. */
export const leerPdf = async (buf: ArrayBuffer): Promise<Tabla[]> => tablasDeTexto(await trozosDePdf(buf))

/** Lee un archivo elegido por la persona. Lanza un Error con mensaje claro si no se puede. */
export const leerArchivo = async (archivo: File): Promise<Tabla[]> => {
  const nombre = archivo.name.toLowerCase()
  if (nombre.endsWith('.docx')) return leerDocx(await archivo.arrayBuffer())
  if (nombre.endsWith('.pdf')) return leerPdf(await archivo.arrayBuffer())
  if (nombre.endsWith('.doc')) throw new Error('Los archivos .doc antiguos no se pueden leer. Ábrelo en Word y guárdalo como .docx.')
  throw new Error('Solo se pueden leer documentos de Word (.docx) o PDF.')
}
