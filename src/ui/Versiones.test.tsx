// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { nuevoBorrador } from '../dominio/borradores'
import { asg, cls, doc, grp, mini } from '../dominio/ayudaPruebas'
import { colegioEjemplo } from '../dominio/ejemplo'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
  localStorage.clear()
})

const abrir = (nombre: RegExp) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: nombre }))
const fila = (nombre: string) => screen.getByRole('row', { name: new RegExp(nombre) })

describe('colegios y versiones', () => {
  it('muestra todas las versiones del colegio con su resumen y abre otra', () => {
    const e = nuevoBorrador({ ...colegioEjemplo(), docentes: colegioEjemplo().docentes }, 'Opción B')
    render(<App inicial={{ ...e, docentes: e.docentes.slice(0, 5) }} />)
    abrir(/Colegios y versiones/)
    expect(within(fila('Opción B')).getByText('En uso')).toBeTruthy()
    expect(within(fila('Opción B')).getByText('5')).toBeTruthy() // docentes de la versión en uso
    expect(within(fila('Horario principal')).getByText('20')).toBeTruthy() // la guardada conserva sus 20 docentes
    fireEvent.click(within(fila('Horario principal')).getByRole('button', { name: 'Abrir Horario principal' }))
    expect(within(fila('Horario principal')).getByText('En uso')).toBeTruthy()
  })
  it('crea un colegio nuevo, deja el anterior en la lista y vuelve a abrirlo', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir(/Colegios y versiones/)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo colegio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, crear un colegio nuevo' }))
    expect(screen.getByRole('heading', { name: /Mi colegio/ })).toBeTruthy()
    const otros = screen.getByRole('region', { name: 'Otros colegios' })
    expect(within(otros).getByText('Institución Educativa de Ejemplo')).toBeTruthy()
    fireEvent.click(within(otros).getByRole('button', { name: 'Abrir Institución Educativa de Ejemplo' }))
    expect(screen.getByRole('heading', { name: /Institución Educativa de Ejemplo/ })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Otros colegios' })).getByText('Mi colegio')).toBeTruthy()
  })
  it('abrir una versión la deja tal cual: no mueve sus clases aunque rompan una regla', () => {
    // La versión guardada tiene a Ana en una franja en que no está disponible.
    const guardada = mini({
      grupos: [grp('a', 7)], docentes: [doc('ana', { nombre: 'Ana', cargaSemanal: 2, noDisponible: ['1-1'] })],
      asignaciones: [asg('ana', 'a', 'mat', 2)], clases: [cls('ana|a|mat', 1, 1, { id: 'x1' }), cls('ana|a|mat', 2, 1, { id: 'x2' })],
    })
    const enUso = mini({ grupos: [grp('a', 7)], docentes: [doc('ana', { nombre: 'Ana', cargaSemanal: 2 })], asignaciones: [asg('ana', 'a', 'mat', 2)] })
    render(<App inicial={{ ...enUso, borradores: [{ id: 'v', nombre: 'Con choque', guardado: 't', estado: guardada }] }} />)
    abrir(/Colegios y versiones/)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Con choque' }))
    expect(within(fila('Con choque')).getByText('1 pendiente')).toBeTruthy()
  })
})
