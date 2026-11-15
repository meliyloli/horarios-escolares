import { describe, expect, it } from 'vitest'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { nombreHorario } from '../dominio/borradores'
import { versionDesdeHorario } from '../dominio/importarHorario'
import { nombreGrupo } from '../dominio/tiempo'
import type { Estado } from '../dominio/tipos'
import type { Trozo } from './documentos'
import { leerHorarioGeneral } from './horarioPdf'
import { pdfHorario } from './pdf'

/** El texto con su posición de cada página, como lo lee la app (aquí con el pdf.js para Node). */
const trozos = async (buf: ArrayBuffer): Promise<Trozo[][]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise
  const paginas: Trozo[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent()
    paginas.push(items.flatMap((i) => ('str' in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], ancho: i.width, tam: i.transform[0] }] : [])))
  }
  return paginas
}

/** Cada clase como «docente|grupo|área@día-franja», para comparar horarios sin mirar los ids. */
const firma = (e: Estado) =>
  e.clases.map((c) => {
    const a = e.asignaciones.find((x) => x.id === c.asignacionId)!
    const d = e.docentes.find((x) => x.id === a.docenteId)!.nombre
    const g = nombreGrupo(e.grupos.find((x) => x.id === a.grupoId)!)
    const ar = e.areas.find((x) => x.id === a.areaId)!.nombre
    return `${d}|${g}|${ar}@${c.dia}-${c.franja}`
  }).sort()

const conHorario = () => {
  const x = colegioEjemplo()
  // Un nombre largo sale cortado en el PDF y aun así se reconoce.
  x.docentes[0].nombre = 'María Yesenia Restrepo de los Ángeles (apellido pendiente)'
  return { ...x, clases: generarHorario(x, { semilla: 1 }).clases }
}

describe('importar un horario general en PDF como versión', () => {
  it('el horario que sale en el PDF vuelve a entrar igual, como una versión nueva en uso', { timeout: 30000 }, async () => {
    const e = conHorario()
    const leido = leerHorarioGeneral(await trozos(pdfHorario(e, 'general', []).output('arraybuffer')))
    expect(leido.colegio).toBe('Institución Educativa de Ejemplo')
    expect(leido.dias).toEqual([1, 2, 3, 4, 5])
    const destino = { ...e, clases: [] }
    const r = versionDesdeHorario(destino, leido, 'Desde el PDF')
    expect(nombreHorario(r.estado)).toBe('Desde el PDF')
    expect(r.estado.borradores).toHaveLength(1)
    expect(firma(r.estado)).toEqual(firma(e))
    expect(r.resumen).toMatchObject({ clases: e.clases.length, docentesNuevos: [], gruposNuevos: [], areasNuevas: [], sinAulas: false })
    expect(r.estado.colegio.modeloAula).toBe('grupo')
    // La asignación sale de contar las clases: igual a la original.
    const horas = (x: Estado) => x.asignaciones.map((a) => `${a.docenteId}|${a.grupoId}|${a.areaId}:${a.horas}`).sort()
    expect(horas(r.estado)).toEqual(horas(e))
  })
  it('en un colegio vacío crea los docentes, grupos y áreas que trae el PDF', { timeout: 30000 }, async () => {
    const e = conHorario()
    const leido = leerHorarioGeneral(await trozos(pdfHorario(e, 'general', []).output('arraybuffer')))
    const r = versionDesdeHorario(estadoVacio(), leido, 'Importado')
    expect(r.resumen.docentesNuevos).toHaveLength(20)
    expect(r.resumen.gruposNuevos).toHaveLength(16)
    expect(r.estado.clases).toHaveLength(e.clases.length)
    const ana = r.estado.docentes.find((d) => d.nombre.startsWith('Rosa Elvira'))!
    expect(ana).toMatchObject({ nivel: 'primaria', cargaSemanal: 25 })
  })
  it('si el PDF no trae aulas, la versión queda sin control de aulas en vez de llenarse de avisos', { timeout: 30000 }, async () => {
    const e = conHorario()
    const sinAulas = { ...e, colegio: { ...e.colegio, modeloAula: 'ninguna' as const } }
    const leido = leerHorarioGeneral(await trozos(pdfHorario(sinAulas, 'general', []).output('arraybuffer')))
    const r = versionDesdeHorario({ ...e, clases: [] }, leido, 'Sin aulas')
    expect(r.estado.colegio.modeloAula).toBe('ninguna')
    expect(r.resumen.sinAulas).toBe(true)
    expect(r.estado.borradores![0].estado.colegio.modeloAula).toBe('grupo')
  })
  it('un PDF que no es un horario general de la app se rechaza con un mensaje claro', async () => {
    const e = conHorario()
    const porGrupo = await trozos(pdfHorario(e, 'grupo', [e.grupos[0].id]).output('arraybuffer'))
    expect(() => leerHorarioGeneral(porGrupo)).toThrow(/Horario general/)
  })
})
