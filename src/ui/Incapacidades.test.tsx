// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { asg, cls, doc, grp, mini } from '../dominio/ayudaPruebas'
import { colegioEjemplo } from '../dominio/ejemplo'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
})

const abrir = (nombre: RegExp) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: nombre }))
const MARTES = '2026-11-10'

/** Martes de 7-1: Zoe, Yuri, Ana, Ana, Zoe, Yuri. Zoe además dicta a 8-1 en la franja 3. Bea es de matemáticas y está libre. */
const colegio = () =>
  mini({
    areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'len', nombre: 'Lengua Castellana', afines: [] }, { id: 'ing', nombre: 'Inglés', afines: [] }],
    grupos: [grp('a', 7), grp('b', 8), grp('p', 3)],
    docentes: [
      doc('d', { nombre: 'Ana Ruiz' }), doc('y', { nombre: 'Yuri Paz', areaId: 'len' }), doc('z', { nombre: 'Zoe Gil', areaId: 'ing' }),
      doc('v', { nombre: 'Bea Mora' }), doc('t', { nombre: 'Tito Luna', nivel: 'primaria', rolPrimaria: 'titular', direccionGrupoId: 'p', cargaSemanal: 25 }),
    ],
    asignaciones: [asg('d', 'a', 'mat', 30), asg('y', 'a', 'len', 30), asg('z', 'a', 'ing', 30), asg('z', 'b', 'ing', 30), asg('t', 'p', 'len', 30)],
    clases: [
      cls('z|a|ing', 2, 1, { id: 'z1' }), cls('y|a|len', 2, 2, { id: 'y2' }), cls('d|a|mat', 2, 3, { id: 'd3' }),
      cls('d|a|mat', 2, 4, { id: 'd4' }), cls('z|a|ing', 2, 5, { id: 'z5' }), cls('y|a|len', 2, 6, { id: 'y6' }),
      cls('z|b|ing', 2, 3, { id: 'zb3' }),
      ...[1, 2, 3, 4, 5, 6].map((f) => cls('t|p|len', 2, f, { id: `tp${f}` })),
    ],
  })

