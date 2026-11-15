// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { asg, cargaDispareja, cls, doc, grp, mini } from '../dominio/ayudaPruebas'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
})

const abrirHorario = () => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Horario/ }))
const chico = () =>
  mini({
    areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'len', nombre: 'Lengua Castellana', afines: [] }],
    grupos: [grp('a', 7), grp('b', 8)],
    docentes: [doc('d', { nombre: 'Ana Ruiz', cargaSemanal: 2 }), doc('x', { nombre: 'Luis Gil', areaId: 'len', cargaSemanal: 1 })],
    asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1), asg('x', 'a', 'len', 1)],
    clases: [cls('d|a|mat', 1, 1, { id: 'ma' }), cls('d|b|mat', 3, 4, { id: 'mb' }), cls('x|a|len', 2, 2, { id: 'la' })],
  })

describe('pantalla de horario', () => {
  it('sin asignación explica qué falta', () => {
    render(<App inicial={estadoVacio()} />)
    abrirHorario()
    expect(screen.getByText(/Primero completa la asignación académica/)).toBeTruthy()
  })
  it('genera el horario del colegio de ejemplo sin cruces', async () => {
    render(<App inicial={colegioEjemplo()} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('button', { name: 'Generar horario' }))
    expect(await screen.findByText(/Sin cruces pendientes/, {}, { timeout: 15000 })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Matemáticas/ }).length).toBeGreaterThan(0)
  }, 20000)
  it('muestra las cuatro vistas', { timeout: 20000 }, () => {
    const e = colegioEjemplo()
    render(<App inicial={{ ...e, clases: generarHorario(e, { semilla: 1 }).clases }} />)
    abrirHorario()
    for (const vista of ['General', 'Por docente', 'Por grupo', 'Por aula']) {
      fireEvent.click(screen.getByRole('tab', { name: vista }))
      expect(screen.getAllByText(/Aula 1\d\d/).length).toBeGreaterThan(0)
    }
  })
  it('mover una clase a mano creando un cruce lo guarda, lo avisa y se puede deshacer', () => {
    render(<App inicial={chico()} />)
    abrirHorario()
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Matemáticas, Ana Ruiz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover aquí: Miércoles, franja 4' }))
    expect(screen.getByText(/Ana Ruiz tiene 2 clases el miércoles en la franja 4/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Cruces pendientes · 1/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }))
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
  })
  it('al mover sobre otra clase del grupo las intercambia', () => {
    render(<App inicial={chico()} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('button', { name: /Matemáticas, Ana Ruiz/ }))
    fireEvent.click(screen.getByRole('button', { name: /Intercambiar con Lengua Castellana/ }))
    expect(screen.getByRole('button', { name: /Lengua Castellana, Luis Gil.*Lunes, franja 1/ })).toBeTruthy()
  })
  it('arrastrar una clase que ya estaba seleccionada también la mueve', () => {
    render(<App inicial={chico()} />)
    abrirHorario()
    const clase = screen.getByRole('button', { name: /Matemáticas, Ana Ruiz/ })
    fireEvent.click(clase)
    fireEvent.dragStart(clase)
    fireEvent.drop(screen.getByRole('button', { name: 'Mover aquí: Viernes, franja 6' }))
    expect(screen.getByRole('button', { name: /Matemáticas, Ana Ruiz.*Viernes, franja 6/ })).toBeTruthy()
  })
  it('fija una clase para que el generador no la mueva', () => {
    render(<App inicial={chico()} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('button', { name: /Matemáticas, Ana Ruiz/ }))
    fireEvent.click(screen.getByLabelText(/Fijar esta clase/))
    expect(screen.getByRole('button', { name: /Matemáticas, Ana Ruiz.*fijada/ })).toBeTruthy()
  })
  it('un cruce lleva a la clase afectada', () => {
    const e = chico()
    e.clases[1] = { ...e.clases[1], dia: 1, franja: 1 }
    render(<App inicial={e} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('tab', { name: 'Por aula' }))
    fireEvent.click(screen.getByRole('button', { name: /Ana Ruiz tiene 2 clases/ }))
    expect(screen.getByRole('tab', { name: 'Por docente' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Clase seleccionada' })).toBeTruthy()
  })
  it('si la asignación no cabe explica qué bloquea y aplica la solución que elija el usuario', async () => {
    const e = mini({
      grupos: [grp('a', 7)], docentes: [doc('d', { nombre: 'Ana Ruiz', cargaSemanal: 12 })], asignaciones: [asg('d', 'a', 'mat', 12)],
    })
    e.colegio.reglas.maxDocenteDia.activa = false
    render(<App inicial={e} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('button', { name: 'Generar horario' }))
    expect(await screen.findByText(/No se pudo ubicar todo el horario/, {}, { timeout: 15000 })).toBeTruthy()
    expect(screen.getByText(/con máximo 2 por día solo caben 10/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Aplicar y recalcular: Subir el máximo de horas de la misma materia/ }))
    expect(await screen.findByText(/Sin cruces pendientes/, {}, { timeout: 15000 })).toBeTruthy()
  }, 40000)
})

