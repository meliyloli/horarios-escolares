import { describe, expect, it } from 'vitest'
import { colegioEjemplo } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { asg, cls, doc, grp, mini } from '../dominio/ayudaPruebas'
import { hojasExcel } from './excel'
import { nombreArchivoPdf, nombreArchivoSabana, pdfHorario, pdfSabana } from './pdf'

const e = (() => {
  const x = colegioEjemplo()
  return { ...x, clases: generarHorario(x, { semilla: 1 }).clases }
})()

describe('horario en PDF', () => {
  it('una hoja por grupo, con el título, el colegio, los días y las clases', () => {
    const ids = e.grupos.filter((g) => g.grado >= 6).slice(0, 3).map((g) => g.id)
    const pdf = pdfHorario(e, 'grupo', ids)
    expect(pdf.getNumberOfPages()).toBe(3)
    const texto = pdf.output()
    expect(texto).toContain('Grupo 6-1')
    expect(texto).toContain('Lunes')
    expect(texto).toContain('Descanso')
    expect(texto).toContain('Matem') // Matemáticas, con la tilde en la codificación del PDF
  })
  it('el horario general sale por día y parte en varias hojas si no caben todos los docentes', () => {
    const muchos = { ...e, docentes: [...e.docentes, ...e.docentes.map((d) => ({ ...d, id: `${d.id}-b` })), ...e.docentes.map((d) => ({ ...d, id: `${d.id}-c` }))] }
    expect(pdfHorario(e, 'general', []).getNumberOfPages()).toBe(5)
    expect(pdfHorario(muchos, 'general', []).getNumberOfPages()).toBeGreaterThan(5)
  })
  it('el nombre del archivo dice qué horario es', () => {
    expect(nombreArchivoPdf(e, 'grupo', [e.grupos.find((g) => g.grado === 6 && g.numero === 1)!.id])).toBe('Horario Grupo 6-1.pdf')
    expect(nombreArchivoPdf(e, 'docente', e.docentes.map((d) => d.id))).toBe('Horarios por docente.pdf')
    expect(nombreArchivoPdf(e, 'general', [], '2026-11-12')).toBe('Horario general 2026-11-12.pdf')
  })
})

describe('sábana en PDF', () => {
  it('todos los grupos en una sola hoja de tamaño oficio, con la leyenda de códigos', () => {
    const pdf = pdfSabana(e, 'grupo')
    expect(pdf.getNumberOfPages()).toBe(1)
    expect(Math.round(pdf.internal.pageSize.getWidth())).toBe(356)
    const texto = pdf.output()
    for (const t of ['Horario de todos los grupos', '6-1', '11-1', 'Lunes', 'Viernes', 'MAT', 'Matem']) expect(texto).toContain(t)
  })
  it('si no caben todos los docentes, sigue en otra hoja; el ciclo de 10 días va en dos semanas', () => {
    const muchos = { ...e, docentes: [...e.docentes, ...e.docentes.map((d) => ({ ...d, id: `${d.id}-b` })), ...e.docentes.map((d) => ({ ...d, id: `${d.id}-c` }))] }
    expect(pdfSabana(e, 'docente').getNumberOfPages()).toBe(1)
    expect(pdfSabana(muchos, 'docente').getNumberOfPages()).toBe(3)
    expect(pdfSabana({ ...e, colegio: { ...e.colegio, ciclo: 10 } }, 'grupo').getNumberOfPages()).toBe(2)
  })
})

describe('descargas por jornada', () => {
  const dos = () =>
    mini({
      grupos: [grp('a', 7), grp('b', 8, { jornada: 'tarde' })],
      docentes: [doc('d', { nombre: 'Ana Ruiz', jornada: 'ambas', cargaSemanal: 2 }), doc('x', { nombre: 'Luis Gil', jornada: 'tarde', cargaSemanal: 1 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1), asg('x', 'b', 'len', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1), cls('x|b|len', 1, 2)],
    })
  it('el general de la tarde solo trae a los docentes de la tarde y lo dice en el título', () => {
    const texto = pdfHorario(dos(), 'general', [], undefined, undefined, 'tarde').output()
    expect(texto).toContain('Jornada de la tarde')
    expect(texto).toContain('Luis Gil')
    expect(texto).not.toContain('7-1')
  })
  it('un docente de mañana y tarde sale en una hoja por jornada', () => {
    expect(pdfHorario(dos(), 'docente', ['d']).getNumberOfPages()).toBe(2)
    expect(pdfHorario(dos(), 'docente', ['d'], undefined, undefined, 'manana').getNumberOfPages()).toBe(1)
    expect(hojasExcel(dos(), 'docente', ['d']).map((h) => h.nombre)).toEqual(['Ana Ruiz · mañana', 'Ana Ruiz · tarde'])
  })
  it('el archivo dice la jornada', () => {
    expect(nombreArchivoPdf(dos(), 'grupo', ['a', 'b'], undefined, 'manana')).toBe('Horarios por grupo · mañana.pdf')
    expect(nombreArchivoSabana(dos(), 'docente', undefined, 'tarde')).toBe('Horario de todos los docentes · tarde.pdf')
  })
})
