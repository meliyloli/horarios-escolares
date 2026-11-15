import { describe, expect, it } from 'vitest'
import { validarAsignacion } from './asignacion'
import { estadoVacio } from './ejemplo'
import { adivinarColumnas, adivinarTipo, aplicarImportacion, areaSugerida, asignaturasSinArea, gradoDe, gruposDe, leerAsignacion, leerIntensidad, normal } from './importar'

const INTENSIDAD = [
  ['Área', '6°', '7°', 'Octavo', 'Grado 9', '10', '11'],
  ['Matemáticas', '5', '5', '5', '5', '4', '4'],
  ['Humanidades: Lengua Castellana', '5', '5', '4', '4', '4', '4'],
  ['Emprendimiento', '1', '1', '1', '1', '2', '2'],
  ['TOTAL', '11', '11', '10', '10', '10', '10'],
]
const ASIGNACION = [
  ['DOCENTE', 'ASIGNATURA', 'GRUPOS', 'I.H.', 'TOTAL'],
  ['Ana María Ruiz', 'Matemáticas', '6-1, 6-2', '5', '10'],
  ['', 'Emprendimiento', '601 602 701', '1', '3'],
  ['Luis Gil', 'Lengua Castellana', '7°1 y 7°2', '5', '10'],
  ['', '', '', '', ''],
  ['Fila rara', '', 'sin datos', '', ''],
]

describe('leer grados y grupos como los escribe un colegio', () => {
  it('entiende los grados en número, con símbolo o en palabra', () => {
    expect(['6', '6°', '6º', 'Sexto', 'Grado 9', 'grado once', '11°', 'UNDÉCIMO'].map(gradoDe)).toEqual([6, 6, 6, 6, 9, 11, 11, 11])
    expect(['Área', '12', 'Total', ''].map(gradoDe)).toEqual([undefined, undefined, undefined, undefined])
  })
  it('entiende los grupos: 6-1, 601, 7°2, 6A y un grado solo', () => {
    expect(gruposDe('6-1, 6-2')).toEqual([{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }])
    expect(gruposDe('601 602 1101')).toEqual([{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }, { grado: 11, numero: 1 }])
    expect(gruposDe('7°1 y 7°2')).toEqual([{ grado: 7, numero: 1 }, { grado: 7, numero: 2 }])
    expect(gruposDe('6A, 6B')).toEqual([{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }])
    expect(gruposDe('10° y 11°')).toEqual([{ grado: 10 }, { grado: 11 }])
    expect(gruposDe('sin datos')).toEqual([])
  })
})

describe('reconocer las tablas del documento', () => {
  it('distingue la tabla de intensidad de la de asignación', () => {
    expect(adivinarTipo(INTENSIDAD)).toBe('intensidad')
    expect(adivinarTipo(ASIGNACION)).toBe('asignacion')
    expect(adivinarTipo([['Fecha', 'Actividad'], ['Lunes', 'Izada de bandera']])).toBe('ninguna')
  })
  it('lee la intensidad por área y grado y salta la fila de totales', () => {
    const { filas } = leerIntensidad(INTENSIDAD)
    expect(filas.map((f) => f.area)).toEqual(['Matemáticas', 'Humanidades: Lengua Castellana', 'Emprendimiento'])
    expect(filas[0].horas).toEqual({ 6: 5, 7: 5, 8: 5, 9: 5, 10: 4, 11: 4 })
  })
  it('adivina las columnas de la asignación por sus encabezados', () => {
    expect(adivinarColumnas(ASIGNACION)).toEqual({ encabezado: 0, docente: 0, area: 1, grupos: 2, horas: 3 })
  })
  it('lee la asignación: el docente se hereda de la fila anterior y lo que no entiende lo reporta', () => {
    const { filas, sinEntender } = leerAsignacion(ASIGNACION, adivinarColumnas(ASIGNACION))
    expect(filas).toEqual([
      { docente: 'Ana María Ruiz', area: 'Matemáticas', grupos: [{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }], horas: 5 },
      { docente: 'Ana María Ruiz', area: 'Emprendimiento', grupos: [{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }, { grado: 7, numero: 1 }], horas: 1 },
      { docente: 'Luis Gil', area: 'Lengua Castellana', grupos: [{ grado: 7, numero: 1 }, { grado: 7, numero: 2 }], horas: 5 },
    ])
    expect(sinEntender).toEqual(['Fila rara · sin datos'])
  })
})

