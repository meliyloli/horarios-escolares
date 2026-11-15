import { horasDocente } from './asignacion'
import { aplicaMaxDocente, aulaDeClase, enBloqueDeDos } from './cruces'
import { generarHorario, type ResultadoGenerar } from './generador'
import { cargaEnCiclo, cicloDeGrupo, diasHorario, FRANJAS, franjasDisponibles, nombreGrupo, nuevoId, dictaEn } from './tiempo'
import type { Estado, Id } from './tipos'

export interface Bloqueo {
  tipo: 'docenteSinFranjas' | 'grupoSinFranjas' | 'aulaSinFranjas' | 'materiaNoCabe' | 'docenteGrupoNoCabe' | 'busqueda'
  mensaje: string
  docenteId?: Id
  grupoId?: Id
  aulaId?: Id
  areaId?: Id
}

export interface Propuesta {
  tipo: 'reasignar' | 'relajarRegla' | 'disponibilidad' | 'aula'
  /** 1 es el cambio más pequeño y 4 el más grande. */
  impacto: 1 | 2 | 3 | 4
  descripcion: string
  /** La app probó la propuesta y con ella sí se logra un horario completo. */
  resuelve: boolean
  aplicar: (e: Estado) => Estado
}

const NOMBRE_CAUSA: Record<string, string> = {
  docente: 'el docente ya tiene clase', grupo: 'el grupo ya tiene clase', aula: 'el aula está ocupada',
  disponibilidad: 'el docente no está disponible', maxMateria: 'el máximo de horas de la misma materia por día',
  maxDocente: 'el máximo de horas con el mismo docente por día', horaLibre: 'la regla de hora libre',
  libreDiaria: 'la regla de una hora libre todos los días', cargaPareja: 'la regla de carga pareja',
  diasSeguidos: 'la regla de materias cortas en días separados',
  bloqueExcluido: 'que la materia no va en bloque',
  mediaTecnicaDia: 'un grupo por día en media técnica',
}

const sumar = (mapa: Map<string, number>, llave: string, n: number) => mapa.set(llave, (mapa.get(llave) ?? 0) + n)