const registrar = (docente: string, franjas?: number[]) => {
  fireEvent.change(screen.getByLabelText('Fecha de la ausencia'), { target: { value: MARTES } })
  fireEvent.change(screen.getByLabelText('Docente ausente'), { target: { value: docente } })
  if (franjas) {
    fireEvent.click(screen.getByLabelText('Todo el día'))
    for (const f of franjas) fireEvent.click(screen.getByLabelText(`Franja ${f}`))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Registrar ausencia' }))
}

describe('pantalla de incapacidades', () => {
  it('sin horario explica que primero hay que generarlo', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir(/Incapacidades/)
    expect(screen.getByText(/se registran cuando ya hay un horario/)).toBeTruthy()
  })
  it('registra una ausencia, lista las clases sin docente y guarda el reemplazo elegido', () => {
    render(<App inicial={colegio()} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    expect(screen.getByRole('heading', { name: /martes 10 de noviembre/i })).toBeTruthy()
    expect(screen.getByText('Horas sin cubrir: 2')).toBeTruthy()
    const reemplazo = screen.getByLabelText('Reemplazo para Matemáticas de 7-1 en la franja 3')
    expect(within(reemplazo).getByRole('option', { name: /Bea Mora · misma área/ })).toBeTruthy()
    expect(within(reemplazo).queryByRole('option', { name: /Zoe Gil/ })).toBeNull() // dicta a 8-1 a esa hora
    fireEvent.change(reemplazo, { target: { value: 'v' } })
    expect(screen.getByText('Horas cubiertas: 1')).toBeTruthy()
    expect(screen.getByText('Horas sin cubrir: 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    const registro = screen.getByRole('table', { name: 'Registro de horas cubiertas' })
    expect(within(registro).getByText('Bea Mora')).toBeTruthy()
  })
  it('propone reorganizar el día para que el grupo llegue tarde o salga temprano', () => {
    const e = colegio()
    e.docentes = e.docentes.filter((d) => d.id !== 'v')
    // Yuri y Zoe tienen el lunes y el miércoles llenos: no pueden reemplazar, pero sus clases del martes sí se pueden mover.
    for (const dia of [1, 3]) for (let f = 1; f <= 6; f++) e.clases.push(cls('y|a|len', dia, f), cls('z|b|ing', dia, f))
    render(<App inicial={e} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    expect(screen.getAllByText(/Nadie cumple las condiciones/).length).toBe(2)
    fireEvent.click(screen.getByLabelText(/El grupo llega tarde ·/))
    expect(screen.getByText('Grupos que llegan tarde: 7-1')).toBeTruthy()
    expect(screen.getByText(/Docentes que cambian de clase: Yuri Paz, Zoe Gil/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/El grupo sale temprano ·/))
    expect(screen.getByText('Grupos que salen temprano: 7-1')).toBeTruthy()
  })
  it('pregunta cómo cubrir: con el reemplazo que más convenga, y lo deja en el resumen para el correo', () => {
    render(<App inicial={colegio()} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    fireEvent.click(screen.getByLabelText(/Con el reemplazo que más convenga/))
    const correo = screen.getByLabelText('Para docentes (correo institucional)') as HTMLTextAreaElement
    expect(correo.value).toContain('7-1, 3.ª hora, Matemáticas: la cubre Bea Mora, en aula-a.')
    expect(correo.value).toContain('Falta Ana Ruiz (3.ª y 4.ª hora)')
  })
  it('sin reemplazo pregunta si llegan tarde o salen temprano y arma el mensaje para las familias', () => {
    const e = colegio()
    e.docentes = e.docentes.filter((d) => d.id !== 'v')
    for (const dia of [1, 3]) for (let f = 1; f <= 6; f++) e.clases.push(cls('y|a|len', dia, f), cls('z|b|ing', dia, f))
    render(<App inicial={e} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    fireEvent.click(screen.getByLabelText(/Sin reemplazo/))
    expect(screen.getByText('¿Prefieres que el grupo llegue tarde o que salga temprano?')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Que lleguen tarde'))
    const familias = screen.getByLabelText('Para familias (WhatsApp)') as HTMLTextAreaElement
    expect(familias.value).toContain('Grupo 7-1: ingresa a la 3.ª hora.')
    const correo = screen.getByLabelText('Para docentes (correo institucional)') as HTMLTextAreaElement
    expect(correo.value).toMatch(/Yuri Paz: Lengua Castellana con 7-1 pasa de la 2\.ª a la \d\.ª hora/)
    fireEvent.click(screen.getByLabelText('Que salgan temprano'))
    expect(familias.value).toContain('Grupo 7-1: sale al terminar la 4.ª hora.')
  })
  it('con las horas de las franjas escritas en Colegio, el aviso a familias dice la hora de entrada', () => {
    const e = colegio()
    e.docentes = e.docentes.filter((d) => d.id !== 'v')
    for (const dia of [1, 3]) for (let f = 1; f <= 6; f++) e.clases.push(cls('y|a|len', dia, f), cls('z|b|ing', dia, f))
    render(<App inicial={e} />)
    abrir(/^Colegio$/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Llenar con un horario típico' })[0])
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    fireEvent.click(screen.getByLabelText(/Sin reemplazo/))
    fireEvent.click(screen.getByLabelText('Que lleguen tarde'))
    const familias = screen.getByLabelText('Para familias (WhatsApp)') as HTMLTextAreaElement
    expect(familias.value).toContain('Grupo 7-1: ingresa a las 8:50 a. m. (3.ª hora).')
  })
  it('el día sin guardar no se pierde al ir a otra pantalla y avisa que falta guardarlo', () => {
    render(<App inicial={colegio()} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    expect(screen.getByText(/cambios sin guardar/)).toBeTruthy()
    abrir(/^Colegio$/)
    abrir(/Incapacidades/)
    expect(screen.getByText('Horas sin cubrir: 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    expect(screen.queryByText(/cambios sin guardar/)).toBeNull()
  })
  it('en primaria permite marcar que falta todo el grupo', () => {
    render(<App inicial={colegio()} />)
    abrir(/Incapacidades/)
    registrar('t')
    expect(screen.getByText('Horas sin cubrir: 6')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Falta todo el grupo/))
    expect(screen.getByText('Horas sin cubrir: 0')).toBeTruthy()
    expect(screen.getByText('Grupos que no asisten: 3-1')).toBeTruthy()
  })
  it('el día guardado se ve en el horario y el horario base no cambia', () => {
    render(<App inicial={colegio()} />)
    abrir(/Incapacidades/)
    registrar('d', [3, 4])
    fireEvent.change(screen.getByLabelText('Reemplazo para Matemáticas de 7-1 en la franja 3'), { target: { value: 'v' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    fireEvent.click(screen.getByRole('button', { name: /Ver este día en el horario/ }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Horario')
    expect(screen.getByText(/Bea Mora \(reemplazo\)/)).toBeTruthy()
    expect(screen.getByText('Sin docente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al horario base' }))
    expect(screen.queryByText(/Bea Mora \(reemplazo\)/)).toBeNull()
    expect(screen.getAllByRole('button', { name: /Matemáticas, Ana Ruiz/ })).toHaveLength(2)
  })
})
