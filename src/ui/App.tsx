import { useEffect, useMemo, useRef, useState } from 'react'
import { cargarEstado, copiaPorRecuperar, exportarRespaldo, importarRespaldo, olvidarCopiaPorRecuperar } from '../datos/almacen'
import { cargarColegios, guardarColegios } from '../datos/colegios'
import { CONFIG_FIREBASE } from '../datos/firebase'
import { nubeFirestore, type Nube } from '../datos/nube'
import { descargar } from '../datos/excel'
import { nuevoId, tieneMediaTecnica } from '../dominio/tiempo'
import { detectarCruces } from '../dominio/cruces'
import { nombreHorario } from '../dominio/borradores'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { normalizarAjuste } from '../dominio/reemplazos'
import type { AjusteDia, Estado } from '../dominio/tipos'
import { Barrera } from './Barrera'
import { Aviso, Icono, type NombreIcono } from './componentes'
import { ProveedorEnLinea, TEXTO_ESTADO, useEnLinea } from './enLinea'
import { Entrada } from './Entrada'
import { ProveedorEstado, useEstado } from './estado'
import './estilos.css'
import { Areas } from './pantallas/Areas'
import { Asignacion } from './pantallas/Asignacion'
import { Colegio } from './pantallas/Colegio'
import { Datos } from './pantallas/Datos'
import { Horario } from './pantallas/Horario'
import { Acompanamiento } from './pantallas/Acompanamiento'
import { Incapacidades } from './pantallas/Incapacidades'
import { MediaTecnica } from './pantallas/MediaTecnica'
import { Versiones } from './pantallas/Versiones'

export type Pantalla = 'versiones' | 'acompanamiento' | 'mediatecnica' | 'colegio' | 'areas' | 'datos' | 'asignacion' | 'horario' | 'incapacidades'

// En el orden del trabajo: preparar los datos, armar el horario, el día a día y, al final, los colegios y versiones.
const PANTALLAS: [Pantalla, string, NombreIcono][] = [
  ['colegio', 'Colegio', 'colegio'],
  ['areas', 'Áreas e intensidad', 'areas'],
  ['datos', 'Grupos, docentes y aulas', 'grupos'],
  ['asignacion', 'Asignación académica', 'asignacion'],
  ['mediatecnica', 'Media técnica', 'tecnica'],
  ['horario', 'Horario', 'horario'],
  ['acompanamiento', 'Acompañamiento', 'zonas'],
  ['incapacidades', 'Incapacidades', 'incapacidades'],
  ['versiones', 'Colegios y versiones', 'versiones'],
]
/** Antes de estas pantallas va una línea que separa las etapas del trabajo. */
const EMPIEZA_ETAPA = new Set<Pantalla>(['horario', 'acompanamiento', 'versiones'])
/** Días desde el último respaldo (Infinity si nunca se guardó). */
const diasSinRespaldo = (fecha?: string) => (fecha ? Math.floor((Date.now() - new Date(`${fecha}T12:00`).getTime()) / 86400000) : Infinity)

const NOMBRE_EJEMPLO = colegioEjemplo().colegio.nombre
const pantallaDeHash = (): Pantalla => PANTALLAS.find(([id]) => `#${id}` === location.hash)?.[0] ?? 'colegio'

const NUBE = CONFIG_FIREBASE ? nubeFirestore(CONFIG_FIREBASE) : null
/** En el enlace publicado hace falta el código del colegio; abierta como archivo en el computador, no. */
const PUBLICADA = typeof location !== 'undefined' && location.protocol.startsWith('http') && !/^(localhost|127\.)/.test(location.hostname)

export function App({ inicial, nube = NUBE, exigirCodigo = PUBLICADA }: { inicial?: Estado; nube?: Nube | null; exigirCodigo?: boolean }) {
  const [estadoInicial] = useState(() => inicial ?? cargarEstado())
  return (
    <Barrera>
      <ProveedorEstado inicial={estadoInicial}>
        <ProveedorEnLinea nube={nube}>
          <Marco exigirCodigo={exigirCodigo} />
        </ProveedorEnLinea>
      </ProveedorEstado>
    </Barrera>
  )
}

