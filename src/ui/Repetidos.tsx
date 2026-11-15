import { docentesRepetidos, unirDocentes } from '../dominio/edicion'
import { Icono } from './componentes'
import { useEstado } from './estado'

/**
 * Aviso de docentes que parecen la misma persona con dos nombres (pasa al importar un horario hecho antes de cambiar
 * nombres). Une cada par en el docente del colegio, que conserva su nombre, carga y disponibilidad.
 */
export function Repetidos() {
  const { estado, cambiar, avisar } = useEstado()
  const pares = docentesRepetidos(estado)
  if (pares.length === 0) return null
  const unir = (lista: typeof pares) => {
    cambiar((e) => lista.reduce((x, p) => unirDocentes(x, p.origen.id, p.destino.id), e))
    avisar(lista.length === 1 ? `Las clases de «${lista[0].origen.nombre}» pasaron a «${lista[0].destino.nombre}».` : `Se unieron ${lista.length} docentes repetidos.`)
  }
  return (
    <section className="aviso" aria-label="Docentes repetidos">
      <Icono nombre="alerta" />
      <div>
        <b>Parece que hay docentes repetidos.</b> Cada uno de estos tiene clases con un nombre y el mismo docente, con otro nombre, no tiene
        ninguna. Al unirlos queda el segundo, con su nombre, carga y disponibilidad, y recibe las clases del primero.
        <ul className="lista-repetidos">
          {pares.map((p) => (
            <li key={p.origen.id}>
              «{p.origen.nombre}» → «{p.destino.nombre}»
              <button className="boton chico" aria-label={`Unir «${p.origen.nombre}» con «${p.destino.nombre}»`} onClick={() => unir([p])}>Unir</button>
            </li>
          ))}
        </ul>
      </div>
      {pares.length > 1 && <div className="acciones"><button className="boton chico primario" onClick={() => unir(pares)}>Unir los {pares.length}</button></div>}
    </section>
  )
}
