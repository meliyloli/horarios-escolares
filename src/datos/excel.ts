import writeExcelFile from 'write-excel-file/universal'
import { DESCANSOS_DESPUES_DE, diasHorario, FRANJAS, nombreDia } from '../dominio/tiempo'
import type { Estado, Id, Jornada } from '../dominio/tipos'
import { tablaDe, tablaGeneral, tablaSabana, tablasDe, vistasDeAula, type Celda, type Tabla, type TipoVista } from '../dominio/vistas'

export interface Hoja {
  nombre: string
  filas: string[][]
  /** Índice de la fila de encabezado de la tabla. */
  encabezado: number
}

const texto = (celdas: Celda[]): string => celdas.map((c) => c.lineas.join('\n')).join('\n———\n')

const hojaDeTabla = (e: Estado, t: Tabla): Omit<Hoja, 'nombre'> => {
  const dias = diasHorario(e)
  const filas: string[][] = [[t.titulo], [t.subtitulo ?? ''], ['Franja', ...t.dias.map((d) => nombreDia(d, dias))]]
  for (let f = 1; f <= FRANJAS; f++) {
    filas.push([String(f), ...t.celdas.map((dia) => texto(dia[f - 1]))])
    if (DESCANSOS_DESPUES_DE.includes(f)) filas.push(['Descanso', ...t.dias.map(() => '')])
  }
  return { filas, encabezado: 2 }
}

