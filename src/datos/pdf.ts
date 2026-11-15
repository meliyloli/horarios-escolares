import { jsPDF } from 'jspdf'
import { DESCANSOS_DESPUES_DE, diasHorario, FRANJAS, nombreDia } from '../dominio/tiempo'
import type { AjusteDia, Estado, Id, Jornada } from '../dominio/tipos'
import { tablaDe, tablaGeneral, tablaSabana, tablasDe, type Celda, type TipoVista } from '../dominio/vistas'
import { colorDeArea, TINTA, tintaSobre } from '../ui/colores'
import { descargar } from './excel'

// Carta horizontal, en milímetros.
const ANCHO = 279.4
const ALTO = 215.9
const MARGEN = 10
const LINEA = '#C9D4E5'
const SUAVE = '#5B6B86'
const PT = 0.3528 // milímetros por punto tipográfico

type Pdf = jsPDF
/** Ancho y alto de la hoja (carta u oficio). */
const hoja = (pdf: Pdf) => ({ ancho: pdf.internal.pageSize.getWidth(), alto: pdf.internal.pageSize.getHeight() })

const fechaLarga = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Encabezado de la hoja; devuelve dónde empieza lo de abajo. */
const cabeza = (pdf: Pdf, colegio: string, titulo: string, detalle: (string | undefined)[]): number => {
  pdf.setTextColor(TINTA)
  pdf.setFont('helvetica', 'bold').setFontSize(17)
  pdf.text(titulo, MARGEN, MARGEN + 6)
  pdf.setFontSize(10.5)
  pdf.text(colegio, hoja(pdf).ancho - MARGEN, MARGEN + 6, { align: 'right' })
  const linea = detalle.filter(Boolean).join('  ·  ')
  if (linea) {
    pdf.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(SUAVE)
    pdf.text(linea, MARGEN, MARGEN + 11.5)
  }
  return MARGEN + 15
}