describe('aplicar lo leído al colegio', () => {
  it('llena la intensidad, crea lo que falta y reconoce áreas que ya existen aunque el nombre varíe', () => {
    const { estado, resumen } = aplicarImportacion(estadoVacio(), { intensidad: leerIntensidad(INTENSIDAD).filas })
    const id = (nombre: string) => estado.areas.find((a) => a.nombre === nombre)!.id
    expect(resumen.areasNuevas).toEqual(['Emprendimiento'])
    expect(estado.intensidad[6][id('Matemáticas')]).toBe(5)
    expect(estado.intensidad[8][id('Lengua Castellana')]).toBe(4)
    expect(estado.intensidad[10][id('Emprendimiento')]).toBe(2)
    expect(estado.intensidad[1][id('Matemáticas')]).toBe(5) // primaria no venía en la tabla: se conserva
  })
  it('crea docentes y grupos y deja la asignación lista, con horas por grupo', () => {
    const leido = leerAsignacion(ASIGNACION, adivinarColumnas(ASIGNACION)).filas
    const { estado, resumen } = aplicarImportacion(estadoVacio(), { intensidad: leerIntensidad(INTENSIDAD).filas, asignacion: leido })
    expect(resumen).toMatchObject({ docentesNuevos: ['Ana María Ruiz', 'Luis Gil'], gruposNuevos: ['6-1', '6-2', '7-1', '7-2'], filasAsignacion: 7 })
    const ana = estado.docentes.find((d) => d.nombre === 'Ana María Ruiz')!
    expect(ana).toMatchObject({ nivel: 'bachillerato', cargaSemanal: 22, areaId: 'mat' })
    expect(estado.asignaciones.filter((a) => a.docenteId === ana.id).map((a) => a.horas)).toEqual([5, 5, 1, 1, 1])
    expect(validarAsignacion(estado).some((a) => a.tipo === 'intensidad' && a.mensaje.includes('6-1 recibe 5 de 5'))).toBe(false)
  })
  it('importar dos veces no duplica nada', () => {
    const leido = leerAsignacion(ASIGNACION, adivinarColumnas(ASIGNACION)).filas
    const una = aplicarImportacion(estadoVacio(), { asignacion: leido }).estado
    const dos = aplicarImportacion(una, { asignacion: leido })
    expect(dos.estado.asignaciones).toHaveLength(una.asignaciones.length)
    expect(dos.resumen).toMatchObject({ docentesNuevos: [], gruposNuevos: [], areasNuevas: [] })
  })
  it('un grado sin número de grupo se aplica a todos los grupos de ese grado', () => {
    const base = aplicarImportacion(estadoVacio(), { asignacion: leerAsignacion(ASIGNACION, adivinarColumnas(ASIGNACION)).filas }).estado
    const { estado } = aplicarImportacion(base, { asignacion: [{ docente: 'Luis Gil', area: 'Inglés', grupos: [{ grado: 6 }], horas: 4 }] })
    const luis = estado.docentes.find((d) => d.nombre === 'Luis Gil')!
    expect(estado.asignaciones.filter((a) => a.docenteId === luis.id && a.areaId === 'ing')).toHaveLength(2)
  })
  it('con horas totales por fila las reparte entre los grupos', () => {
    const tabla = [['Docente', 'Área', 'Grupos', 'Horas'], ['Eva Paz', 'Inglés', '8-1, 8-2', '8']]
    const { filas } = leerAsignacion(tabla, adivinarColumnas(tabla), false)
    expect(filas[0].horas).toBe(4)
  })
})

