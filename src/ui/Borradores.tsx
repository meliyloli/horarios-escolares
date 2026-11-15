import { useState } from 'react'
import { abrirBorrador, nombreHorario, nuevoBorrador, renombrarHorario } from '../dominio/borradores'
import type { Id } from '../dominio/tipos'
import { Icono, Renombrar } from './componentes'
import { useEstado } from './estado'

const hoy = () => new Date().toLocaleDateString('sv')

/** Abre una versión guardada; si hay reemplazos por venir que se perderían, pregunta antes. */
export const useAbrirVersion = () => {
  const { estado, cambiar, confirmar, avisar } = useEstado()
  return (id: Id, nombre: string) => {
    const actual = nombreHorario(estado)
    const aplicar = () => {
      cambiar((e) => abrirBorrador(e, id, hoy()), { talCual: true })
      avisar(`Ahora trabajas en «${nombre}». «${actual}» quedó guardada.`)
    }
    const porVenir = estado.ajustes.filter((aj) => aj.fecha >= hoy() && (aj.reemplazos.length > 0 || aj.movimientos.length > 0)).length
    if (!porVenir) return aplicar()
    confirmar({
      titulo: `¿Trabajar en «${nombre}»?`,
      mensaje: `Las clases cambian de hora, así que se quitan los reemplazos ya guardados de ${porVenir} ${porVenir === 1 ? 'día' : 'días'} de hoy en adelante. Las ausencias se conservan.`,
      boton: 'Sí, cambiar de versión', accion: aplicar,
    })
  }
}

/** Formulario para guardar la versión en uso y seguir en una copia con otro nombre. */
export function NuevaVersion({ alCerrar }: { alCerrar: () => void }) {
  const { estado, cambiar, avisar } = useEstado()
  const actual = nombreHorario(estado)
  const [nombre, setNombre] = useState(`Versión ${(estado.borradores?.length ?? 0) + 2}`)
  return (
    <form
      className="pila"
      onSubmit={(ev) => {
        ev.preventDefault()
        const n = nombre.trim()
        if (!n) return
        cambiar((e) => nuevoBorrador(e, n))
        avisar(`«${actual}» quedó guardada. Ahora trabajas en «${n}».`)
        alCerrar()
      }}
    >
      <p className="suave">
        «{actual}» se guarda tal como está. Sigues trabajando en una copia completa con otro nombre: cambia docentes, aulas, grupos, reglas o la
        asignación, genera otro horario y compara. Lo que cambies en una versión no toca las demás.
      </p>
      <div className="fila">
        <label className="fila">
          Nombre de la versión
          <input type="text" value={nombre} autoFocus onChange={(ev) => setNombre(ev.target.value)} />
        </label>
        <button className="boton chico primario" disabled={!nombre.trim()}>Crear versión</button>
        <button type="button" className="boton chico" onClick={alCerrar}>Cancelar</button>
      </div>
    </form>
  )
}

/** Barra de Asignación y Horario: qué versión está en uso, y atajos para crear otra o verlas todas. */
export function Borradores() {
  const { estado, cambiar } = useEstado()
  const [nueva, setNueva] = useState(false)
  const [renombrando, setRenombrando] = useState(false)
  const otras = estado.borradores?.length ?? 0
  const actual = nombreHorario(estado)

  return (
    <section className="subpanel borradores" aria-label="Versiones del horario">
      <div className="fila">
        {renombrando ? (
          <Renombrar inicial={actual} alCancelar={() => setRenombrando(false)} alGuardar={(n) => { cambiar((e) => renombrarHorario(e, null, n)); setRenombrando(false) }} />
        ) : (
          <>
            <span>Versión en uso: <b>{actual}</b></span>
            <button className="boton chico" onClick={() => setRenombrando(true)}>Renombrar</button>
          </>
        )}
        <span className="empuja fila">
          <a className="boton chico" href="#versiones">{otras ? `Ver todas las versiones · ${otras + 1}` : 'Ver versiones y colegios'}</a>
          <button className="boton chico" onClick={() => setNueva(true)}><Icono nombre="mas" tamano={18} />Nueva versión</button>
        </span>
      </div>
      {nueva && <NuevaVersion alCerrar={() => setNueva(false)} />}
    </section>
  )
}
