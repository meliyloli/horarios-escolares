// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { colegioEjemplo } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
  localStorage.clear()
})

describe('acompañamiento en descansos', () => {
  it('agrega las zonas comunes, reparte los turnos y deja cambiarlos a mano', () => {
    const e = colegioEjemplo()
    render(<App inicial={{ ...e, clases: generarHorario(e, { semilla: 1 }).clases }} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Acompañamiento/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar zonas comunes' }))
    expect((screen.getByRole('checkbox', { name: 'Baños es álgida' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Repartir turnos/ }))
    const celda = screen.getByLabelText('Patio principal, Lunes, 1.er descanso') as HTMLSelectElement
    expect(celda.value).not.toBe('')
    expect(screen.getByRole('heading', { name: 'Turnos por docente' })).toBeTruthy()
    // Se pone a la misma persona en dos zonas a la vez: la app lo avisa.
    const otra = screen.getByLabelText('Cancha, Lunes, 1.er descanso') as HTMLSelectElement
    fireEvent.change(otra, { target: { value: celda.value } })
    expect(screen.getByText(/está en dos zonas a la vez el lunes en el primer descanso/)).toBeTruthy()
  })
})

describe('pareja fija', () => {
  it('se elige un docente y luego el otro, y la pareja queda guardada', () => {
    const e = colegioEjemplo()
    render(<App inicial={{ ...e, clases: generarHorario(e, { semilla: 1 }).clases, acompanamiento: { zonas: [{ id: 'z', nombre: 'Tienda', personas: 1, descansos: [1], jornada: 'manana' }], turnos: [] } }} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Acompañamiento/ }))
    const [a, b] = e.docentes
    fireEvent.change(screen.getByLabelText('Pareja de Tienda, docente 1'), { target: { value: a.id } })
    fireEvent.change(screen.getByLabelText('Pareja de Tienda, docente 2'), { target: { value: b.id } })
    expect((screen.getByLabelText('Pareja de Tienda, docente 1') as HTMLSelectElement).value).toBe(a.id)
    fireEvent.click(screen.getByRole('button', { name: /Repartir turnos/ }))
    expect(screen.getByText(new RegExp(`pareja: ${a.nombre} y ${b.nombre}`))).toBeTruthy()
  })
})
