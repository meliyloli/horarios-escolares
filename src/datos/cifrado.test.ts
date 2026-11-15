import { describe, expect, it } from 'vitest'
import { colegioEjemplo } from '../dominio/ejemplo'
import { abrirSobre, cerrarSobre, idDeCodigo, normalizarCodigo } from './cifrado'

describe('datos cifrados con el código del colegio', () => {
  it('el mismo código da siempre el mismo identificador, y otro código da otro', async () => {
    expect(await idDeCodigo('FEYA-2026-ABCD')).toBe(await idDeCodigo('feya 2026 abcd'))
    expect(await idDeCodigo('FEYA-2026-ABCD')).not.toBe(await idDeCodigo('FEYA-2026-ABCE'))
    expect(await idDeCodigo('FEYA-2026-ABCD')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('lo cifrado se abre con el mismo código y queda igual', async () => {
    const e = colegioEjemplo()
    const sobre = await cerrarSobre(JSON.stringify(e), 'FEYA-2026-ABCD')
    expect(sobre).not.toContain('Institución')
    expect(sobre.length).toBeLessThan(JSON.stringify(e).length / 2) // va comprimido
    expect(JSON.parse(await abrirSobre(sobre, 'feya-2026-abcd'))).toEqual(e)
  })
  it('con otro código no se puede abrir', async () => {
    const sobre = await cerrarSobre('{"a":1}', 'FEYA-2026-ABCD')
    await expect(abrirSobre(sobre, 'OTRO-CODIGO-1234')).rejects.toThrow(/código/)
  })
  it('el código se escribe sin importar mayúsculas, espacios ni guiones', () => {
    expect(normalizarCodigo(' Feya 2026-abcd ')).toBe('FEYA2026ABCD')
  })
})
