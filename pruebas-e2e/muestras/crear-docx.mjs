// Crea asignacion.docx con tablas de Word de verdad (w:tbl), como las guarda Word. Uso: node pruebas-e2e/muestras/crear-docx.mjs
import fs, { writeFileSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'

const INTENSIDAD = [
  ['ÁREA / ASIGNATURA', '6°', '7°', '8°', '9°', '10°', '11°'],
  ['Matemáticas', '5', '5', '5', '5', '4', '4'],
  ['Humanidades: Lengua Castellana', '5', '5', '5', '5', '4', '4'],
  ['Inglés', '4', '4', '4', '4', '3', '3'],
  ['Ciencias Naturales', '4', '4', '4', '4', '6', '6'],
  ['Emprendimiento', '1', '1', '1', '1', '1', '1'],
  ['TOTAL', '19', '19', '19', '19', '18', '18'],
]
// La primera celda de cada docente está combinada hacia abajo (vMerge), como suele hacerse en Word.
const ASIGNACION = [
  ['DOCENTE', 'ASIGNATURA', 'GRUPOS', 'I.H.'],
  [['Ana María Ruiz Gómez', 'inicia'], 'Matemáticas', '6-1, 6-2, 7-1, 7-2', '5'],
  [['', 'sigue'], 'Emprendimiento', '601, 602', '1'],
  [['Luis Fernando Gil', 'inicia'], 'Lengua Castellana', '6°1 y 6°2', '5'],
  [['', 'sigue'], 'Inglés', '7-1, 7-2', '4'],
]
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const parrafo = (t, negrita = false) => `<w:p><w:r>${negrita ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`
const celda = (c, negrita) => {
  const [texto, combina] = Array.isArray(c) ? c : [c]
  const merge = combina === 'inicia' ? '<w:vMerge w:val="restart"/>' : combina === 'sigue' ? '<w:vMerge/>' : ''
  return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${merge}</w:tcPr>${texto ? parrafo(texto, negrita) : '<w:p/>'}</w:tc>`
}
const tabla = (filas) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${filas[0].map(() => '<w:gridCol w:w="1800"/>').join('')}</w:tblGrid>` +
  filas.map((f, i) => `<w:tr>${f.map((c) => celda(c, i === 0)).join('')}</w:tr>`).join('') + '</w:tbl>'

const CUERPO = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null
const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${CUERPO ? CUERPO.map((b) => (typeof b === 'string' ? parrafo(b, true) : tabla(b))).join('') : `${parrafo('Institución Educativa Las Palmas', true)}${parrafo('Plan de estudios y asignación académica 2027 (datos ficticios de prueba)')}${tabla(INTENSIDAD)}${parrafo('')}${tabla(ASIGNACION)}`}<w:sectPr/></w:body></w:document>`
const archivos = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': documento,
}

const partes = []
const central = []
let desplazamiento = 0
for (const [nombre, contenido] of Object.entries(archivos)) {
  const crudo = Buffer.from(contenido)
  const datos = deflateRawSync(crudo)
  const n = Buffer.from(nombre)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8)
  local.writeUInt32LE(crc32(crudo), 14); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(crudo.length, 22); local.writeUInt16LE(n.length, 26)
  const c = Buffer.alloc(46)
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10)
  c.writeUInt32LE(crc32(crudo), 16); c.writeUInt32LE(datos.length, 20); c.writeUInt32LE(crudo.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(desplazamiento, 42)
  partes.push(local, n, datos)
  central.push(c, n)
  desplazamiento += 30 + n.length + datos.length
}
const tamCentral = central.reduce((s, b) => s + b.length, 0)
const fin = Buffer.alloc(22)
fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(archivos).length, 8); fin.writeUInt16LE(Object.keys(archivos).length, 10)
fin.writeUInt32LE(tamCentral, 12); fin.writeUInt32LE(desplazamiento, 16)
writeFileSync(process.argv[2] ?? 'pruebas-e2e/muestras/asignacion.docx', Buffer.concat([...partes, ...central, fin]))