/** Imposibles que se ven sin buscar: algo tiene más horas que franjas donde ponerlas. */
export const prechequear = (e: Estado): Bloqueo[] => {
  const bloqueos: Bloqueo[] = []
  const dias = diasHorario(e)
  const { reglas } = e.colegio
  const area = (id: Id) => e.areas.find((a) => a.id === id)?.nombre ?? 'un área'
  const porDocente = new Map<string, number>()
  const porAula = new Map<string, number>()
  const porGrupoDocente = new Map<string, number>()

  for (const a of e.asignaciones) {
    const g = e.grupos.find((x) => x.id === a.grupoId)
    const d = e.docentes.find((x) => x.id === a.docenteId)
    if (!g || !d) continue
    const ciclo = cicloDeGrupo(e, g)
    const enHorario = (a.horas * dias) / ciclo
    sumar(porDocente, d.id, enHorario)
    const aulaId = aulaDeClase(e, { id: '', asignacionId: a.id, dia: 1, franja: 1, fijada: false })
    if (aulaId) sumar(porAula, `${g.jornada}/${aulaId}`, enHorario)
    sumar(porGrupoDocente, `${g.id}/${d.id}`, a.horas)
  }

  for (const d of e.docentes) {
    const horas = porDocente.get(d.id) ?? 0
    const libres = franjasDisponibles(d, dias).reduce((n, x) => n + x, 0)
    const conLibreDiaria = franjasDisponibles(d, dias).reduce((n, cap) => n + Math.max(0, cap - 1), 0)
    if (horas > libres)
      bloqueos.push({ tipo: 'docenteSinFranjas', docenteId: d.id, mensaje: `${d.nombre} tiene ${horas} horas y solo ${libres} franjas disponibles.` })
    else if (reglas.libreDiaria?.activa && horas > conLibreDiaria)
      bloqueos.push({ tipo: 'docenteSinFranjas', docenteId: d.id, mensaje: `${d.nombre} tiene ${horas} horas y, dejando una hora libre cada día, solo caben ${conLibreDiaria}.` })
  }
  for (const g of e.grupos) {
    const ciclo = cicloDeGrupo(e, g)
    const suyas = e.asignaciones.filter((a) => a.grupoId === g.id)
    const horas = suyas.reduce((s, a) => s + a.horas, 0)
    if (horas > ciclo * FRANJAS)
      bloqueos.push({ tipo: 'grupoSinFranjas', grupoId: g.id, mensaje: `El grupo ${nombreGrupo(g)} tiene ${horas} horas y el ciclo solo tiene ${ciclo * FRANJAS} franjas.` })
    if (reglas.maxMateriaDia.activa)
      for (const areaId of new Set(suyas.map((a) => a.areaId))) {
        const deArea = suyas.filter((a) => a.areaId === areaId).reduce((s, a) => s + a.horas, 0)
        const caben = reglas.maxMateriaDia.valor * ciclo
        if (deArea > caben)
          bloqueos.push({
            tipo: 'materiaNoCabe', grupoId: g.id, areaId,
            mensaje: `${nombreGrupo(g)} tiene ${deArea} horas de ${area(areaId)} y con máximo ${reglas.maxMateriaDia.valor} por día solo caben ${caben}.`,
          })
      }
    for (const d of e.docentes) {
      const horasJuntos = porGrupoDocente.get(`${g.id}/${d.id}`) ?? 0
      const caben = reglas.maxDocenteDia.valor * ciclo
      if (horasJuntos > caben && aplicaMaxDocente(reglas, d, g))
        bloqueos.push({
          tipo: 'docenteGrupoNoCabe', grupoId: g.id, docenteId: d.id,
          mensaje: `${nombreGrupo(g)} tiene ${horasJuntos} horas con ${d.nombre} y con máximo ${reglas.maxDocenteDia.valor} por día solo caben ${caben}.`,
        })
    }
  }
  if (e.colegio.modeloAula === 'libre')
    for (const jornada of ['manana', 'tarde'] as const) {
      const clases = e.asignaciones.reduce((n, a) => {
        const g = e.grupos.find((x) => x.id === a.grupoId)
        return g?.jornada === jornada ? n + (a.horas * dias) / cicloDeGrupo(e, g) : n
      }, 0)
      const caben = e.aulas.length * dias * FRANJAS
      if (clases > caben)
        bloqueos.push({
          tipo: 'aulaSinFranjas',
          mensaje: `En la jornada de la ${jornada === 'manana' ? 'mañana' : 'tarde'} hay ${clases} clases y con ${e.aulas.length} aulas solo caben ${caben}.`,
        })
    }
  for (const [llave, horas] of porAula) {
    const aulaId = llave.split('/')[1]
    if (horas > dias * FRANJAS)
      bloqueos.push({
        tipo: 'aulaSinFranjas', aulaId,
        mensaje: `El aula ${e.aulas.find((a) => a.id === aulaId)?.nombre ?? aulaId} tiene ${horas} clases y solo ${dias * FRANJAS} franjas.`,
      })
  }
  return bloqueos
}

/**
 * Explica por qué no se logró un horario completo y propone salidas, de menor a mayor impacto.
 * Solo propone: nunca cambia el estado. Cada propuesta se prueba con una búsqueda corta.
 */