function Marco({ exigirCodigo }: { exigirCodigo: boolean }) {
  const { estado, cambiar, reemplazar, deshacer, puedeDeshacer, guardado, confirmar, avisar } = useEstado()
  const enLinea = useEnLinea()
  const [porRecuperar, setPorRecuperar] = useState(copiaPorRecuperar)
  const [pantalla, setPantalla] = useState<Pantalla>(pantallaDeHash)
  const archivo = useRef<HTMLInputElement>(null)
  // Fecha que se está viendo en el horario con sus ajustes por incapacidad ('' = horario base).
  const [fecha, setFecha] = useState('')
  /** Grupo que el horario debe mostrar al llegar desde Incapacidades. */
  const [grupoInicial, setGrupoInicial] = useState<string | undefined>()
  /** Día de incapacidades que se está armando y aún no se guarda. */
  const [borradorDia, setBorradorDia] = useState<AjusteDia | null>(null)

  useEffect(() => {
    const alCambiar = () => setPantalla(pantallaDeHash())
    addEventListener('hashchange', alCambiar)
    return () => removeEventListener('hashchange', alCambiar)
  }, [])
  const ir = (p: Pantalla) => {
    setPantalla(p)
    history.replaceState(null, '', `#${p}`)
    scrollTo?.({ top: 0 })
  }

  // Solo cuando cambian los datos (no en cada aviso o cambio de pantalla).
  const cruces = useMemo(() => detectarCruces(estado).length, [estado])
  const guardarRespaldo = () => {
    const hoy = new Date().toLocaleDateString('sv')
    cambiar((e) => ({ ...e, ultimoRespaldo: hoy }))
    descargar(new Blob([exportarRespaldo({ ...estado, ultimoRespaldo: hoy })], { type: 'application/json' }), `Respaldo ${estado.colegio.nombre.replace(/[\\/:*?"<>|]/g, '-')} ${hoy}.json`)
    avisar('Respaldo guardado en tu carpeta de descargas.')
  }
  const abrirRespaldo = async (f?: File) => {
    if (!f) return
    try {
      const nuevo = importarRespaldo(await f.text())
      // El respaldo de otro colegio no pisa el abierto: este queda en «Otros colegios».
      if (nuevo.colegio.nombre !== estado.colegio.nombre) {
        const otros = cargarColegios()
        const repetido = otros.some((c) => c.estado.colegio.nombre === nuevo.colegio.nombre)
        return confirmar({
          titulo: `¿Abrir «${nuevo.colegio.nombre}»?`,
          mensaje: `«${estado.colegio.nombre}» queda guardado con sus versiones en «Colegios y versiones», y lo puedes volver a abrir cuando quieras.${repetido ? ` El «${nuevo.colegio.nombre}» que ya estaba en la lista se reemplaza por el del respaldo.` : ''}`,
          boton: 'Sí, abrir el respaldo',
          accion: () => {
            const lista = [...otros.filter((c) => c.estado.colegio.nombre !== nuevo.colegio.nombre), { id: nuevoId(), guardado: new Date().toISOString(), estado, ...(enLinea.enlace ? { enlace: enLinea.enlace } : {}) }]
            if (!guardarColegios(lista))
              return avisar('Este navegador no dejó guardar. Guarda un respaldo del colegio abierto antes de abrir otro.')
            reemplazar(nuevo)
            enLinea.cambiarEnlace(null, nuevo)
            avisar(`Abriste «${nuevo.colegio.nombre}».`)
          },
        })
      }
      confirmar({
        titulo: '¿Abrir este respaldo?',
        mensaje: `Se reemplazan los datos de «${nuevo.colegio.nombre}» que están abiertos por los del respaldo. Si quieres conservar lo actual, guarda antes un respaldo.`,
        boton: 'Sí, abrir el respaldo',
        accion: () => cambiar(() => nuevo, { talCual: true }),
      })
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
    }
  }

  if (exigirCodigo && enLinea.nube && !enLinea.enlace) return <Entrada />

  return (
    <div className="app">
      <aside className="riel">
        <h1>Horarios escolares</h1>
        <p className="colegio">
          {estado.colegio.nombre}
          {(estado.borradores?.length ?? 0) > 0 && <span className="version">Versión: {nombreHorario(estado)}</span>}
          {enLinea.enlace && <span className={`en-linea ${enLinea.estadoNube}`}>{TEXTO_ESTADO[enLinea.estadoNube]}</span>}
        </p>
        <nav aria-label="Pantallas">
          {PANTALLAS.filter(([id]) => id !== 'mediatecnica' || tieneMediaTecnica(estado) || pantalla === id).map(([id, nombre, icono]) => (
            <button key={id} className={EMPIEZA_ETAPA.has(id) ? 'etapa' : undefined} aria-current={pantalla === id ? 'page' : undefined} onClick={() => ir(id)}>
              <Icono nombre={icono} />
              {nombre}
              {id === 'horario' && cruces > 0 && <span className="marca" title={`${cruces} cruces pendientes`}>{cruces}</span>}
            </button>
          ))}
        </nav>
        <div className="pie">
          <p>{guardado ? 'Los cambios se guardan solos en este navegador.' : 'Este navegador no deja guardar. Guarda un respaldo antes de cerrar.'}</p>
          {diasSinRespaldo(estado.ultimoRespaldo) > 7 ? (
            // Los datos viven en el navegador: sin respaldo reciente, un borrado de Chrome lo pierde todo.
            <p className="recordatorio"><Icono nombre="alerta" tamano={16} />{estado.ultimoRespaldo ? `Último respaldo hace ${diasSinRespaldo(estado.ultimoRespaldo)} días` : 'Aún no has guardado un respaldo'}</p>
          ) : (
            <p>Último respaldo: {estado.ultimoRespaldo}</p>
          )}
          <button className="boton chico" onClick={deshacer} disabled={!puedeDeshacer}><Icono nombre="deshacer" tamano={18} />Deshacer último cambio</button>
          <button className={`boton chico ${diasSinRespaldo(estado.ultimoRespaldo) > 7 ? 'resaltado' : ''}`} onClick={guardarRespaldo}><Icono nombre="bajar" tamano={18} />Guardar respaldo</button>
          <button className="boton chico" onClick={() => archivo.current?.click()}><Icono nombre="subir" tamano={18} />Abrir respaldo</button>
          <input
            ref={archivo} type="file" accept=".json,application/json" hidden
            onChange={(ev) => {
              void abrirRespaldo(ev.target.files?.[0])
              ev.target.value = ''
            }}
          />
        </div>
      </aside>
      <main className="contenido">
        {porRecuperar && (
          <Aviso
            tipo="error"
            acciones={
              <>
                <button className="boton chico" onClick={() => descargar(new Blob([porRecuperar], { type: 'application/json' }), 'Datos anteriores por recuperar.json')}>Descargar esa copia</button>
                <button className="boton chico" onClick={() => { olvidarCopiaPorRecuperar(); setPorRecuperar(null) }}>Entendido</button>
              </>
            }
          >
            Lo que estaba guardado en este navegador no se pudo leer y la app abrió el colegio de ejemplo. Guardé aparte una copia de esos datos por si se pueden rescatar.
          </Aviso>
        )}
        {estado.colegio.nombre === NOMBRE_EJEMPLO && (
          <Aviso
            tipo="info"
            acciones={
              <button
                className="boton chico"
                onClick={() =>
                  confirmar({
                    titulo: '¿Empezar con tu colegio?',
                    mensaje: 'Se borra el colegio de ejemplo: grupos, docentes, aulas, asignación y horario. Quedan las áreas y la intensidad horaria iniciales para que las ajustes.',
                    boton: 'Sí, borrar el ejemplo',
                    peligro: true,
                    accion: () => cambiar(() => estadoVacio()),
                  })
                }
              >
                Empezar con mi colegio
              </button>
            }
          >
            Estás viendo un <b>colegio de ejemplo</b> para conocer la app. Puedes cambiar lo que quieras sin dañar nada.
          </Aviso>
        )}
        {pantalla === 'versiones' && <Versiones />}
        {pantalla === 'colegio' && <Colegio />}
        {pantalla === 'acompanamiento' && <Acompanamiento alIr={ir} />}
        {pantalla === 'areas' && <Areas />}
        {pantalla === 'mediatecnica' && <MediaTecnica alIr={ir} />}
        {pantalla === 'datos' && <Datos />}
        {pantalla === 'asignacion' && <Asignacion />}
        {pantalla === 'horario' && <Horario alIr={ir} fecha={fecha} alCambiarFecha={setFecha} grupoInicial={grupoInicial} />}
        {pantalla === 'incapacidades' && (
          <Incapacidades
            alIr={ir}
            borrador={borradorDia && normalizarAjuste(estado, borradorDia)}
            alCambiarBorrador={setBorradorDia}
            alVerDia={(f, grupoId) => {
              setFecha(f)
              setGrupoInicial(grupoId)
              ir('horario')
            }}
          />
        )}
      </main>
    </div>
  )
}