describe('versiones del horario', () => {
  it('crea una versión desde el horario y la barra dice cuál está en uso', () => {
    render(<App inicial={chico()} />)
    abrirHorario()
    expect(screen.getByText('Horario principal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }))
    fireEvent.change(screen.getByLabelText('Nombre de la versión'), { target: { value: 'Opción B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear versión' }))
    const barra = screen.getByRole('region', { name: 'Versiones del horario' })
    expect(within(barra).getByText('Opción B')).toBeTruthy()
    expect(within(barra).getByRole('link', { name: 'Ver todas las versiones · 2' }).getAttribute('href')).toBe('#versiones')
  })
})

describe('carga pareja en un horario ya hecho', () => {
  it('al activar la regla en Colegio, la carga se empareja sola', () => {
    render(<App inicial={cargaDispareja()} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /^Colegio$/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Carga pareja/ }))
    expect(screen.getByText(/Se emparejó la carga de 1 docente moviendo \d+ clases/)).toBeTruthy()
    abrirHorario()
    expect(screen.queryByText(/no está pareja/)).toBeNull()
  })
  it('mover una clase a mano no se deshace solo aunque la regla esté activa', () => {
    const e = cargaDispareja()
    e.colegio.reglas.cargaPareja = { activa: true }
    render(<App inicial={e} />)
    abrirHorario()
    fireEvent.click(screen.getAllByRole('button', { name: /Matemáticas.*Lunes, franja 1/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Mover aquí: Viernes, franja 6' }))
    expect(screen.getAllByRole('button', { name: /Viernes, franja 6/ }).length).toBe(1)
    expect(screen.getByText(/La carga de Ana no está pareja/)).toBeTruthy()
  })
  it('después de mover clases a mano, «Emparejar la carga» la corrige', () => {
    const e = cargaDispareja()
    e.colegio.reglas.cargaPareja = { activa: true }
    render(<App inicial={e} />)
    abrirHorario()
    expect(screen.getByText(/La carga de Ana no está pareja/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Emparejar la carga' }))
    expect(screen.queryByText(/no está pareja/)).toBeNull()
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
  })
})

describe('cambiar datos con un horario ya hecho', () => {
  it('si un docente deja de venir un día, sus clases de ese día se mueven solas', () => {
    render(<App inicial={chico()} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Grupos, docentes/ }))
    fireEvent.click(screen.getByRole('tab', { name: /^Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ana Ruiz/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'No viene el lunes' }))
    expect(screen.getByText(/Se reacomodó 1 clase para que el horario siga cumpliendo las reglas/)).toBeTruthy()
    abrirHorario()
    expect(screen.queryByText(/no está disponible/)).toBeNull()
  })
})

describe('docentes repetidos', () => {
  const repetidos = () =>
    mini({
      grupos: [grp('a', 7)],
      docentes: [doc('pdf', { nombre: 'Sonia P. (apellido pendiente)', cargaSemanal: 2 }), doc('real', { nombre: 'Sonia Pineda', cargaSemanal: 2 }), doc('k1', { nombre: 'M.ª Yesenia (apellido', cargaSemanal: 1, areaId: 'len' }), doc('k2', { nombre: 'Yessenia', cargaSemanal: 1, areaId: 'len' })],
      asignaciones: [asg('pdf', 'a', 'mat', 2), asg('k1', 'a', 'len', 1)],
      clases: [cls('pdf|a|mat', 1, 1), cls('pdf|a|mat', 2, 1), cls('k1|a|len', 3, 1)],
    })
  it('el horario avisa los docentes que parecen repetidos y los une en el que tiene el nombre del colegio', () => {
    render(<App inicial={repetidos()} />)
    abrirHorario()
    expect(screen.getByText(/Sonia Pineda tiene 0 clases/)).toBeTruthy()
    const aviso = screen.getByRole('region', { name: 'Docentes repetidos' })
    fireEvent.click(within(aviso).getByRole('button', { name: 'Unir los 2' }))
    expect(screen.queryByRole('region', { name: 'Docentes repetidos' })).toBeNull()
    expect(screen.queryByText(/tiene 0 clases/)).toBeNull()
    expect(screen.queryByText(/Sonia P\./)).toBeNull()
  })
  it('se puede unir un docente con otro a mano desde su ficha', () => {
    render(<App inicial={repetidos()} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Grupos, docentes/ }))
    fireEvent.click(screen.getByRole('tab', { name: /^Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sonia P\./ }))
    fireEvent.change(screen.getByLabelText(/^Unir con otro docente/), { target: { value: 'real' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, unir' }))
    expect(screen.queryByRole('button', { name: /Sonia P\./ })).toBeNull()
    expect(screen.getByRole('button', { name: /Sonia Pineda.*2\/2/ })).toBeTruthy()
  })
})

describe('mañana y tarde', () => {
  const dos = () =>
    mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'len', nombre: 'Lengua Castellana', afines: [] }],
      grupos: [grp('a', 7), grp('b', 8, { jornada: 'tarde' })],
      docentes: [doc('d', { nombre: 'Ana Ruiz', jornada: 'ambas', cargaSemanal: 2 }), doc('x', { nombre: 'Luis Gil', jornada: 'tarde', areaId: 'len', cargaSemanal: 1 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1), asg('x', 'b', 'len', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1), cls('x|b|len', 1, 2)],
    })
  it('el docente de horario intermedio se ve en dos tablas, sin cruce, y se puede ver solo una jornada', () => {
    render(<App inicial={dos()} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('tab', { name: 'Por docente' }))
    expect(screen.getByRole('heading', { name: 'Jornada de la mañana' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Jornada de la tarde' })).toBeTruthy()
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'tarde' } })
    expect(screen.queryByRole('heading', { name: 'Jornada de la mañana' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Por grupo' }))
    expect([...(screen.getByLabelText('Elegir grupo') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['8-1'])
  })
  it('su disponibilidad tiene una cuadrícula para la mañana y otra para la tarde', () => {
    render(<App inicial={dos()} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Grupos, docentes/ }))
    fireEvent.click(screen.getByRole('tab', { name: /^Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ana Ruiz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Disponible: Lunes, franja 1 de la tarde' }))
    expect(screen.getByRole('button', { name: 'No disponible: Lunes, franja 1 de la tarde' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disponible: Lunes, franja 1 de la mañana' })).toBeTruthy()
    expect(screen.getByText('Disponible en 59 de 60 franjas.')).toBeTruthy()
  })
})

describe('materias en la mañana y en la tarde', () => {
  it('en la asignación de una docente de horario intermedio se elige la jornada de cada materia', () => {
    const e = mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'tec', nombre: 'Tecnología', afines: [] }],
      grupos: [grp('a', 7)],
      docentes: [doc('d', { nombre: 'Ana Ruiz', jornada: 'ambas', cargaSemanal: 2 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'a', 'tec', 1)],
      clases: [cls('d|a|mat', 1, 1), cls('d|a|tec', 1, 2)],
    })
    render(<App inicial={e} />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Asignación/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ana Ruiz/ }))
    fireEvent.change(screen.getByLabelText('Jornada de Tecnología en 7-1'), { target: { value: 'tarde' } })
    expect(screen.getByText('En la tarde: 1 h')).toBeTruthy()
    expect(screen.getByText('En la mañana: 1 h')).toBeTruthy()
    // En el horario, el grupo tiene ahora una tabla de la mañana y otra de la tarde.
    abrirHorario()
    fireEvent.click(screen.getByRole('tab', { name: 'Por grupo' }))
    expect(screen.getByRole('heading', { name: 'Jornada de la tarde' })).toBeTruthy()
  })
})

describe('organizar la media técnica y arreglar cruces', () => {
  const desordenado = () => {
    const e = mini({
      areas: [{ id: 'mat', nombre: 'Matemáticas', afines: [] }, { id: 'mt', nombre: 'Media técnica', afines: [] }],
      grupos: [grp('a', 10), grp('b', 11)],
      docentes: [doc('d', { nombre: 'Ana Ruiz', cargaSemanal: 2 }), doc('t', { nombre: 'Tomás', jornada: 'tarde', areaId: 'mt', cargaSemanal: 4 })],
      asignaciones: [asg('d', 'a', 'mat', 1), asg('d', 'b', 'mat', 1), asg('t', 'a', 'mt', 2), asg('t', 'b', 'mt', 2)],
      // Tomás con los dos grupos el lunes, y Ana con dos clases a la misma hora.
      clases: [cls('d|a|mat', 1, 1), cls('d|b|mat', 1, 1), cls('t|a|mt', 1, 1), cls('t|a|mt', 1, 2), cls('t|b|mt', 1, 3), cls('t|b|mt', 1, 4)],
    })
    e.colegio.reglas.horaLibre.activa = false
    return e
  }
  it('«Organizar la media técnica» deja un grupo por día sin tocar lo demás', () => {
    render(<App inicial={desordenado()} />)
    abrirHorario()
    expect(screen.getByText(/Tomás tiene media técnica con 10-1 y 11-1 el lunes/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Organizar la media técnica' }))
    expect(screen.queryByText(/Tomás tiene media técnica con/)).toBeNull()
    expect(screen.getByText(/Ana Ruiz tiene 2 clases el lunes/)).toBeTruthy() // lo demás no se tocó
  })
  it('«Arreglar cruces» mueve solo lo que choca', () => {
    render(<App inicial={desordenado()} />)
    abrirHorario()
    fireEvent.click(screen.getByRole('button', { name: 'Arreglar cruces' }))
    expect(screen.queryByText(/Ana Ruiz tiene 2 clases/)).toBeNull()
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
  })
})