/** Escribe líneas centradas en un recuadro, achicando la letra hasta que quepan. La primera va en negrita. */
const textoEn = (pdf: Pdf, lineas: string[], x: number, y: number, w: number, h: number, color: string, maximo: number) => {
  let tam = maximo
  let partidas: string[][] = []
  for (; tam >= 5; tam -= 0.5) {
    pdf.setFontSize(tam)
    partidas = lineas.map((l, i) => pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal').splitTextToSize(l, w - 2.4) as string[])
    // Cabe cuando entran todas las líneas y ninguna palabra queda partida.
    const enteras = lineas.every((l, i) => pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal') && l.split(' ').every((p) => pdf.getTextWidth(p) <= w - 2.4))
    if (enteras && partidas.flat().length * tam * PT * 1.18 <= h - 1.6) break
  }
  const alto = tam * PT * 1.18
  const total = partidas.flat().length * alto
  let cy = y + (h - total) / 2 + alto * 0.8
  pdf.setTextColor(color)
  partidas.forEach((trozos, i) => {
    pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    for (const t of trozos) {
      if (cy > y + h) return
      pdf.text(t, x + w / 2, cy, { align: 'center' })
      cy += alto
    }
  })
}

/** Una celda del horario: vacía, una clase o varias (cruce), cada una con el color de su área. */
const celda = (pdf: Pdf, celdas: Celda[], x: number, y: number, w: number, h: number, color: (c: Celda) => string, maximo: number) => {
  if (celdas.length === 0) {
    pdf.setDrawColor(LINEA).setLineWidth(0.25)
    pdf.roundedRect(x, y, w, h, 1.2, 1.2, 'S')
    return
  }
  const parte = h / celdas.length
  celdas.forEach((c, i) => {
    const fondo = color(c)
    pdf.setFillColor(fondo)
    pdf.roundedRect(x, y + i * parte + (i ? 0.4 : 0), w, parte - (i ? 0.4 : 0), 1.2, 1.2, 'F')
    textoEn(pdf, c.lineas, x, y + i * parte, w, parte, tintaSobre(fondo), maximo)
  })
}

type Etiqueta = (a: Estado['areas'][0]) => string

/** Áreas que aparecen en la hoja, con su color, al pie. */
const leyenda = (pdf: Pdf, e: Estado, areas: Set<Id>, etiqueta: Etiqueta = (a) => a.nombre) => {
  const { ancho, alto } = hoja(pdf)
  const items = e.areas.filter((a) => areas.has(a.id))
  pdf.setFont('helvetica', 'normal').setFontSize(8)
  let [x, y] = [MARGEN, alto - MARGEN - 1]
  const filas: { a: (typeof items)[0]; x: number }[][] = [[]]
  for (const a of items) {
    const w = 5 + pdf.getTextWidth(etiqueta(a)) + 5
    if (x + w > ancho - MARGEN) [x, filas[filas.length]] = [MARGEN, []]
    filas[filas.length - 1].push({ a, x })
    x += w
  }
  y -= (filas.length - 1) * 4.5
  for (const fila of filas) {
    for (const { a, x: ix } of fila) {
      pdf.setFillColor(colorDeArea(e, a.id))
      pdf.roundedRect(ix, y - 2.6, 3.4, 3.4, 0.6, 0.6, 'F')
      pdf.setTextColor(TINTA)
      pdf.text(etiqueta(a), ix + 4.6, y)
    }
    y += 4.5
  }
}
const altoLeyenda = (pdf: Pdf, e: Estado, areas: Set<Id>, etiqueta: Etiqueta = (a) => a.nombre) => {
  pdf.setFont('helvetica', 'normal').setFontSize(8)
  let [x, filas] = [MARGEN, 1]
  for (const a of e.areas.filter((z) => areas.has(z.id))) {
    const w = 5 + pdf.getTextWidth(etiqueta(a)) + 5
    if (x + w > hoja(pdf).ancho - MARGEN) [x, filas] = [MARGEN, filas + 1]
    x += w
  }
  return filas * 4.5 + 3
}

const franjaDescanso = (pdf: Pdf, x: number, y: number, w: number, h: number) => {
  pdf.setFillColor('#EEF2F8')
  pdf.rect(x, y, w, h, 'F')
  pdf.setFont('helvetica', 'normal').setFontSize(7).setTextColor(SUAVE)
  pdf.text('Descanso', x + w / 2, y + h / 2 + 1, { align: 'center' })
}

/**
 * El horario en PDF, como se imprime: una hoja por cada docente, grupo o aula de `ids`,
 * o una por día (partida si no caben todos los docentes) en la vista general.
 */
const JORNADA = { manana: 'Jornada de la mañana', tarde: 'Jornada de la tarde' }
const CORTA = { manana: 'mañana', tarde: 'tarde' }

/** `jornada`: solo esa jornada (para sacar la versión de la mañana o de la tarde). */
export const pdfHorario = (e: Estado, tipo: TipoVista, ids: Id[], ajuste?: AjusteDia, fecha?: string, jornada?: Jornada): Pdf => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  pdf.setProperties({ title: `Horario · ${e.colegio.nombre}`, creator: 'Horarios escolares' })
  const dias = diasHorario(e)
  const asignaciones = new Map(e.asignaciones.map((a) => [a.id, a]))
  const areaDe = new Map(e.clases.map((c) => [c.id, asignaciones.get(c.asignacionId)?.areaId ?? '']))
  const color = (c: Celda) => colorDeArea(e, areaDe.get(c.claseId ?? '') ?? '')
  const areasDe = (celdas: Celda[]) => new Set(celdas.map((c) => areaDe.get(c.claseId ?? '') ?? ''))
  const cuando = fecha ? fechaLarga(fecha) : undefined
  let hojas = 0
  const nuevaHoja = () => hojas++ > 0 && pdf.addPage()

  if (tipo === 'general') {
    const g = tablaGeneral(e, ajuste, jornada)
    const porHoja = 24
    g.dias.forEach((dia, j) => {
      for (let desde = 0; desde < g.docentes.length || desde === 0; desde += porHoja) {
        nuevaHoja()
        const filas = g.docentes.slice(desde, desde + porHoja)
        const celdas = filas.map((_, k) => g.celdas[desde + k][j])
        const areas = areasDe(celdas.flat(2))
        const titulo = `Horario general · ${nombreDia(dia, dias)}${desde > 0 ? ' (continuación)' : ''}`
        const y0 = cabeza(pdf, e.colegio.nombre, titulo, [jornada && JORNADA[jornada], cuando])
        const abajo = ALTO - MARGEN - altoLeyenda(pdf, e, areas)
        const nombreW = 48
        const sep = 3 // espacio de cada descanso entre columnas
        const colW = (ANCHO - 2 * MARGEN - nombreW - sep * DESCANSOS_DESPUES_DE.length) / FRANJAS
        const cabezaH = 6
        const filaH = Math.min(14, (abajo - y0 - cabezaH) / Math.max(filas.length, 1))
        const xDe = (f: number) => MARGEN + nombreW + (f - 1) * colW + DESCANSOS_DESPUES_DE.filter((d) => d < f).length * sep
        pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(TINTA)
        for (let f = 1; f <= FRANJAS; f++) pdf.text(`Franja ${f}`, xDe(f) + colW / 2, y0 + 4, { align: 'center' })
        filas.forEach((d, k) => {
          const y = y0 + cabezaH + k * filaH
          pdf.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(TINTA)
          pdf.text(pdf.splitTextToSize(d.nombre, nombreW - 3)[0] as string, MARGEN, y + filaH / 2 + 1)
          for (let f = 1; f <= FRANJAS; f++) celda(pdf, celdas[k][f - 1], xDe(f) + 0.4, y + 0.4, colW - 0.8, filaH - 0.8, color, 7.5)
        })
        leyenda(pdf, e, areas)
      }
    })
    return pdf
  }

  for (const t of ids.flatMap((id) => tablasDe(e, tipo, id, ajuste, jornada))) {
    nuevaHoja()
    const areas = areasDe(t.celdas.flat(2))
    const y0 = cabeza(pdf, e.colegio.nombre, t.titulo, [t.subtitulo, cuando])
    const abajo = ALTO - MARGEN - altoLeyenda(pdf, e, areas)
    const franjaW = 16
    const colW = (ANCHO - 2 * MARGEN - franjaW) / t.dias.length
    const cabezaH = 7
    const descansoH = 4.5
    const filaH = (abajo - y0 - cabezaH - descansoH * DESCANSOS_DESPUES_DE.length) / FRANJAS
    pdf.setFillColor('#E7ECF3')
    pdf.roundedRect(MARGEN, y0, ANCHO - 2 * MARGEN, cabezaH, 1.2, 1.2, 'F')
    pdf.setFont('helvetica', 'bold').setFontSize(t.dias.length > 5 ? 8.5 : 10).setTextColor(TINTA)
    pdf.text('Franja', MARGEN + franjaW / 2, y0 + 4.8, { align: 'center' })
    t.dias.forEach((d, k) => pdf.text(nombreDia(d, dias), MARGEN + franjaW + k * colW + colW / 2, y0 + 4.8, { align: 'center' }))
    let y = y0 + cabezaH + 0.8
    for (let f = 1; f <= FRANJAS; f++) {
      pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(TINTA)
      pdf.text(String(f), MARGEN + franjaW / 2, y + filaH / 2 + 1.5, { align: 'center' })
      t.dias.forEach((_, k) => celda(pdf, t.celdas[k][f - 1], MARGEN + franjaW + k * colW + 0.5, y + 0.5, colW - 1, filaH - 1, color, t.dias.length > 5 ? 8 : 9.5))
      y += filaH
      if (DESCANSOS_DESPUES_DE.includes(f)) {
        franjaDescanso(pdf, MARGEN, y + 0.4, ANCHO - 2 * MARGEN, descansoH - 0.8)
        y += descansoH
      }
    }
    leyenda(pdf, e, areas)
  }
  return pdf
}

/**
 * Todos los grupos (o docentes, o aulas) juntos en una tabla por semana, en hoja oficio: una fila por cada uno,
 * con el código del área en cada celda. Si no caben todas las filas, la tabla sigue en otra hoja.
 */
export const pdfSabana = (e: Estado, tipo: Exclude<TipoVista, 'general'>, ajuste?: AjusteDia, fecha?: string, jornada?: Jornada): Pdf => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
  pdf.setProperties({ title: `Horario · ${e.colegio.nombre}`, creator: 'Horarios escolares' })
  const { ancho, alto } = hoja(pdf)
  const s = tablaSabana(e, tipo, ajuste, jornada)
  const dias = diasHorario(e)
  const asignaciones = new Map(e.asignaciones.map((a) => [a.id, a]))
  const areaDe = new Map(e.clases.map((c) => [c.id, asignaciones.get(c.asignacionId)?.areaId ?? '']))
  const color = (c: Celda) => colorDeArea(e, areaDe.get(c.claseId ?? '') ?? '')
  const etiqueta: Etiqueta = (a) => `${s.codigos.get(a.id)}  ${a.nombre}`
  const cuando = fecha ? fechaLarga(fecha) : undefined
  const semanas = Array.from({ length: Math.ceil(s.dias.length / 5) }, (_, k) => s.dias.slice(k * 5, k * 5 + 5).map((_, i) => k * 5 + i))
  const nombreW = tipo === 'grupo' ? 14 : 40
  const [diaGap, descanso, cabezaH, filaMin] = [2.5, 0.9, 10, 7.5]
  let hojas = 0

  for (const semana of semanas) {
    const colW = (ancho - 2 * MARGEN - nombreW - semana.length * (diaGap + 2 * descanso)) / (semana.length * FRANJAS)
    const xDe = (k: number, f: number) =>
      MARGEN + nombreW + k * (FRANJAS * colW + diaGap + 2 * descanso) + diaGap + (f - 1) * colW + (f > 2 ? descanso : 0) + (f > 4 ? descanso : 0)
    let desde = 0
    do {
      if (hojas++ > 0) pdf.addPage()
      const titulo = s.titulo + (semanas.length > 1 ? ` · ${nombreDia(s.dias[semana[0]], dias)} a ${nombreDia(s.dias[semana.at(-1)!], dias)}` : '') + (desde > 0 ? ' (continuación)' : '')
      const y0 = cabeza(pdf, e.colegio.nombre, titulo, [jornada && JORNADA[jornada], cuando])
      const libre = alto - MARGEN - altoLeyenda(pdf, e, new Set(e.areas.map((a) => a.id)), etiqueta) - y0 - cabezaH
      const porHoja = Math.max(1, Math.floor(libre / filaMin))
      const filas = s.filas.slice(desde, desde + porHoja)
      const filaH = Math.min(13, libre / Math.max(filas.length, 1))
      semana.forEach((d, k) => {
        pdf.setFillColor('#E7ECF3')
        pdf.roundedRect(xDe(k, 1) - 0.3, y0, FRANJAS * colW + 2 * descanso + 0.6, cabezaH - 0.8, 1.2, 1.2, 'F')
        pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(TINTA)
        pdf.text(nombreDia(s.dias[d], dias), xDe(k, 1) + (FRANJAS * colW + 2 * descanso) / 2, y0 + 4, { align: 'center' })
        pdf.setFont('helvetica', 'normal').setFontSize(7).setTextColor(SUAVE)
        for (let f = 1; f <= FRANJAS; f++) pdf.text(String(f), xDe(k, f) + colW / 2, y0 + 8, { align: 'center' })
      })
      const areas = new Set<Id>()
      filas.forEach((fila, r) => {
        const y = y0 + cabezaH + r * filaH
        if (r % 2) {
          pdf.setFillColor('#F4F7FB')
          pdf.rect(MARGEN, y, ancho - 2 * MARGEN, filaH, 'F')
        }
        pdf.setFont('helvetica', 'bold').setFontSize(tipo === 'grupo' ? 9 : 8).setTextColor(TINTA)
        pdf.text(pdf.splitTextToSize(fila.nombre, nombreW - 1.5)[0] as string, MARGEN + 0.8, y + filaH / 2 + 1.2)
        semana.forEach((d, k) => {
          for (let f = 1; f <= FRANJAS; f++) {
            const cs = fila.celdas[d][f - 1]
            cs.forEach((c) => areas.add(areaDe.get(c.claseId ?? '') ?? ''))
            celda(pdf, cs, xDe(k, f) + 0.25, y + 0.35, colW - 0.5, filaH - 0.7, color, 7)
          }
        })
      })
      leyenda(pdf, e, areas, etiqueta)
      desde += porHoja
    } while (desde < s.filas.length)
  }
  return pdf
}