describe('asignaciones escritas de otras formas', () => {
  const leer = (t: string[][]) => leerAsignacion(t, adivinarColumnas(t))

  it('entiende otros nombres de columna: nombre del docente, materia, cursos, IHS', () => {
    const t = [['NOMBRE DEL DOCENTE', 'MATERIA', 'CURSOS', 'IHS'], ['Ana Ruiz', 'Matemáticas', '6-1', '5']]
    expect(adivinarTipo(t)).toBe('asignacion')
    expect(adivinarColumnas(t)).toEqual({ encabezado: 0, docente: 0, area: 1, grupos: 2, horas: 3 })
    expect(leer(t).filas).toHaveLength(1)
  })
  it('una fila sin horas se importa: las horas salen de la intensidad del área en ese grado', () => {
    const t = [['Docente', 'Asignatura', 'Grupos'], ['Ana Ruiz', 'Matemáticas', '6-1, 6-2'], ['', 'Emprendimiento', '7-1']]
    const { filas, sinEntender } = leer(t)
    expect(sinEntender).toEqual([])
    expect(filas.map((f) => f.horas)).toEqual([undefined, undefined])
    const { estado, resumen } = aplicarImportacion(estadoVacio(), { intensidad: leerIntensidad(INTENSIDAD).filas, asignacion: filas })
    expect(estado.asignaciones.map((a) => a.horas)).toEqual([5, 5, 1])
    expect(resumen.sinHoras).toEqual([])
    const sinIntensidad = aplicarImportacion(estadoVacio(), { asignacion: [{ docente: 'Eva', area: 'Robótica', grupos: [{ grado: 6, numero: 1 }] }] })
    expect(sinIntensidad.resumen.sinHoras).toEqual(['Robótica en 6-1 (Eva)'])
    expect(sinIntensidad.estado.asignaciones).toEqual([])
  })
  it('el docente puede venir como título encima de la tabla o como fila suelta', () => {
    const titulo = [['Docente: Ana María Ruiz'], ['Asignatura', 'Grupos', 'Horas'], ['Matemáticas', '6-1', '5']]
    expect(adivinarTipo(titulo)).toBe('asignacion')
    expect(leer(titulo).filas).toEqual([{ docente: 'Ana María Ruiz', area: 'Matemáticas', grupos: [{ grado: 6, numero: 1 }], horas: 5 }])
    const sueltas = [['Asignatura', 'Grupos', 'Horas'], ['Lic. Luis Gil', '', ''], ['Inglés', '7-1', '4'], ['Eva Paz Rojas', '', ''], ['Inglés', '8-1', '4']]
    expect(leer(sueltas).filas.map((f) => f.docente)).toEqual(['Luis Gil', 'Eva Paz Rojas'])
  })
  it('un nombre o unos grupos que siguen en el renglón de abajo (PDF) se juntan con la fila de arriba', () => {
    const t = [['Docente', 'Asignatura', 'Grupos', 'I.H.'], ['Ana María Ruiz', 'Matemáticas', '6-1, 6-2,', '5'], ['Gómez', '', '7-1', ''], ['', 'Física', '10-1', '2']]
    const { filas, sinEntender } = leer(t)
    expect(sinEntender).toEqual([])
    expect(filas).toEqual([
      { docente: 'Ana María Ruiz Gómez', area: 'Matemáticas', grupos: [{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }, { grado: 7, numero: 1 }], horas: 5 },
      { docente: 'Ana María Ruiz Gómez', area: 'Física', grupos: [{ grado: 10, numero: 1 }], horas: 2 },
    ])
  })
  it('un título de columna partido en dos renglones (PDF) no se toma como docente', () => {
    const t = [['Nombre del', 'Asignatura', 'Cursos'], ['docente', '', ''], ['Ana Ruiz', 'Inglés', '6-1']]
    const { filas, sinEntender } = leer(t)
    expect(sinEntender).toEqual([])
    expect(filas.map((f) => f.docente)).toEqual(['Ana Ruiz'])
  })
  it('una tabla que sigue en otra página conserva el docente de la anterior', () => {
    const t = [['Docente', 'Asignatura', 'Grupos', 'I.H.'], ['', 'Química', '11-1', '3']]
    const r = leerAsignacion(t, adivinarColumnas(t), true, '', 'Ana Ruiz')
    expect(r.filas[0].docente).toBe('Ana Ruiz')
    expect(r.ultimoDocente).toBe('Ana Ruiz')
  })
  it('entiende grados escritos en palabras y con espacio antes de la letra', () => {
    expect(gruposDe('Sexto A, Séptimo 1')).toEqual([{ grado: 6, numero: 1 }, { grado: 7, numero: 1 }])
    expect(gruposDe('6° A y 6° B')).toEqual([{ grado: 6, numero: 1 }, { grado: 6, numero: 2 }])
    expect(gruposDe('Sextos')).toEqual([{ grado: 6 }])
  })
  it('una tabla de intensidad con encabezados "Grado 6, Grado 7" no se confunde con una asignación', () => {
    expect(adivinarTipo([['Área', 'Grado 6', 'Grado 7'], ['Matemáticas', '5', '5']])).toBe('intensidad')
  })
})

