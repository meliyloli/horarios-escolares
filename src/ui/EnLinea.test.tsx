// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { nubeEnMemoria } from '../datos/nube'
import { unirse } from '../datos/sincronizacion'
import { colegioEjemplo } from '../dominio/ejemplo'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
  localStorage.clear()
})

const abrir = (nombre: RegExp) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: nombre }))

describe('colegio en línea', () => {
  it('el enlace publicado pide el código y no deja entrar con uno que no existe', async () => {
    render(<App inicial={colegioEjemplo()} nube={nubeEnMemoria()} exigirCodigo />)
    expect(screen.queryByRole('navigation')).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Código del colegio/), { target: { value: 'NO-EXISTE-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('No hay ningún colegio con ese código.')).toBeTruthy()
  })
  it('quien pone el colegio en línea y quien entra con el código trabajan sobre lo mismo', async () => {
    const nube = nubeEnMemoria()
    // Ella pone su colegio en línea desde «Colegios y versiones».
    render(<App inicial={colegioEjemplo()} nube={nube} exigirCodigo={false} />)
    abrir(/Colegios y versiones/)
    fireEvent.click(screen.getByRole('button', { name: /Poner «Institución Educativa de Ejemplo» en línea/ }))
    fireEvent.change(screen.getByLabelText(/^Código del colegio/), { target: { value: 'PRUEBA-2026-XYZW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Poner en línea' }))
    expect(await screen.findByText(/está en línea con el código/)).toBeTruthy()
    cleanup()
    localStorage.clear()

    // Otra persona abre el enlace en otro computador y entra con el código.
    render(<App nube={nube} exigirCodigo />)
    fireEvent.change(screen.getByLabelText(/^Código del colegio/), { target: { value: 'prueba 2026 xyzw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('navigation')).toBeTruthy()
    expect(screen.getAllByText('Institución Educativa de Ejemplo').length).toBeGreaterThan(0)
    // Cambia el nombre del colegio: el cambio llega a la nube.
    abrir(/^Colegio$/)
    fireEvent.change(screen.getByLabelText('Nombre del colegio'), { target: { value: 'Colegio Compartido' } })
    await waitFor(async () => expect((await unirse(nube, 'PRUEBA-2026-XYZW')).estado.colegio.nombre).toBe('Colegio Compartido'), { timeout: 4000 })
  }, 15000)
})