export const diagnosticar = (e: Estado, r: ResultadoGenerar): { bloqueos: Bloqueo[]; propuestas: Propuesta[] } => {
  if (r.completo) return { bloqueos: [], propuestas: [] }
  const { reglas } = e.colegio
  const area = (id: Id) => e.areas.find((a) => a.id === id)?.nombre ?? 'un área'
  const pendientes = r.sinUbicar.flatMap((s) => {
    const a = e.asignaciones.find((x) => x.id === s.asignacionId)
    const g = e.grupos.find((x) => x.id === a?.grupoId)
    const d = e.docentes.find((x) => x.id === a?.docenteId)
    return a && g && d ? [{ ...s, a, g, d }] : []
  })

  const bloqueos = prechequear(e)
  if (bloqueos.length === 0)
    for (const p of pendientes) {
      const causas = Object.entries(p.causas).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([c]) => NOMBRE_CAUSA[c] ?? c)
      bloqueos.push({
        tipo: 'busqueda', docenteId: p.d.id, grupoId: p.g.id, areaId: p.a.areaId,
        mensaje: `No se pudieron ubicar ${p.horas} horas de ${area(p.a.areaId)} de ${nombreGrupo(p.g)} con ${p.d.nombre}. Lo que más estorba: ${causas.join(' y ')}.`,
      })
    }

  const estorba = (causa: string) => pendientes.some((p) => (p.causas as Record<string, number>)[causa] > 0)
  const hay = (tipo: Bloqueo['tipo']) => bloqueos.some((b) => b.tipo === tipo)
  const borradores: Omit<Propuesta, 'resuelve'>[] = []

  // 1. Reasignar las horas que no caben a otro docente del área o de un área afín.
  for (const p of pendientes.slice(0, 2)) {
    const candidatos = e.docentes
      .filter((d) => d.id !== p.d.id && dictaEn(d, p.g.jornada) && d.nivel === p.d.nivel)
      .filter((d) => d.areaId === p.a.areaId || e.areas.find((x) => x.id === d.areaId)?.afines.includes(p.a.areaId))
      .map((d) => ({ d, propia: d.areaId === p.a.areaId, cupo: cargaEnCiclo(d, diasHorario(e)) - horasDocente(e, d.id).total }))
      // Solo quien tenga horas libres en su carga para recibirlas.
      .filter((c) => c.cupo >= (p.horas * diasHorario(e)) / cicloDeGrupo(e, p.g))
      .sort((x, y) => Number(y.propia) - Number(x.propia) || y.cupo - x.cupo)
    for (const { d } of candidatos.slice(0, 2))
      borradores.push({
        tipo: 'reasignar', impacto: 1,
        descripcion: `Reasignar ${p.horas} horas de ${area(p.a.areaId)} de ${nombreGrupo(p.g)}: de ${p.d.nombre} a ${d.nombre}.`,
        aplicar: (x) => {
          const destino = x.asignaciones.find((y) => y.docenteId === d.id && y.grupoId === p.g.id && y.areaId === p.a.areaId)
          const asignaciones = x.asignaciones
            .map((y) => (y.id === p.a.id ? { ...y, horas: y.horas - p.horas } : y.id === destino?.id ? { ...y, horas: y.horas + p.horas } : y))
            .filter((y) => y.horas > 0)
          if (!destino) asignaciones.push({ id: nuevoId(), docenteId: d.id, grupoId: p.g.id, areaId: p.a.areaId, horas: p.horas })
          return { ...x, asignaciones }
        },
      })
  }

  // 2. Relajar una regla configurable.
  const conReglas = (x: Estado, cambio: (r: Estado['colegio']['reglas']) => void): Estado => {
    const nuevas = structuredClone(x.colegio.reglas)
    cambio(nuevas)
    return { ...x, colegio: { ...x.colegio, reglas: nuevas } }
  }
  if (reglas.maxMateriaDia.activa && (estorba('maxMateria') || hay('materiaNoCabe')))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2,
      descripcion: `Subir el máximo de horas de la misma materia por día de ${reglas.maxMateriaDia.valor} a ${reglas.maxMateriaDia.valor + 1}.`,
      aplicar: (x) => conReglas(x, (n) => void n.maxMateriaDia.valor++),
    })
  if (reglas.maxDocenteDia.activa && (estorba('maxDocente') || hay('docenteGrupoNoCabe')))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2,
      descripcion: `Subir el máximo de horas con el mismo docente por día de ${reglas.maxDocenteDia.valor} a ${reglas.maxDocenteDia.valor + 1}.`,
      aplicar: (x) => conReglas(x, (n) => void n.maxDocenteDia.valor++),
    })
  if (reglas.horaLibre.activa && estorba('horaLibre'))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2, descripcion: 'Desactivar la regla de hora libre.',
      aplicar: (x) => conReglas(x, (n) => void (n.horaLibre.activa = false)),
    })
  if (reglas.libreDiaria?.activa && (estorba('libreDiaria') || hay('docenteSinFranjas')))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2, descripcion: 'Desactivar la regla de una hora libre todos los días.',
      aplicar: (x) => conReglas(x, (n) => void (n.libreDiaria = { activa: false })),
    })
  if (reglas.bloquesDeDos?.activa && pendientes.some((p) => enBloqueDeDos(e, p.a)))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2, descripcion: 'Desactivar la regla de materias de 2 horas siempre en bloque.',
      aplicar: (x) => conReglas(x, (n) => void (n.bloquesDeDos = { activa: false })),
    })
  if (reglas.espaciarMaterias?.activa && estorba('diasSeguidos'))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2, descripcion: 'Desactivar la regla de materias cortas en días separados.',
      aplicar: (x) => conReglas(x, (n) => void (n.espaciarMaterias = { activa: false })),
    })
  if (reglas.cargaPareja?.activa && estorba('cargaPareja'))
    borradores.push({
      tipo: 'relajarRegla', impacto: 2, descripcion: 'Desactivar la regla de carga pareja.',
      aplicar: (x) => conReglas(x, (n) => void (n.cargaPareja = { activa: false })),
    })

  // 3. Cambiar la disponibilidad de un docente.
  const restringidos = new Set([
    ...pendientes.filter((p) => p.causas.disponibilidad).map((p) => p.d.id),
    ...bloqueos.filter((b) => b.tipo === 'docenteSinFranjas').map((b) => b.docenteId!),
  ])
  for (const id of restringidos) {
    const d = e.docentes.find((x) => x.id === id)!
    if (d.noDisponible.length === 0) continue
    borradores.push({
      tipo: 'disponibilidad', impacto: 3,
      descripcion: `Liberar las ${d.noDisponible.length} franjas en que ${d.nombre} no está disponible.`,
      aplicar: (x) => ({ ...x, docentes: x.docentes.map((y) => (y.id === id ? { ...y, noDisponible: [] } : y)) }),
    })
  }

  // 4. Agregar un aula o cambiar el modelo de aula.
  if (estorba('aula') || hay('aulaSinFranjas')) {
    const vistos = new Set<string>()
    const compartido = e.grupos.find((g) => {
      const llave = `${g.jornada}/${g.aulaId}`
      if (g.aulaId && vistos.has(llave)) return true
      vistos.add(llave)
      return false
    })
    if (compartido && (e.colegio.modeloAula === 'grupo' || e.colegio.modeloAula === 'mixto'))
      borradores.push({
        tipo: 'aula', impacto: 4,
        descripcion: `Agregar un aula y dársela al grupo ${nombreGrupo(compartido)}, que hoy comparte la suya.`,
        aplicar: (x) => {
          const aula = { id: nuevoId(), nombre: `Aula nueva ${x.aulas.length + 1}` }
          return { ...x, aulas: [...x.aulas, aula], grupos: x.grupos.map((g) => (g.id === compartido.id ? { ...g, aulaId: aula.id } : g)) }
        },
      })
    if (e.colegio.modeloAula === 'libre')
      borradores.push({
        tipo: 'aula', impacto: 4, descripcion: 'Agregar un aula más para los docentes que rotan.',
        aplicar: (x) => ({ ...x, aulas: [...x.aulas, { id: nuevoId(), nombre: `Aula nueva ${x.aulas.length + 1}` }] }),
      })
    else if (e.colegio.modeloAula !== 'grupo')
      borradores.push({
        tipo: 'aula', impacto: 4, descripcion: 'Cambiar el modelo de aula a "cada grupo tiene su aula".',
        aplicar: (x) => ({ ...x, colegio: { ...x.colegio, modeloAula: 'grupo' } }),
      })
  }

  const propuestas = borradores.slice(0, 8).map((b) => ({ ...b, resuelve: generarHorario(b.aplicar(e), { tiempoMs: 800 }).completo }))
  propuestas.sort((a, b) => a.impacto - b.impacto || Number(b.resuelve) - Number(a.resuelve))
  return { bloqueos, propuestas }
}
