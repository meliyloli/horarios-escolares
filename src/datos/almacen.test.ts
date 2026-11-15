import { describe, expect, it } from 'vitest'
import { colegioEjemplo } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { cargarEstado, exportarRespaldo, guardarEstado, importarRespaldo } from './almacen'
import { hojaSabana, hojasExcel, libroExcel } from './excel'

const conHorario = () => {
  const e = colegioEjemplo()
  return { ...e, clases: generarHorario(e, { semilla: 1 }).clases }
}

describe('respaldos', () => {
  it('exportar e importar devuelve el mismo estado', () => {
    const e = conHorario()
    expect(importarRespaldo(exportarRespaldo(e))).toEqual(e)
  })
  it('rechaza un archivo que no es un respaldo, con un mensaje claro', () => {
    expect(() => importarRespaldo('esto no es json')).toThrow(/no es un respaldo/i)
    expect(() => importarRespaldo('{"nombre":"otro programa"}')).toThrow(/no es un respaldo/i)
    expect(() => importarRespaldo('[1,2,3]')).toThrow(/no es un respaldo/i)
    const roto = { ...colegioEjemplo(), docentes: 'ninguno' }
    expect(() => importarRespaldo(JSON.stringify(roto))).toThrow(/dañado/i)
    const sinReglas = { ...colegioEjemplo(), colegio: { nombre: 'x' } }
    expect(() => importarRespaldo(JSON.stringify(sinReglas))).toThrow(/dañado/i)
  })
  it('un respaldo con datos incompletos se completa con valores por defecto o se rechaza con mensaje claro', () => {
    const e = colegioEjemplo()
    const sinListas = JSON.parse(JSON.stringify(e))
    delete sinListas.areas[0].afines
    delete sinListas.docentes[0].noDisponible
    delete sinListas.colegio.modeloAula
    delete sinListas.colegio.reglas.bloques
    sinListas.grupos[0].jornada = 'noche'
    const r = importarRespaldo(JSON.stringify(sinListas))
    expect(r.areas[0].afines).toEqual([])
    expect(r.docentes[0].noDisponible).toEqual([])
    expect(r.colegio.modeloAula).toBe('grupo')
    expect(r.colegio.reglas.bloques).toEqual({ activa: false, primaria: false })
    expect(r.grupos[0].jornada).toBe('manana')
    const roto = JSON.parse(JSON.stringify(e))
    roto.docentes[0] = 'no es un docente'
    expect(() => importarRespaldo(JSON.stringify(roto))).toThrow(/dañado/i)
    const sinId = JSON.parse(JSON.stringify(e))
    delete sinId.grupos[0].id
    expect(() => importarRespaldo(JSON.stringify(sinId))).toThrow(/dañado/i)
  })
  it('el respaldo conserva las versiones completas y su nombre; una versión dañada se descarta', () => {
    const otra = { ...colegioEjemplo(), docentes: colegioEjemplo().docentes.slice(0, 3) }
    const e = { ...conHorario(), nombreHorario: 'Opción B', borradores: [{ id: 'b1', nombre: 'Opción A', guardado: '2026-11-12T10:00', estado: otra }] }
    expect(importarRespaldo(exportarRespaldo(e))).toEqual(e)
    const danado = JSON.parse(exportarRespaldo(e))
    danado.borradores.push({ nombre: 'sin id' }, 'texto', { id: 'b2', nombre: 'rota', estado: { version: 1 } })
    expect(importarRespaldo(JSON.stringify(danado)).borradores).toHaveLength(1)
  })
  it('un borrador del formato anterior (solo asignación y horario) se vuelve una versión completa', () => {
    const e = conHorario()
    const viejo = { ...JSON.parse(exportarRespaldo(e)), borradores: [{ id: 'b1', nombre: 'Vieja', guardado: 't', asignaciones: e.asignaciones.slice(0, 5), clases: [] }] }
    const [v] = importarRespaldo(JSON.stringify(viejo)).borradores!
    expect(v.nombre).toBe('Vieja')
    expect(v.estado.asignaciones).toEqual(e.asignaciones.slice(0, 5))
    expect(v.estado.docentes).toEqual(e.docentes)
    expect(v.estado.clases).toEqual([])
  })
  it('al importar descarta clases que apuntan a asignaciones que no existen', () => {
    const e = conHorario()
    e.clases.push({ id: 'huerfana', asignacionId: 'no-existe', dia: 1, franja: 1, fijada: false })
    expect(importarRespaldo(JSON.stringify(e)).clases.some((c) => c.id === 'huerfana')).toBe(false)
  })
  it('sin almacenamiento del navegador arranca con el colegio de ejemplo y avisa que no pudo guardar', () => {
    expect(cargarEstado().colegio.nombre).toBe(colegioEjemplo().colegio.nombre)
    expect(guardarEstado(colegioEjemplo())).toBe(false)
  })
})

describe('excel', () => {
  it('la sábana de grupos es una sola hoja con una fila por grupo y una columna por franja', () => {
    const e = conHorario()
    const h = hojaSabana(e, 'grupo')
    expect(h.nombre).toBe('Todos los grupos')
    expect(h.filas[h.encabezado]).toHaveLength(1 + 30)
    expect(h.filas.length - h.encabezado - 1).toBe(e.grupos.length)
  })
  it('una hoja por docente con encabezado, 6 franjas y 2 descansos', () => {
    const e = conHorario()
    const hojas = hojasExcel(e, 'docente')
    expect(hojas).toHaveLength(e.docentes.length)
    const [hoja] = hojas
    expect(hoja.filas[0][0]).toBe(e.docentes[0].nombre)
    const cuerpo = hoja.filas.slice(hoja.filas.findIndex((f) => f[0] === 'Franja'))
    expect(cuerpo[0]).toEqual(['Franja', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'])
    expect(cuerpo.map((f) => f[0])).toEqual(['Franja', '1', '2', 'Descanso', '3', '4', 'Descanso', '5', '6'])
    expect(cuerpo.flat().some((t) => t.includes('Aula'))).toBe(true)
  })
  it('los nombres de hoja son únicos y válidos para Excel', () => {
    const e = conHorario()
    e.docentes[1].nombre = e.docentes[0].nombre = 'Nombre larguísimo de docente con [caracteres] raros: */?'
    const nombres = hojasExcel(e, 'docente').map((h) => h.nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
    expect(nombres.every((n) => n.length <= 31 && !/[[\]:*?/\\]/.test(n))).toBe(true)
  })
  it('el horario general es una sola hoja con una fila por docente', () => {
    const e = conHorario()
    const [hoja, ...resto] = hojasExcel(e, 'general')
    expect(resto).toEqual([])
    expect(hoja.filas.filter((f) => e.docentes.some((d) => d.nombre === f[0]))).toHaveLength(e.docentes.length)
  })
  it('genera un archivo .xlsx real', async () => {
    const blob = await libroExcel(conHorario(), 'grupo')
    const inicio = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
    expect([...inicio]).toEqual([0x50, 0x4b]) // "PK": un .xlsx es un zip
    expect(blob.size).toBeGreaterThan(3000)
  })
})
