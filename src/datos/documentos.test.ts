// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { leerDocx, partirEnTablas, tablasDeTexto, type Trozo } from './documentos'

/** Arma un .docx mínimo (un zip con word/document.xml comprimido) como lo guardaría Word. */
const docx = async (cuerpo: string): Promise<ArrayBuffer> => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`
  const nombre = new TextEncoder().encode('word/document.xml')
  const crudo = new TextEncoder().encode(xml)
  const datos = new Uint8Array(await new Response(new Response(crudo).body!.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
  const local = new DataView(new ArrayBuffer(30))
  local.setUint32(0, 0x04034b50, true); local.setUint16(8, 8, true)
  local.setUint32(18, datos.length, true); local.setUint32(22, crudo.length, true); local.setUint16(26, nombre.length, true)
  const central = new DataView(new ArrayBuffer(46))
  central.setUint32(0, 0x02014b50, true); central.setUint16(10, 8, true)
  central.setUint32(20, datos.length, true); central.setUint32(24, crudo.length, true); central.setUint16(28, nombre.length, true)
  central.setUint32(42, 0, true)
  const inicioCentral = 30 + nombre.length + datos.length
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, 1, true); fin.setUint16(10, 1, true)
  fin.setUint32(12, 46 + nombre.length, true); fin.setUint32(16, inicioCentral, true)
  const partes = [local, nombre, datos, central, nombre, fin].map((p) => (p instanceof DataView ? new Uint8Array(p.buffer) : p))
  const zip = new Uint8Array(partes.reduce((n, p) => n + p.length, 0))
  partes.reduce((i, p) => (zip.set(p, i), i + p.length), 0)
  return zip.buffer
}
const celda = (texto: string, extra = '') => `<w:tc>${extra}<w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:tc>`
const fila = (...celdas: string[]) => `<w:tr>${celdas.join('')}</w:tr>`

describe('leer un Word', () => {
  it('saca cada tabla como filas y celdas, respetando celdas combinadas', async () => {
    const tabla = `<w:tbl>${fila(celda('Docente'), celda('Asignatura'), celda('Grupos'), celda('I.H.'))}${fila(celda('Ana Ruiz'), celda('Matemáticas'), celda('6-1, 6-2'), celda('5'))}${fila('<w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>', celda('Física', '<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'), celda('3'))}</w:tbl>`
    const tablas = await leerDocx(await docx(`<w:p><w:r><w:t>Asignación 2027</w:t></w:r></w:p>${tabla}`))
    expect(tablas).toEqual([[
      ['Asignación 2027'],
      ['Docente', 'Asignatura', 'Grupos', 'I.H.'],
      ['Ana Ruiz', 'Matemáticas', '6-1, 6-2', '5'],
      ['', 'Física', '', '3'],
    ]])
  })
  it('un archivo que no es un Word se rechaza con un mensaje claro', async () => {
    await expect(leerDocx(new TextEncoder().encode('hola').buffer)).rejects.toThrow(/no es un documento de Word/)
  })
})

const t = (str: string, x: number, y: number, ancho = str.length * 5): Trozo => ({ str, x, y, ancho })

describe('ordenar el texto de un PDF en tablas', () => {
  it('agrupa por renglón y por columna aunque los textos no empiecen exactamente en el mismo punto', () => {
    const trozos = [
      t('Intensidad horaria 2027', 40, 800),
      t('Área', 40, 760), t('6°', 200, 760), t('7°', 260, 760),
      t('Matemáticas', 40, 740), t('5', 202, 740), t('4', 263, 740),
      t('Lengua', 40, 720), t('Castellana', 72, 720), t('5', 201, 720),
    ]
    expect(tablasDeTexto([trozos])).toEqual([[
      ['Intensidad horaria 2027', '', ''],
      ['Área', '6°', '7°'],
      ['Matemáticas', '5', '4'],
      ['Lengua Castellana', '5', ''],
    ]])
  })
  it('parte en tablas distintas cuando aparece otro encabezado', () => {
    const filas = [['Área', '6°', '7°'], ['Matemáticas', '5', '5'], ['Docente', 'Área', 'Grupos'], ['Ana', 'Matemáticas', '6-1']]
    expect(partirEnTablas(filas)).toEqual([filas.slice(0, 2), filas.slice(2)])
  })
  it('un PDF sin texto (escaneado) no da tablas', () => {
    expect(tablasDeTexto([[], []])).toEqual([])
  })
})
