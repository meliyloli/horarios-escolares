import { useState } from 'react'
import { horasRequeridas } from '../dominio/asignacion'
import { intensidadDesdeAsignacion } from '../dominio/edicion'
import type { Estado } from '../dominio/tipos'
import { colorDeArea } from './colores'
import { Aviso, Icono } from './componentes'
import { useEstado } from './estado'

/** Materias (grado y área) que tienen horas asignadas pero intensidad 0. */
export const sinIntensidad = (e: Estado): number => {
  const pares = new Set<string>()
  for (const a of e.asignaciones) {
    const g = e.grupos.find((x) => x.id === a.grupoId)
    if (g && a.horas > 0 && horasRequeridas(e, g, a.areaId) === 0) pares.add(`${g.grado}|${a.areaId}`)
  }
  return pares.size
}

/** Panel para llenar la intensidad horaria con lo que ya está asignado, sin escribirla a mano. */
export function IntensidadDesdeAsignacion({ alCerrar }: { alCerrar: () => void }) {
  const { estado, cambiar, avisar } = useEstado()
  const [reemplazar, setReemplazar] = useState(false)
  const { cambios, distintas } = intensidadDesdeAsignacion(estado, reemplazar)
  const area = (id: string) => estado.areas.find((a) => a.id === id)?.nombre ?? 'Área borrada'

  return (
    <section className="panel" aria-labelledby="titulo-leer-intensidad">
      <div className="fila">
        <h3 id="titulo-leer-intensidad">Leer intensidad desde la asignación</h3>
        <button className="boton chico icono empuja" aria-label="Cerrar" onClick={alCerrar}><Icono nombre="cerrar" tamano={18} /></button>
      </div>
      <p>
        Para cada grado, la intensidad de cada materia pasa a ser las horas por semana que ya tienen asignadas sus grupos. Sirve cuando la asignación está
        completa y la intensidad no. Nada cambia hasta que toques «Aplicar a la intensidad».
      </p>
      <label className="marca">
        <input type="checkbox" checked={reemplazar} onChange={(ev) => setReemplazar(ev.target.checked)} />
        Reemplazar también la intensidad que ya existe cuando no coincide con lo asignado
      </label>
      {cambios.length === 0 ? (
        <Aviso tipo="bien">La intensidad ya coincide con lo asignado{reemplazar ? '' : ' en las materias que estaban en 0'}. No hay nada que cambiar.</Aviso>
      ) : (
        <div className="tabla-caja">
          <table className="datos">
            <thead><tr><th>Grado</th><th>Área</th><th className="num">Horas por semana</th></tr></thead>
            <tbody>
              {cambios.map((c) => (
                <tr key={`${c.grado}|${c.areaId}`}>
                  <td>{c.grado}.°</td>
                  <td><span className="fila" style={{ flexWrap: 'nowrap' }}><span className="muestra" style={{ background: colorDeArea(estado, c.areaId) }} />{area(c.areaId)}</span></td>
                  <td className="num">{c.antes} → {c.despues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {distintas.length > 0 && (
        <Aviso>
          En estas materias los grupos de un mismo grado no tienen las mismas horas; se usa la cantidad más repetida. Revisa la asignación de los que no coinciden:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{distintas.map((d) => <li key={d}>{d}</li>)}</ul>
        </Aviso>
      )}
      <div className="fila">
        <button
          className="boton primario" disabled={cambios.length === 0}
          onClick={() => {
            cambiar((e) => intensidadDesdeAsignacion(e, reemplazar).estado)
            avisar(`Intensidad actualizada en ${cambios.length} ${cambios.length === 1 ? 'materia' : 'materias'}.`)
            alCerrar()
          }}
        >
          Aplicar a la intensidad
        </button>
        <button className="boton" onClick={alCerrar}>Cancelar</button>
      </div>
    </section>
  )
}
