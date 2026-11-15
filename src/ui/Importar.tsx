import { useState } from 'react'
import { leerArchivo } from '../datos/documentos'
import { colegioEjemplo } from '../dominio/ejemplo'
import {
  adivinarColumnas, adivinarTipo, aplicarImportacion, asignaturasSinArea, leerAsignacion, leerIntensidad, normal,
  type Columnas, type Tabla, type TipoTabla,
} from '../dominio/importar'
import { Aviso, Icono } from './componentes'
import { useEstado } from './estado'

interface TablaLeida {
  filas: Tabla
  tipo: TipoTabla
  columnas: Columnas
  horasPorGrupo: boolean
  docenteFijo: string
}

const NOMBRE_EJEMPLO = colegioEjemplo().colegio.nombre
const CAMPOS: [keyof Omit<Columnas, 'encabezado'>, string][] = [['docente', 'Docente'], ['area', 'Área o asignatura'], ['grupos', 'Grupos'], ['horas', 'Horas']]

/** Panel para llenar la intensidad y la asignación desde un Word o un PDF. No cambia nada hasta confirmar. */
export function Importar({ alCerrar }: { alCerrar: () => void }) {
  const { estado, cambiar, avisar } = useEstado()
  const [archivo, setArchivo] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const [tablas, setTablas] = useState<TablaLeida[]>([])
  const [reemplazar, setReemplazar] = useState(false)
  /** Lo que la persona eligió para cada asignatura que no coincide con un área (id del área o 'nueva'). */
  const [elegidas, setElegidas] = useState<Record<string, string>>({})

  const abrir = async (f?: File) => {
    if (!f) return
    setArchivo(f.name)
    setError('')
    setTablas([])
    setLeyendo(true)
    try {
      const leidas = (await leerArchivo(f)).filter((t) => t.length > 1)
      if (leidas.length === 0)
        throw new Error(f.name.toLowerCase().endsWith('.pdf')
          ? 'No encontré tablas con texto. Si el PDF es una foto o un escaneo, la app no puede leerlo: pásale las imágenes a quien te ayuda con la app o copia los datos a mano.'
          : 'No encontré tablas en el documento. La intensidad y la asignación deben estar en tablas de Word.')
      setTablas(leidas.map((filas) => ({ filas, tipo: adivinarTipo(filas), columnas: adivinarColumnas(filas), horasPorGrupo: true, docenteFijo: '' })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setLeyendo(false)
    }
  }
  const tablaCon = (i: number, c: Partial<TablaLeida>) => setTablas((ts) => ts.map((t, j) => (j === i ? { ...t, ...c } : t)))

  const intensidad = tablas.filter((t) => t.tipo === 'intensidad').map((t) => leerIntensidad(t.filas))
  // Cada tabla de asignación empieza con el último docente de la anterior (una tabla que sigue en otra página).
  const asignacion: ReturnType<typeof leerAsignacion>[] = []
  for (const t of tablas.filter((x) => x.tipo === 'asignacion'))
    asignacion.push(leerAsignacion(t.filas, t.columnas, t.horasPorGrupo, t.docenteFijo, asignacion.at(-1)?.ultimoDocente))
  const filasLeidas = { intensidad: intensidad.flatMap((x) => x.filas), asignacion: asignacion.flatMap((x) => x.filas) }
  const sinArea = asignaturasSinArea(estado, filasLeidas)
  const elegida = (nombre: string, sugerida?: string) => elegidas[normal(nombre)] ?? sugerida ?? 'nueva'
  const equivalencias = Object.fromEntries(sinArea.map((x) => [normal(x.nombre), elegida(x.nombre, x.sugerida)]))
  const leido = { ...filasLeidas, reemplazarAsignacion: reemplazar, equivalencias }
  const sinEntender = [...intensidad, ...asignacion].flatMap((x) => x.sinEntender)
  const { resumen } = aplicarImportacion(estado, leido)
  const hayAlgo = leido.intensidad.length + leido.asignacion.length > 0

  const importar = () => {
    cambiar((e) => aplicarImportacion(e, leido).estado)
    avisar(`Importado: ${leido.intensidad.length} áreas con intensidad y ${resumen.filasAsignacion} filas de asignación. Revisa los avisos de la asignación.`)
    alCerrar()
  }

  return (
    <section className="panel" aria-labelledby="titulo-importar">
      <div className="fila">
        <h3 id="titulo-importar">Importar desde Word o PDF</h3>
        <button className="boton chico icono empuja" aria-label="Cerrar la importación" onClick={alCerrar}><Icono nombre="cerrar" tamano={18} /></button>
      </div>
      <p>
        Sube el documento con la intensidad horaria por área y grado y, si la tienes, la asignación por docente. La app busca sus tablas, te muestra lo que
        entendió y no cambia nada hasta que toques «Importar».
      </p>
      {estado.colegio.nombre === NOMBRE_EJEMPLO && (
        <Aviso>Estás en el colegio de ejemplo. Toca «Empezar con mi colegio» antes de importar, para no mezclar tus datos con los del ejemplo.</Aviso>
      )}
      <div className="fila">
        <label className="boton primario">
          <Icono nombre="subir" />Elegir documento
          <input type="file" accept=".docx,.pdf,.doc" hidden aria-label="Documento de Word o PDF" onChange={(ev) => { void abrir(ev.target.files?.[0]); ev.target.value = '' }} />
        </label>
        {archivo && <span className="suave">{leyendo ? `Leyendo ${archivo}…` : archivo}</span>}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}

      {tablas.map((t, i) => {
        const titulos = t.filas[t.columnas.encabezado] ?? []
        const ancho = Math.min(8, Math.max(...t.filas.map((f) => f.length)))
        return (
          <section key={i} className="subpanel" aria-label={`Tabla ${i + 1}`}>
            <div className="fila">
              <h4>Tabla {i + 1} · {t.filas.length} filas</h4>
              <label className="fila empuja" style={{ fontWeight: 600 }}>
                Es
                <select aria-label={`Qué es la tabla ${i + 1}`} value={t.tipo} onChange={(ev) => tablaCon(i, { tipo: ev.target.value as TipoTabla })}>
                  <option value="intensidad">Intensidad horaria (áreas por grado)</option>
                  <option value="asignacion">Asignación por docente</option>
                  <option value="ninguna">No usar esta tabla</option>
                </select>
              </label>
            </div>
            <div className="tabla-caja">
              <table className="datos">
                <tbody>
                  {t.filas.slice(0, 5).map((f, r) => (
                    <tr key={r}>{Array.from({ length: ancho }, (_, c) => <td key={c} style={{ whiteSpace: 'nowrap' }}>{f[c] ?? ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {t.filas.length > 5 && <p className="suave">… y {t.filas.length - 5} filas más.</p>}
            {t.tipo === 'asignacion' && (
              <>
                <p className="suave">Revisa qué columna es cada cosa. Si el docente aparece solo en la primera de sus filas, las de abajo se le asignan a él. Si no hay columna de horas, se toman de la intensidad horaria del área en ese grado.</p>
                <div className="rejilla-campos">
                  {CAMPOS.map(([campo, etiqueta]) => (
                    <label key={campo} className="campo">
                      {etiqueta}
                      <select aria-label={`Columna de ${etiqueta.toLowerCase()} en la tabla ${i + 1}`} value={t.columnas[campo]} onChange={(ev) => tablaCon(i, { columnas: { ...t.columnas, [campo]: Number(ev.target.value) } })}>
                        <option value={-1}>{campo === 'docente' ? 'No hay columna de docente' : 'No está'}</option>
                        {Array.from({ length: ancho }, (_, c) => <option key={c} value={c}>Columna {c + 1}{titulos[c] ? `: ${titulos[c]}` : ''}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {t.columnas.docente < 0 && (
                  <label className="campo">
                    Docente de esta tabla
                    <input type="text" value={t.docenteFijo} placeholder={leerAsignacion(t.filas, t.columnas).filas[0]?.docente ? `Se tomó del documento: ${leerAsignacion(t.filas, t.columnas).filas[0].docente}` : 'Nombre del docente'} onChange={(ev) => tablaCon(i, { docenteFijo: ev.target.value })} />
                  </label>
                )}
                <label className="marca">
                  <input type="checkbox" checked={t.horasPorGrupo} onChange={(ev) => tablaCon(i, { horasPorGrupo: ev.target.checked })} />
                  Las horas son por cada grupo (si no, son el total de la fila y se reparten entre sus grupos)
                </label>
              </>
            )}
          </section>
        )
      })}

      {tablas.length > 0 && (
        <>
          <h4>Lo que se va a importar</h4>
          <div className="fila">
            <span className="ficha">Intensidad: {leido.intensidad.length} áreas</span>
            <span className="ficha">Asignación: {resumen.filasAsignacion} filas (docente, área y grupo)</span>
            {resumen.docentesNuevos.length > 0 && <span className="ficha">Docentes nuevos: {resumen.docentesNuevos.length}</span>}
            {resumen.gruposNuevos.length > 0 && <span className="ficha">Grupos nuevos: {resumen.gruposNuevos.join(', ')}</span>}
            {resumen.areasNuevas.length > 0 && <span className="ficha aviso-ficha">Áreas nuevas: {resumen.areasNuevas.join(', ')}</span>}
          </div>
          {sinArea.length > 0 && (
            <section className="subpanel" aria-labelledby="titulo-asignaturas">
              <h4 id="titulo-asignaturas">Asignaturas que no se llaman igual que un área</h4>
              <p className="suave">
                Dime a qué área pertenece cada una (Física y Química, por ejemplo, son de Ciencias Naturales). Sus horas se suman a esa área y toman su intensidad.
                Si de verdad es un área aparte, elige «Crear área nueva».
              </p>
              <div className="tabla-caja">
                <table className="datos">
                  <thead><tr><th>En el documento</th><th>Pertenece a</th></tr></thead>
                  <tbody>
                    {sinArea.map((x) => (
                      <tr key={x.nombre}>
                        <td>{x.nombre}</td>
                        <td>
                          <select aria-label={`Área de ${x.nombre}`} value={elegida(x.nombre, x.sugerida)} onChange={(ev) => setElegidas((m) => ({ ...m, [normal(x.nombre)]: ev.target.value }))}>
                            {estado.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.id === x.sugerida ? ' (sugerida)' : ''}</option>)}
                            <option value="nueva">Crear área nueva «{x.nombre}»</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {(resumen.docentesNuevos.length > 0 || resumen.gruposNuevos.length > 0) && (
            <p className="suave">Los docentes y grupos nuevos quedan en la jornada de la mañana y los docentes con carga de 22 (o 25 en primaria). Ajústalo luego en «Grupos, docentes y aulas».</p>
          )}
          {resumen.sinHoras.length > 0 && (
            <Aviso>
              {resumen.sinHoras.length} filas no traen horas y su área no tiene intensidad en ese grado, así que no se importan: {resumen.sinHoras.slice(0, 6).join('; ')}
              {resumen.sinHoras.length > 6 ? '…' : ''}. Si el documento también trae la intensidad, márcala como «Intensidad horaria» arriba.
            </Aviso>
          )}
          {sinEntender.length > 0 && (
            <details>
              <summary>{sinEntender.length} filas que la app no entendió y no se importan</summary>
              <ul>{sinEntender.slice(0, 40).map((s, i) => <li key={i}>{s || '(vacía)'}</li>)}</ul>
            </details>
          )}
          {estado.asignaciones.length > 0 && leido.asignacion.length > 0 && (
            <label className="marca">
              <input type="checkbox" checked={reemplazar} onChange={(ev) => setReemplazar(ev.target.checked)} />
              Reemplazar la asignación académica actual (si no, lo importado se suma y corrige las horas que ya estaban)
            </label>
          )}
          <div className="fila">
            <button className="boton primario" disabled={!hayAlgo} onClick={importar}>Importar</button>
            <button className="boton" onClick={alCerrar}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  )
}
