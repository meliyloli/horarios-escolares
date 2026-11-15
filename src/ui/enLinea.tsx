import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { LLAVE } from '../datos/almacen'
import { cargarColegios, guardarColegios } from '../datos/colegios'
import { SinConexion, type Nube } from '../datos/nube'
import { bajar, crearEnLinea, subir, unirse, type Enlace } from '../datos/sincronizacion'
import { colegioEjemplo } from '../dominio/ejemplo'
import { nuevoId } from '../dominio/tiempo'
import type { Estado } from '../dominio/tipos'
import { useEstado } from './estado'

export type EstadoNube = 'guardado' | 'guardando' | 'sinConexion' | 'error'

interface Contexto {
  /** null si la app no tiene base de datos en línea configurada. */
  nube: Nube | null
  enlace: Enlace | null
  estadoNube: EstadoNube
  /** Pone en línea el colegio abierto con un código nuevo. */
  crear: (codigo: string, desde?: Estado) => Promise<void>
  /** Abre el colegio en línea de ese código; el colegio abierto queda en «Otros colegios». */
  entrar: (codigo: string) => Promise<void>
  /** Deja de sincronizar en este navegador; los datos quedan aquí como un colegio más. */
  salir: () => void
  /** Al cambiar de colegio: el enlace del que se abre (o null), con el estado que se abre. */
  cambiarEnlace: (enlace: Enlace | null, abierto: Estado) => void
}

const Ctx = createContext<Contexto | null>(null)
export const useEnLinea = (): Contexto => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useEnLinea se usa dentro de <ProveedorEnLinea>')
  return c
}

const LLAVE_ENLACE = `${LLAVE}-en-linea`
const leerEnlace = (): Enlace | null => {
  try {
    const x = JSON.parse(localStorage.getItem(LLAVE_ENLACE) ?? 'null')
    return x && typeof x.codigo === 'string' && typeof x.id === 'string' && typeof x.version === 'string' ? x : null
  } catch {
    return null
  }
}
const guardarEnlace = (e: Enlace | null) => {
  try {
    if (e) localStorage.setItem(LLAVE_ENLACE, JSON.stringify(e))
    else localStorage.removeItem(LLAVE_ENLACE)
  } catch {
    // sin almacenamiento: el enlace dura mientras la pestaña esté abierta
  }
}

/** Letras y números fáciles de dictar (sin 0/O ni 1/I/L): «K7PM-3QXA-9DWT». */
export const codigoNuevo = (): string => {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(12))
  return [...r].map((n) => letras[n % letras.length]).join('').replace(/(.{4})(?=.)/g, '$1-')
}

const NOMBRE_EJEMPLO = colegioEjemplo().colegio.nombre

/**
 * Sincroniza el colegio abierto con la nube: sube cada cambio un momento después de hacerlo y trae cada pocos segundos
 * lo que hayan guardado otras personas. Si dos guardan a la vez, la segunda recibe lo de la primera (nadie pisa a nadie).
 */