/** Excel no admite nombres de hoja repetidos, de más de 31 letras o con []:*?/\ */
const nombresUnicos = (nombres: string[]): string[] => {
  const usados = new Set<string>()
  return nombres.map((n) => {
    const limpio = n.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Hoja'
    let nombre = limpio.slice(0, 31)
    for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${limpio.slice(0, 31 - ` (${i})`.length)} (${i})`
    usados.add(nombre.toLowerCase())
    return nombre
  })
}

/** Contenido del libro: una hoja con el horario general, o una hoja por docente, grupo o aula (todos, o solo los de `soloIds`). */
export const hojasExcel = (e: Estado, tipo: TipoVista, soloIds?: Id[], jornada?: Jornada): Hoja[] => {
  if (tipo === 'general') {
    const g = tablaGeneral(e, undefined, jornada)
    const dias = diasHorario(e)
    const franjas = Array.from({ length: FRANJAS }, (_, i) => i + 1)
    return [{
      nombre: 'Horario general',
      encabezado: 2,
      filas: [
        [`${e.colegio.nombre} — Horario general${jornada ? ` · ${jornada === 'manana' ? 'mañana' : 'tarde'}` : ''}`],
        [''],
        ['Docente', ...g.dias.flatMap((d) => franjas.map((f) => `${nombreDia(d, dias)} ${f}`))],
        ...g.docentes.map((d, i) => [d.nombre, ...g.celdas[i].flatMap((dia) => dia.map(texto))]),
      ],
    }]
  }
  const ids = soloIds?.length ? soloIds : tipo === 'docente' ? e.docentes.map((d) => d.id) : tipo === 'grupo' ? e.grupos.map((g) => g.id) : vistasDeAula(e).map((v) => v.id)
  const tablas = ids.flatMap((id) => tablasDe(e, tipo, id, undefined, jornada))
  const nombres = nombresUnicos(tablas.map((t) => t.titulo))
  return tablas.map((t, i) => ({ nombre: nombres[i], ...hojaDeTabla(e, t) }))
}

const NOMBRE_SABANA = { grupo: 'Todos los grupos', docente: 'Todos los docentes', aula: 'Todas las aulas' }

/** Todos los grupos (o docentes, o aulas) en una sola hoja: una fila por cada uno y una columna por día y franja. */
export const hojaSabana = (e: Estado, tipo: Exclude<TipoVista, 'general'>, jornada?: Jornada): Hoja => {
  const s = tablaSabana(e, tipo, undefined, jornada)
  const dias = diasHorario(e)
  const franjas = Array.from({ length: FRANJAS }, (_, i) => i + 1)
  return {
    nombre: NOMBRE_SABANA[tipo],
    encabezado: 2,
    filas: [
      [`${e.colegio.nombre} — ${s.titulo}`],
      [[...s.codigos].map(([id, c]) => `${c}: ${e.areas.find((a) => a.id === id)?.nombre}`).join(' · ')],
      [tipo === 'grupo' ? 'Grupo' : tipo === 'docente' ? 'Docente' : 'Aula', ...s.dias.flatMap((d) => franjas.map((f) => `${nombreDia(d, dias)} ${f}`))],
      ...s.filas.map((fila) => [fila.nombre, ...fila.celdas.flatMap((dia) => dia.map(texto))]),
    ],
  }
}

export const libroExcel = (e: Estado, tipo: TipoVista, soloIds?: Id[], jornada?: Jornada): Promise<Blob> => {
  const hojas = hojasExcel(e, tipo, soloIds, jornada)
  if (hojas.length === 0) hojas.push({ nombre: 'Sin datos', filas: [['No hay datos para exportar.']], encabezado: -1 })
  return writeExcelFile(
    hojas.map((h) => ({
      sheet: h.nombre,
      orientation: 'landscape' as const,
      columns: h.filas[Math.max(h.encabezado, 0)].map((_, i) => ({ width: i === 0 ? (tipo === 'general' ? 28 : 10) : 22 })),
      stickyRowsCount: h.encabezado + 1,
      stickyColumnsCount: 1,
      data: h.filas.map((fila, i) =>
        fila.map((valor) => ({
          value: valor,
          wrap: true,
          alignVertical: 'top' as const,
          ...(i === h.encabezado || i === 0 ? { fontWeight: 'bold' as const } : {}),
          ...(i === h.encabezado ? { backgroundColor: '#E7ECF3' } : {}),
        })),
      ),
    })),
  ).toBlob()
}

const NOMBRE_ARCHIVO: Record<TipoVista, string> = {
  general: 'Horario general', docente: 'Horarios por docente', grupo: 'Horarios por grupo', aula: 'Horarios por aula',
}

/** Descarga un archivo desde el navegador. */
export const descargar = (blob: Blob, nombre: string): void => {
  const url = URL.createObjectURL(blob)
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre })
  enlace.click()
  URL.revokeObjectURL(url)
}

export const descargarExcelSabana = async (e: Estado, tipo: Exclude<TipoVista, 'general'>, jornada?: Jornada): Promise<void> => {
  const h = hojaSabana(e, tipo, jornada)
  const blob = await writeExcelFile([{
    sheet: h.nombre, orientation: 'landscape' as const, stickyRowsCount: h.encabezado + 1, stickyColumnsCount: 1,
    columns: h.filas[h.encabezado].map((_, i) => ({ width: i === 0 ? (tipo === 'grupo' ? 8 : 26) : 11 })),
    data: h.filas.map((fila, i) => fila.map((valor) => ({ value: valor, wrap: i > 1, alignVertical: 'top' as const, ...(i === h.encabezado || i === 0 ? { fontWeight: 'bold' as const } : {}) }))),
  }]).toBlob()
  descargar(blob, `${tablaSabana(e, tipo).titulo}${jornada ? ` · ${jornada === 'manana' ? 'mañana' : 'tarde'}` : ''}.xlsx`)
}

export const descargarExcel = async (e: Estado, tipo: TipoVista, soloIds?: Id[], jornada?: Jornada): Promise<void> =>
  descargar(
    await libroExcel(e, tipo, soloIds, jornada),
    (tipo !== 'general' && soloIds?.length === 1 ? `Horario ${tablaDe(e, tipo, soloIds[0]).titulo.replace(/[\\/:*?"<>|]/g, '-')}` : NOMBRE_ARCHIVO[tipo]) +
      `${jornada ? ` · ${jornada === 'manana' ? 'mañana' : 'tarde'}` : ''}.xlsx`,
  )
