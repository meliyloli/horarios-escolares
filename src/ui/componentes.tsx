import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'

const TRAZOS = {
  colegio: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M12 4V2M10 11h4',
  areas: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13M8 7h7M8 11h5',
  grupos: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  asignacion: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 12h8M8 16h5',
  horario: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M8 2v4M16 2v4M9 10v11M15 10v11M3 15.5h18',
  incapacidades: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 8l5 5M22 8l-5 5',
  mas: 'M12 5v14M5 12h14',
  borrar: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  bajar: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  subir: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  imprimir: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  deshacer: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  fijar: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  bien: 'M20 6L9 17l-5-5',
  cerrar: 'M18 6L6 18M6 6l12 12',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5h.01',
  varita: 'M15 4V2M15 10V8M12 6h-2M20 6h-2M17.8 8.8l1.4 1.4M3 21l12-12M17.8 3.2l1.4-1.4',
  excel: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13l6 6M15 13l-6 6',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  versiones: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5',
  lapiz: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  zonas: 'M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const

export type NombreIcono = keyof typeof TRAZOS

export const Icono = ({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) => (
  <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={TRAZOS[nombre]} />
  </svg>
)

export const Aviso = ({ tipo = 'aviso', children, acciones }: { tipo?: 'aviso' | 'error' | 'bien' | 'info'; children: ReactNode; acciones?: ReactNode }) => (
  <div className={`aviso ${tipo === 'aviso' ? '' : tipo}`}>
    <Icono nombre={tipo === 'bien' ? 'bien' : tipo === 'info' ? 'info' : 'alerta'} />
    <div>{children}</div>
    {acciones && <div className="acciones">{acciones}</div>}
  </div>
)

export const Vacio = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div className="vacio">
    <h3>{titulo}</h3>
    {children}
  </div>
)

export const Campo = ({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) => (
  <label className="campo">
    {etiqueta}
    {children}
    {ayuda && <span className="ayuda">{ayuda}</span>}
  </label>
)

export function Pestanas<T extends string>({ opciones, valor, alCambiar, etiqueta }: { opciones: [T, string][]; valor: T; alCambiar: (v: T) => void; etiqueta: string }) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map(([id, texto]) => (
        <button key={id} role="tab" aria-selected={valor === id} onClick={() => alCambiar(id)}>{texto}</button>
      ))}
    </div>
  )
}

/** Número entero o decimal desde un campo de texto; vacío o inválido cuenta como 0. */
export const aNumero = (texto: string): number => {
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Campo numérico que se guarda solo, un momento después de dejar de escribir (o al salir o con Enter).
 * Así no pasa por valores intermedios al escribir (borrar "4" para poner "5" no deja el 0), y un campo vacío no se guarda.
 */
export function CampoNumero({ valor, alConfirmar, ...props }: { valor: number; alConfirmar: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [texto, setTexto] = useState<string | null>(null)
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined)
  const confirmar = (t = texto) => {
    clearTimeout(espera.current)
    if (t === null || t.trim() === '') return setTexto(null)
    const n = aNumero(t)
    if (n !== valor) alConfirmar(n)
    setTexto(null)
  }
  useEffect(() => () => clearTimeout(espera.current), [])
  return (
    <input
      type="number" {...props} value={texto ?? valor}
      onChange={(ev) => {
        const t = ev.target.value
        setTexto(t)
        clearTimeout(espera.current)
        if (t.trim() !== '') espera.current = setTimeout(() => confirmar(t), 700)
      }}
      onBlur={() => confirmar()} onKeyDown={(ev) => ev.key === 'Enter' && confirmar()}
    />
  )
}

/** Escribir un nombre nuevo en línea, con «Guardar nombre» y «Cancelar». */
export function Renombrar({ inicial, alGuardar, alCancelar }: { inicial: string; alGuardar: (n: string) => void; alCancelar: () => void }) {
  const [nombre, setNombre] = useState(inicial)
  const listo = nombre.trim()
  return (
    <form className="fila" onSubmit={(ev) => { ev.preventDefault(); if (listo) alGuardar(listo) }}>
      <input type="text" aria-label="Nombre nuevo" value={nombre} autoFocus onChange={(ev) => setNombre(ev.target.value)} />
      <button className="boton chico primario" disabled={!listo}>Guardar nombre</button>
      <button type="button" className="boton chico" onClick={alCancelar}>Cancelar</button>
    </form>
  )
}
