import { describe, expect, it } from 'vitest'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { abrirColegio, borrarColegio, leerColegios, type ColegioGuardado } from './colegios'

const llamado = (nombre: string) => ({ ...colegioEjemplo(), colegio: { ...colegioEjemplo().colegio, nombre } })

describe('varios colegios', () => {
  it('abrir otro colegio deja el abierto guardado en su lugar de la lista', () => {
    const otros: ColegioGuardado[] = [{ id: 'a', guardado: 't0', estado: llamado('Colegio A') }, { id: 'b', guardado: 't0', estado: llamado('Colegio B') }]
    const r = abrirColegio(otros, llamado('Colegio X'), 'a', 't1')
    expect(r.estado.colegio.nombre).toBe('Colegio A')
    expect(r.otros.map((c) => c.estado.colegio.nombre)).toEqual(['Colegio X', 'Colegio B'])
    expect(r.otros[0].guardado).toBe('t1')
  })
  it('un colegio nuevo empieza vacío y el abierto pasa a la lista', () => {
    const r = abrirColegio([], llamado('Colegio X'), null, 't1')
    expect(r.estado).toEqual(estadoVacio())
    expect(r.otros.map((c) => c.estado.colegio.nombre)).toEqual(['Colegio X'])
  })
  it('un colegio que no está en la lista no cambia nada', () => {
    const actual = llamado('Colegio X')
    expect(abrirColegio([], actual, 'nada', 't1')).toEqual({ otros: [], estado: actual, enlace: null })
  })
  it('un colegio en línea guarda su enlace al cerrarlo y lo recupera al volver a abrirlo', () => {
    const enlace = { codigo: 'FEYA2026ABCD', id: 'abc', version: 'v1' }
    const r = abrirColegio([], llamado('En línea'), null, 't1', enlace)
    expect(r.otros[0].enlace).toEqual(enlace)
    expect(r.enlace).toBeNull()
    const vuelta = abrirColegio(r.otros, r.estado, r.otros[0].id, 't2')
    expect(vuelta.enlace).toEqual(enlace)
    expect(leerColegios(JSON.stringify(r.otros))[0].enlace).toEqual(enlace)
  })
  it('borrar un colegio de la lista', () => {
    expect(borrarColegio([{ id: 'a', guardado: 't', estado: llamado('A') }], 'a')).toEqual([])
  })
  it('al leer la lista guardada se descarta un colegio dañado y se conservan los demás', () => {
    const texto = JSON.stringify([{ id: 'a', guardado: 't', estado: llamado('A') }, { id: 'b', estado: { version: 1 } }, 'basura'])
    expect(leerColegios(texto).map((c) => c.estado.colegio.nombre)).toEqual(['A'])
    expect(leerColegios(null)).toEqual([])
    expect(leerColegios('no es json')).toEqual([])
  })
})
