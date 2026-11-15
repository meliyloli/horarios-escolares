import { describe, expect, it } from 'vitest'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { nubeEnMemoria } from './nube'
import { bajar, crearEnLinea, subir, unirse } from './sincronizacion'

const conNombre = (nombre: string) => ({ ...colegioEjemplo(), colegio: { ...colegioEjemplo().colegio, nombre } })

describe('colegio en línea, compartido con un código', () => {
  it('quien crea el colegio con un código y quien entra con ese código ven lo mismo', async () => {
    const nube = nubeEnMemoria()
    const yo = await crearEnLinea(nube, 'FEYA-2026-ABCD', conNombre('Colegio A'))
    const otra = await unirse(nube, 'feya 2026 abcd')
    expect(otra.estado).toEqual(conNombre('Colegio A'))
    expect(otra.enlace).toEqual(yo)
    // Lo guardado en la nube no se puede leer sin el código.
    expect([...nube.docs.values()][0].contenido).not.toContain('Colegio A')
  })
  it('un código sin colegio, o uno ya usado al crear, se rechaza con un mensaje claro', async () => {
    const nube = nubeEnMemoria()
    await expect(unirse(nube, 'NO-EXISTE-1234')).rejects.toThrow('No hay ningún colegio con ese código.')
    await crearEnLinea(nube, 'FEYA-2026-ABCD', estadoVacio())
    await expect(crearEnLinea(nube, 'FEYA-2026-ABCD', estadoVacio())).rejects.toThrow('Ya hay un colegio con ese código. Elige otro.')
    await expect(crearEnLinea(nube, 'corto', estadoVacio())).rejects.toThrow(/al menos 8/)
  })
  it('los cambios de una persona le llegan a la otra', async () => {
    const nube = nubeEnMemoria()
    const yo = await crearEnLinea(nube, 'FEYA-2026-ABCD', conNombre('Colegio A'))
    const otra = await unirse(nube, 'FEYA-2026-ABCD')
    const r = await subir(nube, yo, conNombre('Colegio A cambiado'))
    expect('enlace' in r && r.enlace.version).not.toBe(yo.version)
    const nuevo = await bajar(nube, otra.enlace)
    expect(nuevo?.estado.colegio.nombre).toBe('Colegio A cambiado')
    expect(await bajar(nube, nuevo!.enlace)).toBeNull() // sin cambios nuevos
  })
  it('si dos guardan a la vez, la segunda recibe lo de la primera en vez de pisarlo', async () => {
    const nube = nubeEnMemoria()
    const yo = await crearEnLinea(nube, 'FEYA-2026-ABCD', conNombre('Original'))
    const otra = await unirse(nube, 'FEYA-2026-ABCD')
    await subir(nube, yo, conNombre('Lo mío'))
    const r = await subir(nube, otra.enlace, conNombre('Lo de ella'))
    expect('conflicto' in r && r.conflicto.estado.colegio.nombre).toBe('Lo mío')
  })
})