const PLURAL: Record<Exclude<TipoVista, 'general'>, string> = { docente: 'docente', grupo: 'grupo', aula: 'aula' }

export const nombreArchivoPdf = (e: Estado, tipo: TipoVista, ids: Id[], fecha?: string, jornada?: Jornada): string => {
  const base =
    tipo === 'general' ? 'Horario general'
    : ids.length === 1 ? `Horario ${tablaDe(e, tipo, ids[0]).titulo}`
    : `Horarios por ${PLURAL[tipo]}`
  return `${base.replace(/[\\/:*?"<>|]/g, '-')}${jornada ? ` · ${CORTA[jornada]}` : ''}${fecha ? ` ${fecha}` : ''}.pdf`
}

export const nombreArchivoSabana = (e: Estado, tipo: Exclude<TipoVista, 'general'>, fecha?: string, jornada?: Jornada): string =>
  `${tablaSabana(e, tipo).titulo}${jornada ? ` · ${CORTA[jornada]}` : ''}${fecha ? ` ${fecha}` : ''}.pdf`

export const descargarPdfSabana = (e: Estado, tipo: Exclude<TipoVista, 'general'>, ajuste?: AjusteDia, fecha?: string, jornada?: Jornada): void =>
  descargar(pdfSabana(e, tipo, ajuste, fecha, jornada).output('blob'), nombreArchivoSabana(e, tipo, fecha, jornada))

export const descargarPdf = (e: Estado, tipo: TipoVista, ids: Id[], ajuste?: AjusteDia, fecha?: string, jornada?: Jornada): void =>
  descargar(pdfHorario(e, tipo, ids, ajuste, fecha, jornada).output('blob'), nombreArchivoPdf(e, tipo, ids, fecha, jornada))
