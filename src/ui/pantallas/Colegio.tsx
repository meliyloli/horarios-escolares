import { avisosAulas } from '../../dominio/cruces'
import { cambiarCicloColegio } from '../../dominio/edicion'
import { estadoVacio } from '../../dominio/ejemplo'
import type { Ciclo, ModeloAula, Reglas } from '../../dominio/tipos'
import { aNumero, Aviso, Campo, Icono } from '../componentes'
import { useEstado } from '../estado'

const MODELOS: [ModeloAula, string, string][] = [
  ['grupo', 'Cada grupo tiene su aula', 'Los docentes van al aula del grupo.'],
  ['docente', 'Cada docente tiene su aula', 'Los grupos van al aula del docente.'],
  ['mixto', 'Mixto', 'Algunos docentes tienen aula fija y los grupos rotan solo para ellos. Los demás van al aula del grupo.'],
  ['ninguna', 'Sin aulas', 'El horario no asigna aulas: no se revisan ni se muestran. Útil si no hace falta llevar ese control.'],
  ['libre', 'Aula fija para algunos, aula libre para los demás', 'Los docentes que marques tienen su aula. Los demás dictan en un aula que esté libre a esa hora, incluida la de un docente con aula fija cuando no tiene clase.'],
]

export function Colegio() {
  const { estado, cambiar, confirmar, avisar, guardarAhora } = useEstado()
  const { colegio } = estado
  const { reglas } = colegio
  const colegioCon = (c: Partial<typeof colegio>) => cambiar((e) => ({ ...e, colegio: { ...e.colegio, ...c } }))
  const reglasCon = (r: Partial<Reglas>) => colegioCon({ reglas: { ...reglas, ...r } })
  const avisos = avisosAulas(estado)
  const bloques = reglas.bloques ?? { activa: false, primaria: false }
  const espaciar = reglas.espaciarMaterias ?? { activa: false, horas: 4 }
  const cambiarCiclo = (c: Ciclo) => {
    if (c === colegio.ciclo) return
    const aplicar = () => cambiar((e) => cambiarCicloColegio(e, c))
    if (estado.clases.length === 0) return aplicar()
    confirmar({
      titulo: `¿Cambiar el ciclo a ${c} días?`,
      mensaje: c === 5
        ? 'Las horas de la asignación se dividen entre dos y se borran las clases de los días 6 a 10. Después hay que generar el horario de nuevo.'
        : 'Las horas de la asignación se duplican. Después hay que generar el horario de nuevo para ubicar las horas nuevas.',
      boton: 'Sí, cambiar el ciclo', accion: aplicar,
    })
  }

  return (
    <>
      <header className="cabecera">
        <h2>Colegio</h2>
        <button
          className="boton primario"
          onClick={() => avisar(guardarAhora() ? 'Colegio guardado en este navegador.' : 'Este navegador no dejó guardar. Usa «Guardar respaldo» para no perder el trabajo.')}
        >
          <Icono nombre="bien" />Guardar colegio
        </button>
        <p className="guia">Empieza aquí: el nombre, el ciclo, cómo se usan las aulas y las reglas que debe cumplir el horario. Cada cambio se guarda solo; el botón «Guardar colegio» lo confirma.</p>
      </header>

      <section className="panel">
        <h3>Datos generales</h3>
        <Campo etiqueta="Nombre del colegio">
          <input type="text" value={colegio.nombre} onChange={(ev) => colegioCon({ nombre: ev.target.value })} />
        </Campo>
        <fieldset className="pila" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend><h4>Ciclo del horario</h4></legend>
          <div className="opciones">
            {([5, 10] as Ciclo[]).map((c) => (
              <label key={c} className="opcion">
                <input type="radio" name="ciclo" checked={colegio.ciclo === c} onChange={() => cambiarCiclo(c)} />
                <span>
                  <b>{c} días</b>
                  {c === 5 ? 'La semana se repite igual. Carga de 22 horas en bachillerato y 25 en primaria.' : 'El horario se arma para 10 días. Carga de 44 horas en bachillerato y 50 en primaria.'}
                </span>
              </label>
            ))}
          </div>
          <p className="suave">Al cambiar el ciclo, las horas de la asignación académica se duplican o se dividen solas. Un grupo puede usar un ciclo distinto al del colegio; se cambia en la lista de grupos.</p>
        </fieldset>
      </section>

      <section className="panel">
        <h3>Aulas</h3>
        <p className="suave">Cada clase del horario lleva un aula. Elige cómo se reparten.</p>
        <div className="opciones">
          {MODELOS.map(([id, nombre, detalle]) => (
            <label key={id} className="opcion">
              <input type="radio" name="modelo" checked={colegio.modeloAula === id} onChange={() => colegioCon({ modeloAula: id })} />
              <span><b>{nombre}</b>{detalle}</span>
            </label>
          ))}
        </div>
        {colegio.modeloAula !== 'grupo' && (
          <p className="suave">El aula fija de cada docente se elige en «Grupos, docentes y aulas», en la ficha del docente.</p>
        )}
        {avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
      </section>

      <section className="panel">
        <h3>Reglas del horario</h3>
        <p className="suave">Activa las que apliquen en tu colegio. El generador las cumple todas y la app avisa si un cambio a mano rompe alguna.</p>

        <label className="marca">
          <input type="checkbox" checked={reglas.maxMateriaDia.activa} onChange={(ev) => reglasCon({ maxMateriaDia: { ...reglas.maxMateriaDia, activa: ev.target.checked } })} />
          Máximo de horas de la misma materia por grupo y por día
          <input
            type="number" min={1} max={6} aria-label="Máximo de horas de la misma materia" disabled={!reglas.maxMateriaDia.activa}
            value={reglas.maxMateriaDia.valor} onChange={(ev) => reglasCon({ maxMateriaDia: { ...reglas.maxMateriaDia, valor: Math.max(1, aNumero(ev.target.value)) } })}
          />
        </label>

        <label className="marca">
          <input type="checkbox" checked={reglas.maxDocenteDia.activa} onChange={(ev) => reglasCon({ maxDocenteDia: { ...reglas.maxDocenteDia, activa: ev.target.checked } })} />
          Máximo de horas con el mismo docente por grupo y por día
          <input
            type="number" min={1} max={6} aria-label="Máximo de horas con el mismo docente" disabled={!reglas.maxDocenteDia.activa}
            value={reglas.maxDocenteDia.valor} onChange={(ev) => reglasCon({ maxDocenteDia: { ...reglas.maxDocenteDia, valor: Math.max(1, aNumero(ev.target.value)) } })}
          />
        </label>
        <p className="suave" style={{ marginLeft: 30 }}>Aplica en bachillerato. En primaria nunca se aplica al docente titular.</p>
        <label className="marca" style={{ marginLeft: 30 }}>
          <input
            type="checkbox" disabled={!reglas.maxDocenteDia.activa} checked={reglas.maxDocenteDia.aplicaEspecialistas}
            onChange={(ev) => reglasCon({ maxDocenteDia: { ...reglas.maxDocenteDia, aplicaEspecialistas: ev.target.checked } })}
          />
          Aplicarla también a los especialistas de primaria (inglés, educación física, artes)
        </label>

        <label className="marca">
          <input type="checkbox" checked={reglas.horaLibre.activa} onChange={(ev) => reglasCon({ horaLibre: { activa: ev.target.checked } })} />
          Hora libre: si un docente tiene 6 clases un día, el día anterior o el siguiente debe tener al menos una franja sin clase
        </label>

        <label className="marca">
          <input type="checkbox" checked={!!reglas.libreDiaria?.activa} onChange={(ev) => reglasCon({ libreDiaria: { activa: ev.target.checked } })} />
          Una hora libre todos los días: cada docente tiene al menos una franja sin clase cada día que está en el colegio
        </label>

        <label className="marca">
          <input type="checkbox" checked={!!reglas.cargaPareja?.activa} onChange={(ev) => reglasCon({ cargaPareja: { activa: ev.target.checked } })} />
          Carga pareja: repartir las clases de cada docente entre los días, sin un día recargado y otro con muchas horas libres
        </label>
        <p className="suave" style={{ marginLeft: 30 }}>
          De un día a otro, las horas libres de un docente difieren a lo sumo en una. Con 22 horas, por ejemplo, queda con 4 o 5 clases cada día.
        </p>

        <label className="marca">
          <input type="checkbox" checked={!!reglas.espaciarMaterias?.activa} onChange={(ev) => reglasCon({ espaciarMaterias: { horas: espaciar.horas, activa: ev.target.checked } })} />
          Materias cortas en días separados: una materia de estas horas o menos por semana no se dicta en dos días seguidos
          <input
            type="number" min={1} max={10} aria-label="Horas por semana de una materia corta" disabled={!espaciar.activa}
            value={espaciar.horas ?? 4} onChange={(ev) => reglasCon({ espaciarMaterias: { ...espaciar, horas: Math.min(10, Math.max(1, Math.round(aNumero(ev.target.value)))) } })}
          />
        </label>
        <p className="suave" style={{ marginLeft: 30 }}>
          Sus bloques o sus horas sueltas quedan con al menos un día de por medio, por ejemplo lunes y miércoles, o lunes, miércoles y viernes.
          Cuenta todas las horas de la materia en el grupo, aunque la dicten dos docentes. No se aplica si no se puede cumplir con el máximo de horas por día.
        </p>

        <label className="marca">
          <input type="checkbox" checked={bloques.activa} onChange={(ev) => reglasCon({ bloques: { ...bloques, activa: ev.target.checked } })} />
          Clases en bloque: preferir dos horas seguidas de la misma materia todas las veces que se pueda
        </label>
        <p className="suave" style={{ marginLeft: 30 }}>
          Un bloque ocupa las franjas 1 y 2, 3 y 4, o 5 y 6, sin descanso en medio. Aplica en bachillerato. Las horas que no quepan en bloque quedan sueltas.
        </p>
        <label className="marca" style={{ marginLeft: 30 }}>
          <input type="checkbox" disabled={!bloques.activa} checked={bloques.primaria} onChange={(ev) => reglasCon({ bloques: { ...bloques, primaria: ev.target.checked } })} />
          Armar bloques también en primaria
        </label>
        <label className="marca">
          <input type="checkbox" checked={!!reglas.bloquesDeDos?.activa} onChange={(ev) => reglasCon({ bloquesDeDos: { activa: ev.target.checked } })} />
          Materias de 2 horas siempre en bloque: si un docente dicta una materia de 2 horas por semana a un grupo, van juntas
        </label>
        <p className="suave" style={{ marginLeft: 30 }}>
          Las dos horas quedan el mismo día en las franjas 1 y 2, 3 y 4, o 5 y 6, en bachillerato y en primaria. Funciona aunque la regla anterior
          esté apagada. No se aplica a las materias que nunca van en bloque ni si el máximo de horas por día es 1.
        </p>
        <fieldset className="pila" style={{ border: 0, padding: 0, margin: '0 0 0 30px', gap: 8 }} disabled={!bloques.activa && !reglas.bloquesDeDos?.activa}>
          <legend className="suave" style={{ marginBottom: 6 }}>Materias que nunca van en bloque: quedan en horas sueltas, sin dos horas pegadas el mismo día (franjas 1-2, 3-4 o 5-6).</legend>
          <div className="fila" style={{ gap: '6px 16px' }}>
            {estado.areas.map((a) => (
              <label key={a.id} className="marca" style={{ margin: 0 }}>
                <input
                  type="checkbox" checked={!!bloques.sinBloque?.includes(a.id)}
                  onChange={(ev) => reglasCon({ bloques: { ...bloques, sinBloque: ev.target.checked ? [...(bloques.sinBloque ?? []), a.id] : (bloques.sinBloque ?? []).filter((x) => x !== a.id) } })}
                />
                {a.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="marca">
          Mínimo de horas por semana en el área de nombramiento
          <input
            type="number" min={0} max={25} aria-label="Mínimo de horas en el área de nombramiento"
            value={reglas.minimoAreaNombramiento} onChange={(ev) => reglasCon({ minimoAreaNombramiento: aNumero(ev.target.value) })}
          />
        </label>
        <p className="suave" style={{ marginLeft: 0 }}>No se revisa a los docentes titulares de primaria.</p>

        <Aviso tipo="info">
          <b>Reglas que nunca se rompen:</b> un docente, un grupo o un aula no pueden estar en dos clases a la misma franja; cada docente cumple
          exactamente su carga y su disponibilidad; cada día tiene 6 franjas con descanso después de la 2.ª y de la 4.ª.
        </Aviso>
      </section>

      <section className="panel">
        <h3>Empezar de cero</h3>
        <p className="suave">Borra grupos, docentes, aulas, asignación, horario e incapacidades, y deja las áreas y la intensidad horaria iniciales. Si quieres conservar lo actual, guarda antes un respaldo.</p>
        <div className="fila">
          <button
            className="boton peligro"
            onClick={() =>
              confirmar({
                titulo: '¿Borrar todo y empezar de cero?', mensaje: 'Se borra todo lo de este colegio. Se puede deshacer mientras no cierres la app.',
                boton: 'Sí, borrar todo', peligro: true, accion: () => cambiar(() => estadoVacio()),
              })
            }
          >
            <Icono nombre="borrar" tamano={18} />Borrar todo y empezar de cero
          </button>
        </div>
      </section>
    </>
  )
}
