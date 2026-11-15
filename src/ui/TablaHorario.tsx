import type { CSSProperties } from 'react'
import { DESCANSOS_DESPUES_DE, FRANJAS, nombreDia } from '../dominio/tiempo'
import type { Ciclo, Docente, Id } from '../dominio/tipos'
import type { Celda, Tabla } from '../dominio/vistas'
import { Icono } from './componentes'

export interface OpcionesCelda {
  diasCiclo: Ciclo
  estilo: (claseId: Id) => CSSProperties
  cruces?: Set<Id>
  seleccion?: Id | null
  /** Sin esto la tabla es de solo lectura (impresión, vista de un día). */
  alElegir?: (claseId: Id) => void
  alSoltar?: (dia: number, franja: number) => void
  /** Qué pasa al soltar sobre una celda ocupada: "Intercambiar con" o "Mover sobre". */
  verboOcupada?: string
}

const FRANJAS_LISTA = Array.from({ length: FRANJAS }, (_, i) => i + 1)
const NOTA: Partial<Record<NonNullable<Celda['situacion']>, string>> = { movida: 'Cambió de franja' }

function CeldaHorario({ celdas, dia, franja, o }: { celdas: Celda[]; dia: number; franja: number; o: OpcionesCelda }) {
  const donde = `${nombreDia(dia, o.diasCiclo)}, franja ${franja}`
  const moviendo = !!o.seleccion && !!o.alSoltar
  if (celdas.length === 0)
    return moviendo
      ? <button className="celda destino" aria-label={`Mover aquí: ${donde}`} onClick={() => o.alSoltar!(dia, franja)} onDragOver={(ev) => ev.preventDefault()} onDrop={() => o.alSoltar!(dia, franja)} />
      : <div className="celda libre" />
  return (
    <div className="celda" onDragOver={moviendo ? (ev) => ev.preventDefault() : undefined} onDrop={moviendo ? () => o.alSoltar!(dia, franja) : undefined}>
      {celdas.map((c) => {
        const id = c.claseId!
        const elegida = o.seleccion === id
        const cruce = o.cruces?.has(id)
        const clases = ['clase', cruce && 'cruce', c.situacion === 'sinDocente' && 'sin-docente', c.situacion === 'grupoAusente' && 'grupo-ausente', (c.situacion === 'reemplazo' || c.situacion === 'movida') && 'ajuste'].filter(Boolean).join(' ')
        const contenido = (
          <>
            <b>{c.lineas[0]}</b>
            {c.lineas.slice(1).map((l, i) => <span key={i}>{l}</span>)}
            {c.situacion && NOTA[c.situacion] && <span><b>{NOTA[c.situacion]}</b></span>}
            {(c.fijada || cruce) && (
              <span className="sellos">
                {c.fijada && <Icono nombre="fijar" tamano={15} />}
                {cruce && <Icono nombre="alerta" tamano={15} />}
              </span>
            )}
          </>
        )
        if (!o.alElegir) return <div key={id} className={clases} style={o.estilo(id)}>{contenido}</div>
        const descripcion = `${c.lineas.join(', ')}. ${donde}${c.fijada ? ', fijada' : ''}${cruce ? ', con cruce' : ''}`
        const soltarAqui = moviendo && !elegida
        return (
          <button
            key={id} className={clases} style={o.estilo(id)} draggable aria-pressed={elegida}
            aria-label={soltarAqui ? `${o.verboOcupada ?? 'Mover sobre'} ${descripcion}` : descripcion}
            onDragStart={() => o.seleccion !== id && o.alElegir!(id)}
            onClick={() => (soltarAqui ? o.alSoltar!(dia, franja) : o.alElegir!(id))}
          >
            {contenido}
          </button>
        )
      })}
    </div>
  )
}

/** Horario de un docente, grupo o aula: días en columnas y franjas en filas, con los descansos. */
export function TablaHorario({ tabla, ...o }: { tabla: Tabla } & OpcionesCelda) {
  return (
    // Cada día conserva un ancho mínimo legible; en pantallas angostas la cuadrícula se desplaza dentro de su caja.
    <div className="horario-caja">
    <div className={`horario ${tabla.dias.length > 5 ? 'compacto' : ''}`} style={{ gridTemplateColumns: `40px repeat(${tabla.dias.length}, minmax(${tabla.dias.length > 5 ? 84 : 102}px, 1fr))` }}>
      <div />
      {tabla.dias.map((d) => <div key={d} className="dia">{nombreDia(d, o.diasCiclo)}</div>)}
      {FRANJAS_LISTA.map((f) => (
        <FilaFranja key={f} franja={f}>
          {tabla.dias.map((d, i) => <CeldaHorario key={d} celdas={tabla.celdas[i][f - 1]} dia={d} franja={f} o={o} />)}
        </FilaFranja>
      ))}
    </div>
    </div>
  )
}

function FilaFranja({ franja, children }: { franja: number; children: React.ReactNode }) {
  return (
    <>
      <div className="franja" aria-label={`Franja ${franja}`}>{franja}</div>
      {children}
      {DESCANSOS_DESPUES_DE.includes(franja) && (<><div /><div className="descanso">Descanso</div></>)}
    </>
  )
}

/** Horario general: una fila por docente y, por cada día, sus 6 franjas. */
export function TablaGeneral({ docentes, dias, celdas, ...o }: { docentes: Docente[]; dias: number[]; celdas: Celda[][][][] } & OpcionesCelda) {
  return (
    <div className="general">
      <div className="horario compacto" style={{ gridTemplateColumns: `170px repeat(${dias.length * FRANJAS}, minmax(96px, 1fr))` }}>
        <div />
        {dias.map((d) => <div key={d} className="dia-cabeza">{nombreDia(d, o.diasCiclo)}</div>)}
        <div />
        {dias.flatMap((d) => FRANJAS_LISTA.map((f) => <div key={`${d}-${f}`} className={`franja ${f === 3 || f === 5 ? 'tras-descanso' : ''}`} style={{ fontSize: '0.9375rem' }}>{f}</div>))}
        {docentes.map((doc, i) => (
          <FilaDocente key={`${doc.id}-${i}`} nombre={doc.nombre}>
            {dias.flatMap((d, j) => FRANJAS_LISTA.map((f) => (
              <div key={`${d}-${f}`} className={f === 3 || f === 5 ? 'tras-descanso' : undefined} style={{ display: 'grid' }}>
                <CeldaHorario celdas={celdas[i][j][f - 1]} dia={d} franja={f} o={o} />
              </div>
            )))}
          </FilaDocente>
        ))}
      </div>
    </div>
  )
}

const FilaDocente = ({ nombre, children }: { nombre: string; children: React.ReactNode }) => (
  <>
    <div className="nombre">{nombre}</div>
    {children}
  </>
)
