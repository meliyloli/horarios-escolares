import { useRef, useState } from 'react'
import { importarRespaldo } from '../datos/almacen'
import { estadoVacio } from '../dominio/ejemplo'
import type { Estado } from '../dominio/tipos'
import { Aviso, Icono } from './componentes'
import { codigoNuevo, useEnLinea } from './enLinea'

/** Pantalla del enlace publicado: para ver y cambiar un colegio hace falta su código. */
export function Entrada() {
  const { entrar, crear } = useEnLinea()
  const [codigo, setCodigo] = useState('')
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState(codigoNuevo)
  const [desde, setDesde] = useState<{ nombre: string; estado: Estado } | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const intentar = async (accion: () => Promise<void>) => {
    setError('')
    setOcupado(true)
    try {
      await accion()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="entrada">
      <section className="panel">
        <h1>Horarios escolares</h1>
        {!creando ? (
          <form className="pila" onSubmit={(ev) => { ev.preventDefault(); if (codigo.trim()) void intentar(() => entrar(codigo)) }}>
            <p>Escribe el código de tu colegio. Te lo da quien lo puso en línea.</p>
            <label className="campo">
              Código del colegio
              <input type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={codigo} onChange={(ev) => setCodigo(ev.target.value)} placeholder="ABCD-EFGH-JKLM" autoFocus />
            </label>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <button className="boton primario" disabled={!codigo.trim() || ocupado}>{ocupado ? 'Abriendo…' : 'Entrar'}</button>
            <button type="button" className="boton chico" onClick={() => { setCreando(true); setError('') }}>Voy a poner un colegio en línea</button>
          </form>
        ) : (
          <form className="pila" onSubmit={(ev) => { ev.preventDefault(); void intentar(() => crear(nuevo, desde?.estado ?? estadoVacio())) }}>
            <p>
              Elige el código del colegio. Quien lo tenga podrá ver y cambiar todo, incluidas las incapacidades: compártelo solo con quien
              corresponda. Los datos se guardan cifrados con el código; si se pierde, no se pueden recuperar.
            </p>
            <label className="campo">
              Código del colegio
              <input type="text" autoComplete="off" spellCheck={false} value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} />
              <span className="ayuda">Al menos 8 letras o números. El propuesto es difícil de adivinar.</span>
            </label>
            <div className="fila">
              <button type="button" className="boton chico" onClick={() => archivo.current?.click()}><Icono nombre="subir" tamano={18} />Empezar desde un respaldo</button>
              <span className="suave">{desde ? `Respaldo de «${desde.nombre}»` : 'Si no eliges un respaldo, empieza vacío.'}</span>
              <input
                ref={archivo} type="file" accept=".json,application/json" hidden aria-label="Respaldo del colegio"
                onChange={async (ev) => {
                  const f = ev.target.files?.[0]
                  ev.target.value = ''
                  if (!f) return
                  try {
                    const estado = importarRespaldo(await f.text())
                    setDesde({ nombre: estado.colegio.nombre, estado })
                    setError('')
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo abrir el respaldo.')
                  }
                }}
              />
            </div>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <button className="boton primario" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear el colegio en línea'}</button>
            <button type="button" className="boton chico" onClick={() => { setCreando(false); setError('') }}>Ya tengo un código</button>
          </form>
        )}
      </section>
    </main>
  )
}