export function ProveedorEnLinea({ nube, children, espera = 1500, cadaCuanto = 15000 }: { nube: Nube | null; children: ReactNode; espera?: number; cadaCuanto?: number }) {
  const { estado, reemplazar, avisar } = useEstado()
  const [enlace, setEnlaceEstado] = useState<Enlace | null>(() => (nube ? leerEnlace() : null))
  const [estadoNube, setEstadoNube] = useState<EstadoNube>('guardado')
  const enlaceRef = useRef(enlace)
  const actual = useRef(estado)
  actual.current = estado
  /** Lo último que se sabe igual en la nube y aquí. */
  const sincronizado = useRef<Estado | null>(enlace ? estado : null)
  const subiendo = useRef(false)

  const setEnlace = useCallback((e: Enlace | null) => {
    enlaceRef.current = e
    guardarEnlace(e)
    setEnlaceEstado(e)
  }, [])
  /** Pone en pantalla lo que hay en la nube. */
  const cargar = useCallback((r: { enlace: Enlace; estado: Estado }) => {
    sincronizado.current = r.estado
    setEnlace(r.enlace)
    reemplazar(r.estado)
  }, [reemplazar, setEnlace])

  const subirAhora = useCallback(async () => {
    const e = enlaceRef.current
    if (!nube || !e || subiendo.current || actual.current === sincronizado.current) return
    subiendo.current = true
    setEstadoNube('guardando')
    const enviado = actual.current
    try {
      const r = await subir(nube, e, enviado)
      if (enlaceRef.current?.id !== e.id) return // cambió de colegio mientras subía
      if ('conflicto' in r) {
        cargar(r.conflicto)
        avisar('Otra persona guardó cambios al mismo tiempo: se cargó lo que guardó y tu último cambio no quedó. Revísalo y vuelve a hacerlo si hace falta.')
      } else {
        sincronizado.current = enviado
        setEnlace(r.enlace)
      }
      setEstadoNube('guardado')
    } catch (error) {
      setEstadoNube(error instanceof SinConexion ? 'sinConexion' : 'error')
    } finally {
      subiendo.current = false
    }
    // Si hubo cambios mientras subía, van ahora.
    if (actual.current !== sincronizado.current && enlaceRef.current) void subirAhora()
  }, [nube, cargar, avisar, setEnlace])

  // Cada cambio se sube un momento después (para no subir letra por letra).
  useEffect(() => {
    if (!enlace || estado === sincronizado.current) return
    const t = setTimeout(() => void subirAhora(), espera)
    return () => clearTimeout(t)
  }, [estado, enlace, espera, subirAhora])

  // Cada cierto tiempo: lo que otras personas hayan guardado (o reintenta subir si no había conexión).
  useEffect(() => {
    if (!nube || !enlace) return
    const t = setInterval(async () => {
      const e = enlaceRef.current
      if (!e || subiendo.current) return
      if (actual.current !== sincronizado.current) return void subirAhora()
      try {
        const r = await bajar(nube, e)
        setEstadoNube('guardado')
        if (r && enlaceRef.current?.id === e.id && actual.current === sincronizado.current) {
          cargar(r)
          avisar('Se cargaron cambios hechos por otra persona.')
        }
      } catch (error) {
        setEstadoNube(error instanceof SinConexion ? 'sinConexion' : 'error')
      }
    }, cadaCuanto)
    return () => clearInterval(t)
  }, [nube, enlace?.id, cadaCuanto, cargar, avisar, subirAhora]) // solo cambia de colegio, no de versión

  const crear = async (codigo: string, desde?: Estado) => {
    if (!nube) throw new Error('La conexión en línea no está configurada.')
    const base = desde ?? actual.current
    const e = await crearEnLinea(nube, codigo, base)
    sincronizado.current = base
    setEnlace(e)
    if (desde) reemplazar(desde)
    setEstadoNube('guardado')
  }
  const entrar = async (codigo: string) => {
    if (!nube) throw new Error('La conexión en línea no está configurada.')
    const r = await unirse(nube, codigo)
    // El colegio que estaba abierto aquí no se pierde (salvo que sea el ejemplo o esté vacío).
    const abierto = actual.current
    if (!enlaceRef.current && abierto.colegio.nombre !== NOMBRE_EJEMPLO && (abierto.docentes.length || abierto.grupos.length))
      guardarColegios([...cargarColegios(), { id: nuevoId(), guardado: new Date().toISOString(), estado: abierto }])
    cargar(r)
    setEstadoNube('guardado')
  }
  const salir = () => {
    setEnlace(null)
    sincronizado.current = null
  }
  const cambiarEnlace = (e: Enlace | null, abierto: Estado) => {
    sincronizado.current = e ? abierto : null
    setEnlace(e)
  }

  return <Ctx.Provider value={{ nube, enlace, estadoNube, crear, entrar, salir, cambiarEnlace }}>{children}</Ctx.Provider>
}

export const TEXTO_ESTADO: Record<EstadoNube, string> = {
  guardado: 'En línea · todo guardado',
  guardando: 'En línea · guardando…',
  sinConexion: 'Sin conexión: los cambios se guardan aquí y se suben al volver',
  error: 'No se pudo guardar en línea; se vuelve a intentar',
}