describe('asignaturas que pertenecen a un área', () => {
  it('reconoce asignaturas comunes dentro de su área', () => {
    const e = estadoVacio()
    const nombre = (texto: string) => areaSugerida(e, texto)?.nombre
    expect(['Español', 'Castellano', 'Lenguaje', 'Lectura crítica'].map(nombre)).toEqual(Array(4).fill('Lengua Castellana'))
    expect(['Física', 'Química', 'Biología'].map(nombre)).toEqual(Array(3).fill('Ciencias Naturales'))
    expect(['Geometría', 'Estadística', 'Trigonometría', 'Cálculo'].map(nombre)).toEqual(Array(4).fill('Matemáticas'))
    expect(['Religión', 'Ética', 'Artes', 'Música', 'Informática', 'Historia', 'Educación física'].map(nombre)).toEqual([
      'Educación Religiosa', 'Ética y Valores', 'Educación Artística', 'Educación Artística', 'Tecnología e Informática', 'Ciencias Sociales', 'Educación Física',
    ])
    expect(nombre('Emprendimiento')).toBeUndefined()
  })
  it('al importar, Física y Química quedan en Ciencias Naturales y toman su intensidad', () => {
    const intensidad = [{ area: 'Ciencias Naturales', horas: { 10: 6 } }]
    const asignacion = [
      { docente: 'Ana Ruiz', area: 'Física', grupos: [{ grado: 10, numero: 1 }], horas: 3 },
      { docente: 'Luis Gil', area: 'Química', grupos: [{ grado: 10, numero: 1 }], horas: 3 },
    ]
    const { estado, resumen } = aplicarImportacion(estadoVacio(), { intensidad, asignacion })
    expect(resumen.areasNuevas).toEqual([])
    expect(estado.asignaciones.map((a) => a.areaId)).toEqual(['nat', 'nat'])
    expect(validarAsignacion(estado).filter((a) => a.areaId === 'nat' && a.grupoId)).toMatchObject([{ tipo: 'compartida', gravedad: 'excepcion' }])
  })
  it('dos asignaturas del mismo docente y la misma área en un grupo se suman; reimportar no las duplica', () => {
    const asignacion = [
      { docente: 'Rubén Salazar', area: 'Física', grupos: [{ grado: 10, numero: 1 }], horas: 3 },
      { docente: 'Rubén Salazar', area: 'Química', grupos: [{ grado: 10, numero: 1 }], horas: 3 },
    ]
    const una = aplicarImportacion(estadoVacio(), { asignacion }).estado
    expect(una.asignaciones.map((a) => [a.areaId, a.horas])).toEqual([['nat', 6]])
    expect(aplicarImportacion(una, { asignacion }).estado.asignaciones.map((a) => [a.areaId, a.horas])).toEqual([['nat', 6]])
  })
  it('se puede decir a mano a qué área corresponde una asignatura, o crearla como área nueva', () => {
    const asignacion = [
      { docente: 'Ana Ruiz', area: 'Cátedra de paz', grupos: [{ grado: 6, numero: 1 }], horas: 1 },
      { docente: 'Ana Ruiz', area: 'Emprendimiento', grupos: [{ grado: 6, numero: 1 }], horas: 1 },
    ]
    const { estado, resumen } = aplicarImportacion(estadoVacio(), { asignacion, equivalencias: { [normal('Cátedra de paz')]: 'soc', [normal('Emprendimiento')]: 'nueva' } })
    expect(estado.asignaciones.map((a) => estado.areas.find((x) => x.id === a.areaId)!.nombre)).toEqual(['Ciencias Sociales', 'Emprendimiento'])
    expect(resumen.areasNuevas).toEqual(['Emprendimiento'])
  })
  it('lista las asignaturas leídas que no coinciden exactamente con un área, con su sugerencia', () => {
    const leido = {
      intensidad: [{ area: 'Matemáticas', horas: { 6: 5 } }],
      asignacion: [{ docente: 'Ana', area: 'Física', grupos: [{ grado: 10 }], horas: 2 }, { docente: 'Ana', area: 'Emprendimiento', grupos: [{ grado: 10 }], horas: 1 }],
    }
    expect(asignaturasSinArea(estadoVacio(), leido)).toEqual([
      { nombre: 'Física', sugerida: 'nat' },
      { nombre: 'Emprendimiento', sugerida: undefined },
    ])
  })
})
