import { useRef, useState } from 'react'
import { leerHorarioPdf } from '../../datos/horarioPdf'
import { diferenciasConColegio, emparejarDocentes, versionDesdeHorario, type HorarioLeido } from '../../dominio/importarHorario'
import { abrirColegio, borrarColegio, cargarColegios, guardarColegios, type ColegioGuardado } from '../../datos/colegios'
import { borrarBorrador, nombreHorario, renombrarHorario, resumenVersion } from '../../dominio/borradores'
import type { Estado, Id } from '../../dominio/tipos'
import { NuevaVersion, useAbrirVersion } from '../Borradores'
import { Aviso, Icono, Renombrar } from '../componentes'
import { codigoNuevo, TEXTO_ESTADO, useEnLinea } from '../enLinea'
import { useEstado } from '../estado'

const cuando = (iso: string) => {
  const f = new Date(iso)
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Una fila de la tabla de versiones: lo que tiene cada una, para compararlas de un vistazo. */
function FilaVersion({ nombre, estado, enUso, guardado, acciones }: { nombre: string; estado: Estado; enUso?: boolean; guardado?: string; acciones: React.ReactNode }) {
  const r = resumenVersion(estado)
  return (
    <tr aria-current={enUso || undefined}>
      <th scope="row">
        {nombre} {enUso && <span className="ficha bien">En uso</span>}
      </th>
      <td className="num">{r.grupos}</td>
      <td className="num">{r.docentes}</td>
      <td className="num">{r.horas}</td>
      <td>{r.clases ? `${r.clases} clases` : 'Sin horario'}</td>
      <td>{r.clases ? <span className={`ficha ${r.cruces ? 'error' : 'bien'}`}>{r.cruces ? `${r.cruces} ${r.cruces === 1 ? 'pendiente' : 'pendientes'}` : 'Sin cruces'}</span> : '—'}</td>
      <td className="suave">{guardado ? cuando(guardado) : 'Ahora'}</td>
      <td><span className="fila" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>{acciones}</span></td>
    </tr>
  )
}

export function Versiones() {
  const { estado, cambiar, reemplazar, confirmar, avisar } = useEstado()
  const enLinea = useEnLinea()
  const abrirVersion = useAbrirVersion()
  const [otros, setOtros] = useState<ColegioGuardado[]>(cargarColegios)
  const [nueva, setNueva] = useState(false)
  const [renombrando, setRenombrando] = useState<Id | null | undefined>(undefined) // null = la versión en uso
  const versiones = estado.borradores ?? []
  const archivo = useRef<HTMLInputElement>(null)
  const [importado, setImportado] = useState<{ leido: HorarioLeido; nombre: string; equivalencias: Record<string, Id | ''> } | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const leerPdf = async (f?: File) => {
    if (!f) return
    setLeyendo(true)
    try {
      setImportado({ leido: await leerHorarioPdf(f), nombre: `Importada: ${f.name.replace(/\.pdf$/i, '')}`, equivalencias: {} })
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo leer el PDF.')
    } finally {
      setLeyendo(false)
      if (archivo.current) archivo.current.value = ''
    }
  }

  /** Guarda la lista de colegios y pone `abierto` en pantalla; si el navegador no deja guardar, no cambia nada. */
  const cambiarColegio = ({ otros: lista, estado: abierto, enlace }: ReturnType<typeof abrirColegio>, mensaje: string) => {
    if (!guardarColegios(lista)) return avisar('Este navegador no dejó guardar. Guarda un respaldo antes de cambiar de colegio.')
    setOtros(lista)
    reemplazar(abierto)
    // Cada colegio conserva su conexión en línea: el que se cierra la guarda y el que se abre la recupera.
    enLinea.cambiarEnlace(enlace, abierto)
    avisar(mensaje)
  }
  const nombreEn = (id: Id | null, nombre: string, guardar: (n: string) => void) =>
    renombrando === id ? <Renombrar inicial={nombre} alCancelar={() => setRenombrando(undefined)} alGuardar={(n) => { guardar(n); setRenombrando(undefined) }} /> : null

  return (
    <>
      <header className="cabecera">
        <h2>Colegios y versiones</h2>
        <button
          className="boton"
          onClick={() => confirmar({
            titulo: 'Nuevo colegio',
            mensaje: `Se abre un colegio vacío. «${estado.colegio.nombre}» queda guardado con todas sus versiones en «Otros colegios» y lo puedes volver a abrir cuando quieras.`,
            boton: 'Sí, crear un colegio nuevo',
            accion: () => {
              cambiarColegio(abrirColegio(otros, estado, null, undefined, enLinea.enlace), `«${estado.colegio.nombre}» quedó guardado. Empieza por los datos del colegio nuevo.`)
            },
          })}
        >
          <Icono nombre="mas" />Nuevo colegio
        </button>
        <p className="guia">
          Cada colegio guarda sus datos y sus versiones del horario. Cada versión es una copia completa: docentes, aulas, grupos, reglas, asignación y
          horario. La versión en uso es la que ves y cambias en las demás pantallas; lo que cambies ahí no toca las otras versiones.
        </p>
      </header>

      <section className="panel" aria-labelledby="titulo-colegio-abierto">
        <div className="fila">
          <h3 id="titulo-colegio-abierto">{estado.colegio.nombre} <span className="ficha">Abierto</span></h3>
          <span className="fila empuja">
            <button className="boton chico" disabled={leyendo} onClick={() => archivo.current?.click()}>
              <Icono nombre="subir" tamano={18} />{leyendo ? 'Leyendo…' : 'Importar horario en PDF'}
            </button>
            <button className="boton chico primario" onClick={() => setNueva(true)}><Icono nombre="mas" tamano={18} />Nueva versión</button>
          </span>
          <input ref={archivo} type="file" accept=".pdf,application/pdf" hidden aria-label="Horario general en PDF" onChange={(ev) => leerPdf(ev.target.files?.[0])} />
        </div>
        {nueva && <NuevaVersion alCerrar={() => setNueva(false)} />}
        {importado && <ImportarHorario {...importado} alCambiar={(c) => setImportado({ ...importado, ...c })} alCerrar={() => setImportado(null)} />}
        <div className="tabla-caja">
          <table className="datos tabla-versiones">
            <thead>
              <tr><th>Versión</th><th className="num">Grupos</th><th className="num">Docentes</th><th className="num" title="Horas asignadas por semana">Horas</th><th>Horario</th><th>Cruces</th><th>Guardada</th><th><span className="oculto-visual">Acciones</span></th></tr>
            </thead>
            <tbody>
              {renombrando === null ? (
                <tr><td colSpan={8}>{nombreEn(null, nombreHorario(estado), (n) => cambiar((e) => renombrarHorario(e, null, n)))}</td></tr>
              ) : (
                <FilaVersion
                  nombre={nombreHorario(estado)} estado={estado} enUso
                  acciones={<button className="boton chico icono" aria-label={`Renombrar ${nombreHorario(estado)}`} title="Renombrar" onClick={() => setRenombrando(null)}><Icono nombre="lapiz" tamano={18} /></button>}
                />
              )}
              {versiones.map((v) =>
                renombrando === v.id ? (
                  <tr key={v.id}><td colSpan={8}>{nombreEn(v.id, v.nombre, (n) => cambiar((e) => renombrarHorario(e, v.id, n)))}</td></tr>
                ) : (
                  <FilaVersion
                    key={v.id} nombre={v.nombre} estado={v.estado} guardado={v.guardado}
                    acciones={
                      <>
                        <button className="boton chico primario" aria-label={`Abrir ${v.nombre}`} onClick={() => abrirVersion(v.id, v.nombre)}>Abrir</button>
                        <button className="boton chico icono" aria-label={`Renombrar ${v.nombre}`} title="Renombrar" onClick={() => setRenombrando(v.id)}><Icono nombre="lapiz" tamano={18} /></button>
                        <button
                          className="boton chico icono peligro" aria-label={`Borrar ${v.nombre}`} title="Borrar"
                          onClick={() => confirmar({
                            titulo: `¿Borrar la versión «${v.nombre}»?`, mensaje: 'Se pierden sus datos, su asignación y su horario. Se puede deshacer mientras no cierres la app.',
                            boton: 'Sí, borrar la versión', peligro: true, accion: () => cambiar((e) => borrarBorrador(e, v.id)),
                          })}
                        >
                          <Icono nombre="borrar" tamano={18} />
                        </button>
                      </>
                    }
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
        {versiones.length === 0 && <p className="suave">Este colegio tiene una sola versión. Con «Nueva versión» guardas esta tal como está y pruebas cambios en una copia.</p>}
      </section>

      <PanelEnLinea />

      <section className="panel" aria-labelledby="titulo-otros-colegios">
        <h3 id="titulo-otros-colegios">Otros colegios</h3>
        {otros.length === 0 ? (
          <p className="suave">No hay más colegios. Con «Nuevo colegio» empiezas otro sin perder este.</p>
        ) : (
          <ul className="lista-borradores">
            {otros.map((c) => {
              const nombres = [nombreHorario(c.estado), ...(c.estado.borradores ?? []).map((v) => v.nombre)]
              return (
                <li key={c.id}>
                  <span>
                    <b>{c.estado.colegio.nombre}</b>
                    <span className="detalle">
                      {nombres.length === 1 ? '1 versión' : `${nombres.length} versiones`}: {nombres.join(', ')}{cuando(c.guardado) && ` · guardado el ${cuando(c.guardado)}`}
                    </span>
                  </span>
                  <span className="fila empuja">
                    <button
                      className="boton chico primario" aria-label={`Abrir ${c.estado.colegio.nombre}`}
                      onClick={() => {
                        cambiarColegio(abrirColegio(otros, estado, c.id, undefined, enLinea.enlace), `Abriste «${c.estado.colegio.nombre}». «${estado.colegio.nombre}» quedó guardado.`)
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      className="boton chico icono peligro" aria-label={`Borrar ${c.estado.colegio.nombre}`}
                      onClick={() => confirmar({
                        titulo: `¿Borrar el colegio «${c.estado.colegio.nombre}»?`,
                        mensaje: 'Se borran sus datos y todas sus versiones del horario. No se puede deshacer; si quieres conservarlo, ábrelo y guarda un respaldo antes.',
                        boton: 'Sí, borrar el colegio', peligro: true,
                        accion: () => {
                          const lista = borrarColegio(otros, c.id)
                          if (guardarColegios(lista)) setOtros(lista)
                        },
                      })}
                    >
                      <Icono nombre="borrar" tamano={18} />
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

/** Vista previa de un horario general leído de un PDF, antes de crear la versión. */
function ImportarHorario({ leido, nombre, equivalencias, alCambiar, alCerrar }: {
  leido: HorarioLeido; nombre: string; equivalencias: Record<string, Id | ''>
  alCambiar: (c: { nombre?: string; equivalencias?: Record<string, Id | ''> }) => void; alCerrar: () => void
}) {
  const { estado, cambiar, avisar } = useEstado()
  const { resumen } = versionDesdeHorario(estado, leido, nombre, equivalencias)
  // Los nombres que no coinciden exactamente: la persona confirma a quién corresponde cada uno.
  const dudosos = emparejarDocentes(estado, leido).filter((x) => !x.exacto)
  const grupos = new Set(leido.clases.map((c) => c.grupo)).size
  const nuevos: [string, string[]][] = [['Docentes', resumen.docentesNuevos], ['Grupos', resumen.gruposNuevos], ['Áreas', resumen.areasNuevas]]
  return (
    <form
      className="subpanel"
      aria-label="Importar horario en PDF"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!nombre.trim()) return
        cambiar((e) => versionDesdeHorario(e, leido, nombre.trim(), equivalencias).estado, { talCual: true })
        avisar(`Ahora trabajas en «${nombre.trim()}», con ${resumen.clases} clases del PDF. «${nombreHorario(estado)}» quedó guardada.`)
        alCerrar()
      }}
    >
      <h4>Horario leído del PDF{leido.colegio ? ` de «${leido.colegio}»` : ''}</h4>
      <p>
        {leido.docentes.length} docentes, {grupos} grupos, {leido.dias.length} días y <b>{resumen.clases} clases</b>. Se crea una versión nueva con
        este horario y la asignación que sale de contar sus clases; la versión en uso queda guardada sin cambios.
      </p>
      {diferenciasConColegio(estado, leido).map((a) => <Aviso key={a}>{a}</Aviso>)}
      {resumen.sinAulas && estado.colegio.modeloAula !== 'ninguna' && (
        <p className="suave">El PDF no trae aulas: esta versión queda sin control de aulas. Se puede cambiar en «Colegio → Aulas».</p>
      )}
      {dudosos.length > 0 && (
        <>
          <p><b>Docentes del PDF que no se llaman igual que en el colegio.</b> Revisa a quién corresponde cada uno; la app propone el más parecido.</p>
          <div className="tabla-caja">
            <table className="datos">
              <thead><tr><th>En el PDF</th><th>En el colegio</th></tr></thead>
              <tbody>
                {dudosos.map((x) => (
                  <tr key={x.pdf}>
                    <td>{x.pdf}</td>
                    <td>
                      <select
                        aria-label={`Docente del colegio para ${x.pdf}`} value={x.pdf in equivalencias ? equivalencias[x.pdf] : x.docenteId ?? ''}
                        onChange={(ev) => alCambiar({ equivalencias: { ...equivalencias, [x.pdf]: ev.target.value } })}
                      >
                        <option value="">Agregar como docente nuevo</option>
                        {estado.docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}{d.id === x.docenteId ? ' (sugerido)' : ''}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {nuevos.some(([, n]) => n.length) ? (
        nuevos.filter(([, n]) => n.length).map(([que, n]) => (
          <p key={que} className="suave"><b>{que} que no están en el colegio y se agregan ({n.length}):</b> {n.join(', ')}.</p>
        ))
      ) : (
        <Aviso tipo="bien">Todos los docentes, grupos y áreas del PDF ya están en el colegio.</Aviso>
      )}
      <div className="fila">
        <label className="fila">
          Nombre de la versión
          <input type="text" style={{ minWidth: 280 }} value={nombre} onChange={(ev) => alCambiar({ nombre: ev.target.value })} />
        </label>
        <button className="boton chico primario" disabled={!nombre.trim()}>Crear versión</button>
        <button type="button" className="boton chico" onClick={alCerrar}>Cancelar</button>
      </div>
    </form>
  )
}

/** Compartir el colegio: ponerlo en línea con un código, entrar a uno con su código, o dejar de sincronizar. */
function PanelEnLinea() {
  const { estado, confirmar, avisar } = useEstado()
  const { nube, enlace, estadoNube, crear, entrar, salir } = useEnLinea()
  const [modo, setModo] = useState<null | 'crear' | 'entrar'>(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const intentar = async (accion: () => Promise<void>, hecho: string) => {
    setError('')
    setOcupado(true)
    try {
      await accion()
      avisar(hecho)
      setModo(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo.')
    } finally {
      setOcupado(false)
    }
  }
  const enlacePublico = typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin + location.pathname : null

  return (
    <section className="panel" aria-labelledby="titulo-en-linea">
      <h3 id="titulo-en-linea">En línea</h3>
      {!nube ? (
        <p className="suave">Para compartir un colegio con otras personas hace falta conectar la app a su base de datos en línea. Todavía no está configurada.</p>
      ) : enlace ? (
        <>
          <p>
            «{estado.colegio.nombre}» está en línea con el código <b className="codigo">{enlace.codigo.replace(/(.{4})(?=.)/g, '$1-')}</b>. Quien abra la
            app{enlacePublico ? <> en <a href={enlacePublico}>{enlacePublico}</a></> : ''} y escriba ese código ve y cambia lo mismo que tú, incluidas las incapacidades.
          </p>
          <p className={`ficha ${estadoNube === 'guardado' ? 'bien' : estadoNube === 'guardando' ? '' : 'aviso-ficha'}`} style={{ alignSelf: 'flex-start' }}>{TEXTO_ESTADO[estadoNube]}</p>
          <div className="fila">
            <button
              className="boton chico"
              onClick={() => confirmar({
                titulo: 'Dejar de sincronizar en este computador',
                mensaje: 'El colegio sigue en línea para los demás. Aquí queda una copia que ya no recibe ni envía cambios. Para volver, entra de nuevo con el código.',
                boton: 'Sí, dejar de sincronizar', accion: salir,
              })}
            >
              Dejar de sincronizar aquí
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="suave">
            Pon este colegio en línea con un código y compártelo: quien tenga el código ve y cambia lo mismo que tú, desde cualquier computador.
            Los datos se guardan cifrados con el código.
          </p>
          <div className="fila">
            <button className="boton chico primario" onClick={() => { setModo('crear'); setCodigo(codigoNuevo()); setError('') }}>Poner «{estado.colegio.nombre}» en línea</button>
            <button className="boton chico" onClick={() => { setModo('entrar'); setCodigo(''); setError('') }}>Entrar a un colegio con su código</button>
          </div>
          {modo && (
            <form
              className="subpanel"
              onSubmit={(ev) => {
                ev.preventDefault()
                if (modo === 'crear') void intentar(() => crear(codigo), `«${estado.colegio.nombre}» quedó en línea. Comparte el código con quien deba entrar.`)
                else void intentar(() => entrar(codigo), 'Entraste al colegio en línea.')
              }}
            >
              <label className="campo">
                Código del colegio
                <input type="text" autoComplete="off" spellCheck={false} value={codigo} onChange={(ev) => setCodigo(ev.target.value)} autoFocus />
                {modo === 'crear' && <span className="ayuda">Al menos 8 letras o números. Guárdalo bien: sin él los datos no se pueden abrir.</span>}
              </label>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <div className="fila">
                <button className="boton chico primario" disabled={!codigo.trim() || ocupado}>{ocupado ? 'Un momento…' : modo === 'crear' ? 'Poner en línea' : 'Entrar'}</button>
                <button type="button" className="boton chico" onClick={() => setModo(null)}>Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
