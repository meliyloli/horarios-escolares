import type { Estado } from '../dominio/tipos'
import { exportarRespaldo, importarRespaldo } from './almacen'
import { abrirSobre, cerrarSobre, idDeCodigo, normalizarCodigo } from './cifrado'
import { Conflicto, type Nube } from './nube'

/** Este navegador trabaja sobre el colegio en línea `id` (sale del código), y lo último que vio de él es `version`. */
export interface Enlace { codigo: string; id: string; version: string }

const MINIMO = 8

const empacar = (e: Estado, codigo: string) => cerrarSobre(exportarRespaldo({ ...e, ultimoRespaldo: undefined }), codigo)
const desempacar = async (contenido: string, codigo: string) => importarRespaldo(await abrirSobre(contenido, codigo))

/** Pone un colegio en línea con un código nuevo. */
export const crearEnLinea = async (nube: Nube, codigo: string, e: Estado): Promise<Enlace> => {
  if (normalizarCodigo(codigo).length < MINIMO) throw new Error(`El código debe tener al menos ${MINIMO} letras o números.`)
  const id = await idDeCodigo(codigo)
  try {
    return { codigo: normalizarCodigo(codigo), id, version: await nube.guardar(id, await empacar(e, codigo), null) }
  } catch (error) {
    if (error instanceof Conflicto) throw new Error('Ya hay un colegio con ese código. Elige otro.')
    throw error
  }
}

/** Entra a un colegio en línea con su código. */
export const unirse = async (nube: Nube, codigo: string): Promise<{ enlace: Enlace; estado: Estado }> => {
  const id = await idDeCodigo(codigo)
  const doc = await nube.leer(id)
  if (!doc) throw new Error('No hay ningún colegio con ese código.')
  return { enlace: { codigo: normalizarCodigo(codigo), id, version: doc.version }, estado: await desempacar(doc.contenido, codigo) }
}

/** Sube lo que hay; si otra persona guardó antes, no lo pisa: devuelve lo de ella para cargarlo. */
export const subir = async (nube: Nube, enlace: Enlace, e: Estado): Promise<{ enlace: Enlace } | { conflicto: { enlace: Enlace; estado: Estado } }> => {
  try {
    return { enlace: { ...enlace, version: await nube.guardar(enlace.id, await empacar(e, enlace.codigo), enlace.version) } }
  } catch (error) {
    if (!(error instanceof Conflicto)) throw error
    const actual = await unirse(nube, enlace.codigo)
    return { conflicto: actual }
  }
}

/** Lo que otra persona haya guardado desde la última vez, o null si no hay nada nuevo. */
export const bajar = async (nube: Nube, enlace: Enlace): Promise<{ enlace: Enlace; estado: Estado } | null> => {
  const doc = await nube.leer(enlace.id)
  if (!doc || doc.version === enlace.version) return null
  return { enlace: { ...enlace, version: doc.version }, estado: await desempacar(doc.contenido, enlace.codigo) }
}
