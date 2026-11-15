import { Component, type ReactNode } from 'react'
import { descargar } from '../datos/excel'
import { LLAVE } from '../datos/almacen'

/** Si una pantalla falla, en vez de quedar en blanco ofrece rescatar los datos y volver al inicio. */
export class Barrera extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  render() {
    if (!this.state.fallo) return this.props.children
    const guardado = (() => {
      try {
        return localStorage.getItem(LLAVE)
      } catch {
        return null
      }
    })()
    return (
      <div className="contenido" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2>Algo falló al mostrar esta pantalla</h2>
        <p>Tus datos siguen guardados en este navegador. Descarga un respaldo por seguridad y vuelve al inicio.</p>
        <div className="fila">
          {guardado && (
            <button className="boton primario" onClick={() => descargar(new Blob([guardado], { type: 'application/json' }), 'Respaldo horarios (rescate).json')}>
              Descargar respaldo
            </button>
          )}
          <button
            className="boton"
            onClick={() => {
              history.replaceState(null, '', '#colegio')
              location.reload()
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }
}
