import { estadoVacio } from '../dominio/ejemplo'
import { nuevoId } from '../dominio/tiempo'
import type { Estado, Id } from '../dominio/tipos'
import { importarRespaldo, LLAVE } from './almacen'
import type { Enlace } from './sincronizacion'

/** Un colegio que no está abierto, con sus datos y sus versiones tal como se dejaron. */
export interface ColegioGuardado {
  id: Id
  guardado: string
  estado: Estado
  /** Si el colegio está en línea, su enlace: al volver a abrirlo se sigue sincronizando. */
  enlace?: Enlace
}

/** El colegio abierto se guarda en LLAVE (cada cambio); los demás, aquí (solo al cambiar de colegio). */
export const LLAVE_COLEGIOS = `${LLAVE}-otros-colegios`

/** La lista guardada; un colegio dañado se descarta sin perder los demás. */
export const leerColegios = (texto: string | null): ColegioGuardado[] => {
  let lista: unknown
  try {
    lista = JSON.parse(texto ?? '[]')
  } catch {
    return []
  }
  return (Array.isArray(lista) ? lista : []).flatMap((x) => {
    const c = x as Partial<ColegioGuardado>
    if (!c || typeof c !== 'object' || typeof c.id !== 'string') return []
    try {
      const e = c.enlace
      const enlace = e && typeof e.codigo === 'string' && typeof e.id === 'string' && typeof e.version === 'string' ? { codigo: e.codigo, id: e.id, version: e.version } : undefined
      return [{ id: c.id, guardado: String(c.guardado ?? ''), estado: importarRespaldo(JSON.stringify(c.estado)), ...(enlace ? { enlace } : {}) }]
    } catch {
      return []
    }
  })
}

/**
 * Abre el colegio `id` de la lista, o uno nuevo y vacío si `id` es null.
 * El que estaba abierto queda guardado en la lista, en el lugar del que se abrió.
 */
export const abrirColegio = (
  otros: ColegioGuardado[], actual: Estado, id: Id | null, ahora = new Date().toISOString(), enlaceActual?: Enlace | null,
): { otros: ColegioGuardado[]; estado: Estado; enlace: Enlace | null } => {
  const elegido = id === null ? undefined : otros.find((c) => c.id === id)
  if (id !== null && !elegido) return { otros, estado: actual, enlace: enlaceActual ?? null }
  const guardado: ColegioGuardado = { id: nuevoId(), guardado: ahora, estado: actual, ...(enlaceActual ? { enlace: enlaceActual } : {}) }
  return {
    otros: elegido ? otros.map((c) => (c.id === id ? guardado : c)) : [...otros, guardado],
    estado: elegido?.estado ?? estadoVacio(),
    enlace: elegido?.enlace ?? null,
  }
}

export const borrarColegio = (otros: ColegioGuardado[], id: Id): ColegioGuardado[] => otros.filter((c) => c.id !== id)

const almacen = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export const cargarColegios = (): ColegioGuardado[] => leerColegios(almacen()?.getItem(LLAVE_COLEGIOS) ?? null)

/** Devuelve false si el navegador no dejó guardar (sin almacenamiento o lleno). */
export const guardarColegios = (lista: ColegioGuardado[]): boolean => {
  try {
    const a = almacen()
    if (!a) return false
    a.setItem(LLAVE_COLEGIOS, JSON.stringify(lista))
    return true
  } catch {
    return false
  }
}
