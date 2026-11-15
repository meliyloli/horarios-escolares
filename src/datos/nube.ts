// Dónde viven los colegios en línea. La app solo guarda y lee un texto cifrado por colegio (ver cifrado.ts).

export class Conflicto extends Error {}
export class SinConexion extends Error {}

export interface Nube {
  /** El contenido guardado y su versión, o null si no hay nada con ese identificador. */
  leer(id: string): Promise<{ contenido: string; version: string } | null>
  /**
   * Guarda y devuelve la versión nueva. Con `version` null crea (Conflicto si ya existe); si no, solo guarda cuando lo
   * guardado sigue en esa versión (Conflicto si alguien guardó antes). Así nadie pisa sin saber lo que guardó otro.
   */
  guardar(id: string, contenido: string, version: string | null): Promise<string>
}

/** Para pruebas: la nube en memoria. */
export const nubeEnMemoria = (): Nube & { docs: Map<string, { contenido: string; version: string }> } => {
  const docs = new Map<string, { contenido: string; version: string }>()
  let n = 0
  return {
    docs,
    leer: async (id) => docs.get(id) ?? null,
    guardar: async (id, contenido, version) => {
      const actual = docs.get(id)
      if (version === null ? actual : actual?.version !== version) throw new Conflicto()
      const nueva = `v${++n}`
      docs.set(id, { contenido, version: nueva })
      return nueva
    },
  }
}

export interface ConfigFirebase { apiKey: string; projectId: string }

/**
 * Firestore por su API web, sin librerías: un documento por colegio en la colección «colegios», con un solo campo
 * «contenido». Las reglas de la base solo dejan leer, crear o actualizar un documento por su identificador.
 */
export const nubeFirestore = ({ apiKey, projectId }: ConfigFirebase): Nube => {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/colegios`
  const pedir = async (url: string, init?: RequestInit) => {
    try {
      return await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json' } })
    } catch {
      throw new SinConexion('No hay conexión a internet.')
    }
  }
  const cuerpo = (contenido: string) => JSON.stringify({ fields: { contenido: { stringValue: contenido } } })
  const error = async (r: Response) => new Error(`La base de datos respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return {
    leer: async (id) => {
      const r = await pedir(`${base}/${id}?key=${apiKey}`)
      if (r.status === 404) return null
      if (!r.ok) throw await error(r)
      const doc = await r.json()
      return { contenido: doc.fields?.contenido?.stringValue ?? '', version: doc.updateTime }
    },
    guardar: async (id, contenido, version) => {
      const r = version === null
        ? await pedir(`${base}?documentId=${id}&key=${apiKey}`, { method: 'POST', body: cuerpo(contenido) })
        : await pedir(`${base}/${id}?key=${apiKey}&updateMask.fieldPaths=contenido&currentDocument.updateTime=${encodeURIComponent(version)}`, { method: 'PATCH', body: cuerpo(contenido) })
      // 409: ya existe; 400 FAILED_PRECONDITION o 404: alguien guardó (o borró) antes.
      if (r.status === 409 || r.status === 412 || (r.status === 400 && (await r.clone().text()).includes('FAILED_PRECONDITION')) || (version !== null && r.status === 404))
        throw new Conflicto()
      if (!r.ok) throw await error(r)
      return (await r.json()).updateTime
    },
  }
}
