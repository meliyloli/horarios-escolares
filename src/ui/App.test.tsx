// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { colegioEjemplo, estadoVacio } from '../dominio/ejemplo'
import { generarHorario } from '../dominio/generador'
import { App } from './App'

afterEach(() => {
  cleanup()
  location.hash = ''
})

// «Colegio» no debe confundirse con «Colegios y versiones».
const abrir = (nombre: string) =>
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: (n) => n.includes(nombre) && !(nombre === 'Colegio' && n.includes('Colegios')) }))
const titulo = () => screen.getByRole('heading', { level: 2 }).textContent

describe('la app', () => {
  it('abre cada pantalla de datos con el colegio de ejemplo', () => {
    render(<App inicial={colegioEjemplo()} />)
    for (const [boton, encabezado] of [
      ['Colegio', 'Colegio'], ['Áreas', 'Áreas e intensidad horaria'], ['Grupos', 'Grupos, docentes y aulas'],
    ]) {
      abrir(boton)
      expect(titulo()).toBe(encabezado)
    }
  })
  it('abre cada pantalla sin datos', () => {
    render(<App inicial={estadoVacio()} />)
    for (const boton of ['Colegio', 'Áreas', 'Grupos']) {
      abrir(boton)
      expect(titulo()).toBeTruthy()
    }
  })
  it('avisa que es un colegio de ejemplo y permite empezar con el propio tras confirmar', () => {
    render(<App inicial={colegioEjemplo()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Empezar con mi colegio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar el ejemplo' }))
    abrir('Grupos')
    expect(screen.getByText(/Todavía no hay grupos/)).toBeTruthy()
  })
  it('tiene un botón para guardar el colegio que confirma que quedó guardado', () => {
    render(<App inicial={colegioEjemplo()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar colegio' }))
    expect(screen.getByRole('status').textContent).toMatch(/Colegio guardado/)
  })
  it('permite darle horas extra a un docente', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Grupos')
    fireEvent.click(screen.getByRole('tab', { name: /Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Luz Marina Restrepo/ }))
    fireEvent.change(screen.getByLabelText(/Horas extra por semana/), { target: { value: '2' } })
    expect(screen.getByRole('button', { name: /Luz Marina Restrepo.*22\/24/ })).toBeTruthy()
  })
  it('ofrece el modelo de aula libre y la regla de bloques', () => {
    render(<App inicial={colegioEjemplo()} />)
    fireEvent.click(screen.getByLabelText(/Aula fija para algunos/))
    expect((screen.getByLabelText(/Aula fija para algunos/) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText(/Clases en bloque/))
    expect((screen.getByLabelText(/Clases en bloque/) as HTMLInputElement).checked).toBe(true)
  })
  it('siempre se puede borrar todo y empezar de cero, aunque el colegio ya tenga otro nombre', () => {
    render(<App inicial={{ ...colegioEjemplo(), colegio: { ...colegioEjemplo().colegio, nombre: 'Mi colegio real' } }} />)
    expect(screen.queryByRole('button', { name: 'Empezar con mi colegio' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo y empezar de cero' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar todo' }))
    abrir('Grupos')
    expect(screen.getByText(/Todavía no hay grupos/)).toBeTruthy()
  })
  it('se puede deshacer desde cualquier pantalla', () => {
    render(<App inicial={colegioEjemplo()} />)
    fireEvent.change(screen.getByLabelText('Nombre del colegio'), { target: { value: 'Otro nombre' } })
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }))
    expect((screen.getByLabelText('Nombre del colegio') as HTMLInputElement).value).toBe(colegioEjemplo().colegio.nombre)
  })
  it('si otra pestaña guarda cambios, esta los carga en vez de pisarlos', () => {
    render(<App inicial={colegioEjemplo()} />)
    fireEvent(window, new StorageEvent('storage', { key: 'horarios-escolares', newValue: JSON.stringify({ ...estadoVacio(), colegio: { ...estadoVacio().colegio, nombre: 'Desde otra pestaña' } }) }))
    expect((screen.getByLabelText('Nombre del colegio') as HTMLInputElement).value).toBe('Desde otra pestaña')
  })
  it('el apartado de disponibilidad permite marcar los días que el docente no viene', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Grupos')
    fireEvent.click(screen.getByRole('tab', { name: /Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Luz Marina Restrepo/ }))
    expect(screen.getByRole('heading', { name: 'Disponibilidad' })).toBeTruthy()
    expect(screen.getByText('Disponible en 30 de 30 franjas.')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('No viene el viernes'))
    expect(screen.getByText('Disponible en 24 de 30 franjas.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Luz Marina Restrepo.*Horario limitado/ })).toBeTruthy()
  })
  it('une un área con otra desde Áreas e intensidad', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Áreas')
    fireEvent.change(screen.getByLabelText('Unir Tecnología e Informática con otra área'), { target: { value: 'mat' } })
    expect(screen.getByText(/Las horas, la intensidad, los docentes y las clases de Tecnología e Informática pasan a Matemáticas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, unir' }))
    expect(screen.queryByDisplayValue('Tecnología e Informática')).toBeNull()
  })
  it('permite no asignar aulas', () => {
    const e = colegioEjemplo()
    render(<App inicial={{ ...e, clases: generarHorario(e, { semilla: 1 }).clases }} />)
    fireEvent.click(screen.getByLabelText(/Sin aulas/))
    abrir('Horario')
    expect(screen.queryByRole('tab', { name: 'Por aula' })).toBeNull()
    expect(screen.queryByText(/Aula 1\d\d/)).toBeNull()
    expect(screen.getByText(/Sin cruces pendientes/)).toBeTruthy()
  })
  it('agrega y borra un grupo pidiendo confirmación', () => {
    render(<App inicial={estadoVacio()} />)
    abrir('Grupos')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar grupo' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Borrar el grupo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    expect(screen.getByText(/Todavía no hay grupos/)).toBeTruthy()
  })
  it('edita la disponibilidad de un docente con el atajo "entra desde la franja"', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Grupos')
    fireEvent.click(screen.getByRole('tab', { name: /Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Luz Marina Restrepo/ }))
    fireEvent.change(screen.getByLabelText('Entra desde la franja'), { target: { value: '3' } })
    expect(screen.getAllByRole('button', { pressed: true, name: /No disponible/ })).toHaveLength(10)
  })
})

describe('asignación académica', () => {
  it('el nombre de un docente se cambia desde su ficha de asignación', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar nombre' }))
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Carlos Mario Giraldo Ruiz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(screen.getByRole('heading', { name: 'Carlos Mario Giraldo Ruiz' })).toBeTruthy()
    abrir('Grupos, docentes')
    fireEvent.click(screen.getByRole('tab', { name: /^Docentes/ }))
    expect(screen.getByRole('button', { name: /Carlos Mario Giraldo Ruiz/ })).toBeTruthy()
  })
  it('muestra la carga de cada docente y que el ejemplo está completo', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Asignación')
    expect(titulo()).toBe('Asignación académica')
    expect(screen.getByText(/La asignación está completa/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    expect(screen.getByText('Carga: 22 de 22')).toBeTruthy()
  })
  it('avisa lo que falta y lo completa con una sugerencia', () => {
    const e = colegioEjemplo()
    e.asignaciones = e.asignaciones.filter((a) => a.id !== 'd6-6-1-mat')
    render(<App inicial={e} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    expect(screen.getByText('Carga: 17 de 22')).toBeTruthy()
    expect(screen.getByText(/Carlos Mario Giraldo tiene 17 de 22 horas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Agregar 5 horas de Matemáticas en 6-1/ }))
    expect(screen.getByText('Carga: 22 de 22')).toBeTruthy()
  })
  it('las horas se confirman al salir del campo, y al borrar una fila con clases pide confirmación', () => {
    const e = colegioEjemplo()
    e.clases = [{ id: 'c1', asignacionId: 'd6-6-1-mat', dia: 1, franja: 1, fijada: false }]
    render(<App inicial={e} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    const horas = screen.getByLabelText('Horas de Matemáticas en 6-1')
    fireEvent.change(horas, { target: { value: '' } })
    expect(screen.getByText('Carga: 22 de 22')).toBeTruthy() // todavía no cambia nada
    fireEvent.change(horas, { target: { value: '4' } })
    fireEvent.blur(horas)
    expect(screen.getByText('Carga: 21 de 22')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Matemáticas en 6-1' }))
    expect(screen.getByText(/también se quita/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }))
    expect(screen.getByText('Carga: 17 de 22')).toBeTruthy()
  })
  it('agrega una materia nueva al docente en una fila aparte, sin sumarla a la última', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    const filas = () => screen.getAllByRole('button', { name: /^Quitar / }).length
    const antes = filas()
    fireEvent.change(screen.getByLabelText('Área nueva'), { target: { value: 'eti' } })
    fireEvent.change(screen.getByLabelText('Grupo nuevo'), { target: { value: 'g7-1' } })
    fireEvent.change(screen.getByLabelText('Horas nuevas'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(filas()).toBe(antes + 1)
    expect(screen.getByRole('button', { name: 'Quitar Ética y Valores en 7-1' })).toBeTruthy()
    expect(screen.getByText('Carga: 23 de 22')).toBeTruthy()
  })
  it('las horas se actualizan solas poco después de escribir, sin tener que salir del campo', async () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    fireEvent.change(screen.getByLabelText('Horas de Matemáticas en 6-1'), { target: { value: '4' } })
    expect(await screen.findByText('Carga: 21 de 22', {}, { timeout: 2000 })).toBeTruthy()
  })
  it('al agregar horas con un horario ya hecho, se ubican solas en el horario sin rehacerlo', async () => {
    const e = colegioEjemplo()
    render(<App inicial={{ ...e, clases: generarHorario(e, { semilla: 1 }).clases }} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('button', { name: /Carlos Mario Giraldo/ }))
    // Se le quita una hora de Matemáticas en 6-1 y esa hora se le da en Ética: cabe sin mover nada.
    const horas = screen.getByLabelText('Horas de Matemáticas en 6-1')
    fireEvent.change(horas, { target: { value: '4' } })
    fireEvent.blur(horas)
    fireEvent.change(screen.getByLabelText('Área nueva'), { target: { value: 'eti' } })
    fireEvent.change(screen.getByLabelText('Grupo nuevo'), { target: { value: 'g6-1' } })
    fireEvent.change(screen.getByLabelText('Horas nuevas'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(screen.getByRole('status').textContent).toMatch(/Se ubicó 1 hora nueva en el horario/)
    abrir('Horario')
    expect(screen.queryByText(/por ubicar en el horario/)).toBeNull()
  })
  it('lee la intensidad desde la asignación para las materias que no la tienen', () => {
    const e = colegioEjemplo()
    e.intensidad = { ...e.intensidad, 10: { ...e.intensidad[10], fil: 0 } }
    render(<App inicial={e} />)
    abrir('Asignación')
    expect(screen.getByText(/1 materia tiene horas asignadas pero su intensidad horaria está en 0/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leer intensidad desde la asignación' }))
    const fila = screen.getByRole('row', { name: /Filosofía/ })
    expect(within(fila).getByText('10.°')).toBeTruthy()
    expect(within(fila).getByText('0 → 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a la intensidad' }))
    expect(screen.queryByText(/intensidad horaria está en 0/)).toBeNull()
    expect(screen.getByText(/La asignación está completa/)).toBeTruthy()
  })
  it('la vista por grupo muestra las horas que faltan', () => {
    const e = colegioEjemplo()
    e.asignaciones = e.asignaciones.filter((a) => a.id !== 'd6-6-1-mat')
    render(<App inicial={e} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('tab', { name: 'Por grupo' }))
    fireEvent.click(screen.getByRole('button', { name: /^6-1/ }))
    const fila = screen.getByRole('row', { name: /Matemáticas/ })
    expect(within(fila).getByText('Faltan 5')).toBeTruthy()
    // Se asigna desde el grupo y la vista se actualiza con el docente.
    fireEvent.change(within(fila).getByLabelText('Docente para Matemáticas en 6-1'), { target: { value: 'd6' } })
    fireEvent.click(within(fila).getByRole('button', { name: 'Asignar 5 h' }))
    const despues = screen.getByRole('row', { name: /Matemáticas/ })
    expect(within(despues).getByText('Carlos Mario Giraldo · 5 h')).toBeTruthy()
    expect(within(despues).getByText('Completa')).toBeTruthy()
  })
  it('la vista por grupo muestra los docentes de cada materia y avisa si dos la comparten', () => {
    const e = colegioEjemplo()
    const i = e.asignaciones.findIndex((a) => a.id === 'd6-6-1-mat')
    e.asignaciones[i] = { ...e.asignaciones[i], horas: 3 }
    e.asignaciones.push({ id: 'nueva', docenteId: 'd7', grupoId: 'g6-1', areaId: 'mat', horas: 2 })
    render(<App inicial={e} />)
    abrir('Asignación')
    fireEvent.click(screen.getByRole('tab', { name: 'Por grupo' }))
    fireEvent.click(screen.getByRole('button', { name: /^6-1/ }))
    const fila = screen.getByRole('row', { name: /Matemáticas/ })
    expect(within(fila).getByText('Carlos Mario Giraldo · 3 h')).toBeTruthy()
    expect(within(fila).getByText('Gloria Inés Arango · 2 h')).toBeTruthy()
    expect(within(fila).getByText('Compartida')).toBeTruthy()
    expect(screen.getByText(/Matemáticas en 6-1 la dictan 2 docentes/)).toBeTruthy()
  })
  it('abre sin datos', () => {
    render(<App inicial={estadoVacio()} />)
    abrir('Asignación')
    expect(screen.getByText(/Primero agrega docentes y grupos/)).toBeTruthy()
  })
})

describe('reglas del colegio', () => {
  it('se puede excluir una materia de los bloques', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Colegio')
    const educacionFisica = screen.getByRole('checkbox', { name: 'Educación Física' }) as HTMLInputElement
    expect(educacionFisica.matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Clases en bloque/ }))
    fireEvent.click(educacionFisica)
    expect(educacionFisica.checked).toBe(true)
  })
})

describe('materias de 2 horas en bloque', () => {
  it('la regla se activa en Colegio y deja elegir las materias excluidas aunque la de bloques esté apagada', () => {
    render(<App inicial={colegioEjemplo()} />)
    abrir('Colegio')
    fireEvent.click(screen.getByRole('checkbox', { name: /Materias de 2 horas siempre en bloque/ }))
    expect((screen.getByRole('checkbox', { name: 'Educación Física' }) as HTMLInputElement).matches(':disabled')).toBe(false)
  })
})

describe('la app abierta en otra pestaña', () => {
  const llega = (valor: unknown) =>
    act(() => { dispatchEvent(new StorageEvent('storage', { key: 'horarios-escolares', newValue: JSON.stringify(valor) })) })
  afterEach(() => localStorage.clear())
  it('carga lo que guarda otra pestaña', () => {
    render(<App inicial={colegioEjemplo()} />)
    const guardado = JSON.parse(localStorage.getItem('horarios-escolares')!)
    llega({ ...guardado, colegio: { ...guardado.colegio, nombre: 'Cambiado en otra pestaña' }, guardadoEn: guardado.guardadoEn + 1 })
    expect(screen.getAllByText('Cambiado en otra pestaña').length).toBeGreaterThan(0)
  })
  it('no deja que una pestaña con una versión anterior deshaga lo de esta, y lo avisa', () => {
    const e = colegioEjemplo()
    e.docentes[0] = { ...e.docentes[0], jornada: 'ambas' }
    render(<App inicial={e} />)
    const guardado = JSON.parse(localStorage.getItem('horarios-escolares')!)
    // La versión anterior no conoce «ambas»: lo vuelve «manana» y guarda conservando la marca de esta pestaña.
    llega({ ...guardado, docentes: guardado.docentes.map((d: { jornada: string }, i: number) => (i === 0 ? { ...d, jornada: 'manana' } : d)) })
    expect(screen.getByRole('alert').textContent).toMatch(/otra pestaña o ventana con una versión anterior/)
    abrir('Grupos')
    fireEvent.click(screen.getByRole('tab', { name: /^Docentes/ }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(e.docentes[0].nombre) }))
    expect((screen.getByDisplayValue('Mañana y tarde (horario intermedio)') as HTMLSelectElement).value).toBe('ambas')
  })
})

describe('media técnica', () => {
  it('se activa en Colegio, tiene su propio apartado y no aparece entre las áreas del plan de estudios', () => {
    render(<App inicial={colegioEjemplo()} />)
    expect(screen.queryByRole('button', { name: 'Media técnica' })).toBeNull()
    abrir('Colegio')
    fireEvent.click(screen.getByRole('radio', { name: /Sí tiene media técnica/ }))
    abrir('Media técnica')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar programa' }))
    fireEvent.change(screen.getByLabelText('Nombre del programa'), { target: { value: 'Sistemas' } })
    fireEvent.change(screen.getByLabelText('Programa de 10-1'), { target: { value: within(screen.getByLabelText('Programa de 10-1')).getByRole('option', { name: 'Sistemas' }).getAttribute('value') } })
    const quien = screen.getByLabelText('Quién dicta Sistemas a 10-1') as HTMLSelectElement
    fireEvent.change(quien, { target: { value: quien.options[1].value } })
    expect(quien.value).not.toBe('')
    abrir('Áreas')
    expect(screen.queryByDisplayValue('Sistemas')).toBeNull()
    abrir('Grupos')
    expect(screen.getByText('+6 MT')).toBeTruthy()
  })
})

describe('áreas afines comunes', () => {
  it('«Poner afines comunes» llena las afines de las áreas que reconoce (por ejemplo, las importadas sin afines)', () => {
    const e = estadoVacio()
    e.areas = e.areas.map((a) => ({ ...a, afines: [] }))
    render(<App inicial={e} />)
    abrir('Áreas')
    expect(screen.queryByRole('button', { name: 'Quitar Ciencias Sociales de las afines de Ética y Valores' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Poner afines comunes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, poner las comunes' }))
    for (const afin of ['Ciencias Sociales', 'Educación Religiosa', 'Filosofía'])
      expect(screen.getByRole('button', { name: `Quitar ${afin} de las afines de Ética y Valores` })).toBeTruthy()
  })
})
