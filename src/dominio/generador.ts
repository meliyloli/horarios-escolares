import { repartirAulas } from './aulas'
import { aplicaMaxDocente, areasSinBloque, aulaDeClase, detectarCruces, enBloqueDeDos, materiasEspaciadas, type TipoCruce } from './cruces'
import { cicloDeGrupo, claveDocente, diasHorario, diasOcupados, diasVecinos, esMediaTecnica, FRANJAS, franjasDisponibles, jornadaDeAsignacion, jornadasDe, nivelDeGrado } from './tiempo'
import type { Clase, Estado, Id } from './tipos'

export interface OpcionesGenerar {
  tiempoMs?: number
  semilla?: number
  /** Parte del horario que ya existe: cada clase se queda donde está salvo que haga falta moverla. */
  conservar?: boolean
}

export interface SinUbicar {
  asignacionId: Id
  horas: number
  /** Cuántas celdas del ciclo bloqueó cada causa. */
  causas: Partial<Record<TipoCruce, number>>
}

export interface ResultadoGenerar {
  clases: Clase[]
  sinUbicar: SinUbicar[]
  completo: boolean
}

/** Una o dos horas seguidas de clase por ubicar. `celda` es la primera franja, o -1 mientras no tenga lugar. */
interface Unidad {
  asignacionId: Id
  docente: number
  grupo: number
  jornada: string
  areaId: Id
  aula: string | undefined
  ciclo: 5 | 10
  maxDocente: boolean
  /** Media técnica: sin máximo diario de materia, y no cuenta en los máximos de las demás. */
  mt: boolean
  /** 2 = bloque de dos horas seguidas en las franjas 1-2, 3-4 o 5-6. */
  largo: 1 | 2
  fija: boolean
  /** Bloque que nunca se parte en horas sueltas (materias de 2 horas con la regla activa). */
  obligatorio?: boolean
  claseId?: Id
  aulaManual?: Id
  celda: number
}

const azar = (semilla: number) => () => {
  semilla = (semilla + 0x6d2b79f5) | 0
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Ubica cada hora de la asignación en un día y una franja cumpliendo todas las reglas activas.
 * Método: toma una hora sin ubicar, busca la celda que obliga a sacar menos clases ya puestas,
 * las saca y las vuelve a encolar. Las clases fijadas y la disponibilidad nunca se tocan.
 * Con la regla de bloques, primero intenta de a dos horas seguidas y lo que no quepa lo deja suelto.
 */
export const generarHorario = (e: Estado, opciones: OpcionesGenerar = {}): ResultadoGenerar => {
  // Varios intentos con semillas distintas mientras haya tiempo: se queda con el que deja menos horas sin ubicar
  // (y, con carga pareja, el más parejo). Si el primero sale completo, no hay más intentos.
  const { tiempoMs = 4000, semilla = 1 } = opciones
  const pareja = !!e.colegio.reglas.cargaPareja?.activa
  const fin = Date.now() + tiempoMs
  let mejor: ResultadoGenerar | undefined
  let mejorPuntos = Infinity
  for (let intento = 0; intento < 12; intento++) {
    const resta = fin - Date.now()
    const r = generarUnaVez(e, { ...opciones, tiempoMs: Math.max(100, intento === 0 ? resta * 0.5 : resta), semilla: semilla + intento * 7919 })
    const disparejos = pareja ? detectarCruces({ ...e, clases: r.clases }).filter((c) => c.tipo === 'cargaPareja').length : 0
    const puntos = r.sinUbicar.reduce((n, x) => n + x.horas, 0) * 1000 + disparejos
    if (puntos < mejorPuntos) [mejor, mejorPuntos] = [r, puntos]
    if (puntos === 0 || Date.now() >= fin) break
  }
  return mejor!
}

const generarUnaVez = (e: Estado, opciones: OpcionesGenerar): ResultadoGenerar => {
  const { tiempoMs = 4000, semilla = 1, conservar = false } = opciones
  const rnd = azar(semilla)
  const dias = diasHorario(e)
  const { reglas } = e.colegio
  const celdasDia = dias * FRANJAS
  const aulaLibre = e.colegio.modeloAula === 'libre'

  // --- Unidades ---
  const unidades: Unidad[] = []
  // Las fijadas primero: si sobran clases, se descartan las sueltas.
  const fijadas = e.clases.filter((c) => c.fijada || conservar).sort((x, y) => Number(y.fijada) - Number(x.fijada))
  for (const a of e.asignaciones) {
    const docente = e.docentes.findIndex((d) => d.id === a.docenteId)
    const grupo = e.grupos.findIndex((g) => g.id === a.grupoId)
    if (docente < 0 || grupo < 0) continue
    const g = e.grupos[grupo]
    const ciclo = cicloDeGrupo(e, g)
    // La media técnica es una jornada extra: va en la otra jornada y sin máximos diarios de materia ni de docente.
    const mt = esMediaTecnica(e, a.areaId)
    const maxDocente = !mt && aplicaMaxDocente(reglas, e.docentes[docente], g)
    // La jornada de la materia: la del grupo, o la otra si va en contrajornada (o es media técnica).
    const jornada = jornadaDeAsignacion(e, a)
    const base = { asignacionId: a.id, docente, grupo, jornada, areaId: a.areaId, ciclo, maxDocente, mt }
    const aulaDe = (c: Clase) => {
      const id = aulaDeClase(e, c)
      return id && `${jornada}/${id}`
    }
    const suelta = aulaDe({ id: '', asignacionId: a.id, dia: 1, franja: 1, fijada: false })
    let suyas = fijadas.filter((c) => c.asignacionId === a.id && c.dia <= ciclo).slice(0, a.horas)
    const obligatorio = enBloqueDeDos(e, a)
    let bloquesPuestos = 0
    if (obligatorio) {
      // Las que ya están juntas en un par de franjas siguen como un bloque; de las sueltas solo quedan las fijadas.
      const pares = new Map<string, Clase[]>()
      for (const c of suyas) pares.set(`${c.dia}|${Math.ceil(c.franja / 2)}`, [...(pares.get(`${c.dia}|${Math.ceil(c.franja / 2)}`) ?? []), c])
      for (const par of pares.values())
        if (par.length === 2) {
          const c = par[0]
          unidades.push({ ...base, aula: suelta, largo: 2, fija: par.some((x) => x.fijada), obligatorio: true, celda: (c.dia - 1) * FRANJAS + (Math.ceil(c.franja / 2) - 1) * 2 })
          bloquesPuestos++
        }
      suyas = [...pares.values()].filter((p) => p.length !== 2).flat().filter((c) => c.fijada)
    }
    for (const c of suyas)
      unidades.push({ ...base, aula: aulaDe(c), largo: 1, fija: c.fijada, claseId: c.id, aulaManual: c.aulaId, celda: (c.dia - 1) * FRANJAS + c.franja - 1 })
    // Un bloque cuenta 2 horas en los máximos diarios: solo se arma si esos máximos lo permiten.
    const enBloques =
      !!reglas.bloques?.activa && (nivelDeGrado(g.grado) === 'bachillerato' || reglas.bloques.primaria) && !reglas.bloques.sinBloque?.includes(a.areaId) &&
      (!reglas.maxMateriaDia.activa || reglas.maxMateriaDia.valor >= 2) && (!maxDocente || reglas.maxDocenteDia.valor >= 2)
    let faltan = Math.floor(a.horas) - suyas.length - 2 * bloquesPuestos
    for (; obligatorio && faltan >= 2; faltan -= 2) unidades.push({ ...base, aula: suelta, largo: 2, fija: false, obligatorio: true, celda: -1 })
    for (; enBloques && faltan >= 2; faltan -= 2) unidades.push({ ...base, aula: suelta, largo: 2, fija: false, celda: -1 })
    for (; faltan > 0; faltan--) unidades.push({ ...base, aula: suelta, largo: 1, fija: false, celda: -1 })
  }

  // --- Ocupación: por docente, grupo y aula, qué unidad hay en cada celda del horario completo ---
  const tabla = () => new Int32Array(celdasDia).fill(-1)
  // Un docente de mañana y tarde tiene dos filas de franjas por día: la de la tarde va después de la de la mañana.
  const ambas = e.docentes.map((d) => d.jornada === 'ambas')
  const ocDocente = e.docentes.map((d) => new Int32Array(celdasDia * jornadasDe(d).length).fill(-1))
  /** Dónde va, en la fila del docente, la celda `t` del horario de una unidad (según la jornada de su grupo). */
  const enDocente = (u: Unidad, t: number) => (ambas[u.docente] && u.jornada === 'tarde' ? t + celdasDia : t)
  /** Las celdas del docente en el día `k` (desde 0), en sus dos jornadas si tiene dos. */
  const diaDocente = (d: number, k: number): number[] => {
    const una = Array.from({ length: FRANJAS }, (_, f) => k * FRANJAS + f)
    return ambas[d] ? [...una, ...una.map((t) => t + celdasDia)] : una
  }
  const ocupadasDia = (d: number, k: number, ignorar: (j: number) => boolean = () => false) =>
    diaDocente(d, k).map((t) => ocDocente[d][t]).filter((j) => j >= 0 && !ignorar(j))
  // Cada grupo tiene dos filas de franjas por día, la de la mañana y la de la tarde (para las materias en contrajornada).
  const ocGrupo = e.grupos.map(() => new Int32Array(celdasDia * 2).fill(-1))
  const enGrupo = (u: Unidad, t: number) => (u.jornada === 'tarde' ? t + celdasDia : t)
  /** Cuántas clases del grupo `g` hay el día `k` (desde 0), mañana y tarde, que cumplan `cuenta`. Sin crear listas: va en el ciclo más usado. */
  const contarDiaGrupo = (g: number, k: number, cuenta: (j: number) => boolean): number => {
    const oc = ocGrupo[g]
    let n = 0
    for (let f = 0, a = k * FRANJAS, b = celdasDia + k * FRANJAS; f < FRANJAS; f++) {
      if (oc[a + f] >= 0 && cuenta(oc[a + f])) n++
      if (oc[b + f] >= 0 && cuenta(oc[b + f])) n++
    }
    return n
  }
  /** Las clases del grupo `g` el día `k` (desde 0), mañana y tarde. */
  const diaGrupo = (g: number, k: number): number[] => {
    const r: number[] = []
    contarDiaGrupo(g, k, (j) => (r.push(j), true))
    return r
  }
  const ocAula = new Map<string, Int32Array>()
  for (const u of unidades) if (u.aula && !ocAula.has(u.aula)) ocAula.set(u.aula, tabla())
  const bloqueado = e.docentes.map((d) => {
    const t = new Uint8Array(celdasDia * jornadasDe(d).length)
    jornadasDe(d).forEach((j, parte) => {
      for (let dia = 1; dia <= dias; dia++)
        for (let f = 1; f <= FRANJAS; f++) if (d.noDisponible.includes(claveDocente(d, dia, f, j))) t[parte * celdasDia + (dia - 1) * FRANJAS + f - 1] = 1
    })
    return t
  })
  const sinBloque = areasSinBloque(reglas)
  // Materias cortas en días separados, por «índice de grupo|área».
  // Media técnica de un docente con un grupo: si sus horas caben en un día, van todas ese día.
  const mtEnUnDia = new Set<string>()
  {
    const horas = new Map<string, number>()
    for (const u of unidades) if (u.mt) horas.set(`${u.docente}|${u.grupo}`, (horas.get(`${u.docente}|${u.grupo}`) ?? 0) + u.largo)
    for (const [llave, h] of horas) if (h <= FRANJAS) mtEnUnDia.add(llave)
  }
  const espaciadas = new Set([...materiasEspaciadas(e)].map((llave) => {
    const [grupoId, areaId] = llave.split('|')
    return `${e.grupos.findIndex((g) => g.id === grupoId)}|${areaId}`
  }))
  // Hora libre diaria y carga pareja: cuántas clases puede tener cada docente cada día del horario.
  const disponibles = e.docentes.map((d) => franjasDisponibles(d, dias))
  const pareja = !!reglas.cargaPareja?.activa
  const topes = e.docentes.map((_, d) => {
    if (!reglas.libreDiaria?.activa && !pareja) return null
    const caps = disponibles[d]
    const horas = unidades.reduce((n, u) => n + (u.docente === d ? u.largo * (u.ciclo < dias ? 2 : 1) : 0), 0)
    const vaDias = caps.filter((c) => c > 0).length
    // Con carga pareja, cada día deja al menos el promedio de horas libres (redondeado hacia abajo).
    const parejo = pareja && vaDias > 0 ? Math.floor(Math.max(0, caps.reduce((s, c) => s + c, 0) - horas) / vaDias) : 0
    const libre = reglas.libreDiaria?.activa ? 1 : 0
    return { maximo: caps.map((c) => Math.max(0, c - Math.max(libre, parejo))), causa: (parejo > libre ? 'cargaPareja' : 'libreDiaria') as TipoCruce }
  })

  /** Celdas del horario completo que ocupa una unidad puesta en `celda` de su ciclo. */
  const celdasDe = (u: Unidad, celda: number): number[] => {
    const dia = Math.floor(celda / FRANJAS) + 1
    return diasOcupados(dia, u.ciclo, dias).flatMap((d) => {
      const t = (d - 1) * FRANJAS + (celda % FRANJAS)
      return u.largo === 2 ? [t, t + 1] : [t]
    })
  }
  const poner = (i: number, celda: number) => {
    const u = unidades[i]
    u.celda = celda
    for (const t of celdasDe(u, celda)) {
      ocDocente[u.docente][enDocente(u, t)] = i
      ocGrupo[u.grupo][enGrupo(u, t)] = i
      if (u.aula) ocAula.get(u.aula)![t] = i
    }
  }
  const quitar = (i: number) => {
    const u = unidades[i]
    for (const t of celdasDe(u, u.celda)) {
      if (ocDocente[u.docente][enDocente(u, t)] === i) ocDocente[u.docente][enDocente(u, t)] = -1
      if (ocGrupo[u.grupo][enGrupo(u, t)] === i) ocGrupo[u.grupo][enGrupo(u, t)] = -1
      if (u.aula && ocAula.get(u.aula)![t] === i) ocAula.get(u.aula)![t] = -1
    }
    u.celda = -1
  }
  unidades.forEach((u, i) => u.fija && poner(i, u.celda))

  /**
   * Qué unidades habría que sacar para poner `i` en `celda`, o null si choca con algo intocable
   * (disponibilidad o una clase fijada). Si se pasa `causas`, anota qué reglas estorban.
   */
  const estorbos = (i: number, celda: number, causas?: Set<TipoCruce>): number[] | null => {
    const u = unidades[i]
    const fuera = new Set<number>()
    let posible = true
    const sacar = (j: number, causa: TipoCruce) => {
      if (j < 0 || j === i || fuera.has(j)) return
      causas?.add(causa)
      if (unidades[j].fija) posible = false
      else fuera.add(j)
    }
    /** Saca unidades sueltas de `enCeldas` (una entrada por hora) hasta que quepan `nuevas` horas más bajo `tope`. */
    const hacerLugar = (enCeldas: number[], nuevas: number, tope: number, causa: TipoCruce) => {
      let horas = enCeldas.length
      if (horas + nuevas <= tope) return
      causas?.add(causa)
      const sueltas = [...new Set(enCeldas)].filter((j) => !unidades[j].fija).sort(() => rnd() - 0.5)
      for (const j of sueltas) {
        if (horas + nuevas <= tope) break
        fuera.add(j)
        horas -= enCeldas.filter((x) => x === j).length
      }
      if (horas + nuevas > tope) posible = false
    }

    const porDia = new Map<number, number[]>()
    for (const t of celdasDe(u, celda)) porDia.set(t - (t % FRANJAS), [...(porDia.get(t - (t % FRANJAS)) ?? []), t])
    for (const [inicio, celdas] of porDia) {
      for (const t of celdas) {
        if (bloqueado[u.docente][enDocente(u, t)]) {
          causas?.add('disponibilidad')
          posible = false
        }
        sacar(ocDocente[u.docente][enDocente(u, t)], 'docente')
        sacar(ocGrupo[u.grupo][enGrupo(u, t)], 'grupo')
        if (u.aula) sacar(ocAula.get(u.aula)![t], 'aula')
        // Aulas libres: a la misma hora no puede haber más clases que aulas.
        if (aulaLibre) {
          const aLaVez = ocGrupo.map((oc) => oc[enGrupo(u, t)]).filter((j) => j >= 0 && j !== i && !fuera.has(j))
          hacerLugar(aLaVez, 1, e.aulas.length, 'aula')
        }
      }
      // Máximos por día y hora libre, contando las horas que esta unidad pone ese día.
      const horasGrupo = (igual: (x: Unidad) => boolean) =>
        diaGrupo(u.grupo, inicio / FRANJAS).filter((j) => j >= 0 && j !== i && !fuera.has(j) && !unidades[j].mt && igual(unidades[j]))
      if (reglas.maxMateriaDia.activa && !u.mt) hacerLugar(horasGrupo((x) => x.areaId === u.areaId), celdas.length, reglas.maxMateriaDia.valor, 'maxMateria')
      if (u.maxDocente) hacerLugar(horasGrupo((x) => x.docente === u.docente), celdas.length, reglas.maxDocenteDia.valor, 'maxDocente')
      const tope = topes[u.docente]
      if (tope) {
        const delDia = ocupadasDia(u.docente, inicio / FRANJAS, (j) => j === i || fuera.has(j))
        hacerLugar(delDia, celdas.length, tope.maximo[inicio / FRANJAS], tope.causa)
      }

      if (reglas.horaLibre.activa) {
        const dia = inicio / FRANJAS + 1
        const lleno = FRANJAS * (ambas[u.docente] ? 2 : 1)
        const clasesEn = (d: number) => (d === dia ? celdas.length : 0) + ocupadasDia(u.docente, d - 1, (j) => j === i || fuera.has(j)).length
        const rota = () =>
          [dia, ...diasVecinos(dia, dias)].some((d) => clasesEn(d) >= lleno && diasVecinos(d, dias).every((v) => clasesEn(v) >= lleno))
        // Si el docente queda con un día lleno sin vecino con hueco, sale una clase suya de este día.
        while (rota()) {
          causas?.add('horaLibre')
          const sueltas = [...new Set(ocupadasDia(u.docente, inicio / FRANJAS))].filter((j) => j !== i && !fuera.has(j) && !unidades[j].fija)
          if (sueltas.length === 0) {
            posible = false
            break
          }
          fuera.add(sueltas[Math.floor(rnd() * sueltas.length)])
        }
      }
    }
    // Una materia excluida de los bloques no queda pegada a otra hora suya en el mismo par de franjas (1-2, 3-4, 5-6).
    if (sinBloque.has(u.areaId))
      for (const t of celdasDe(u, celda)) {
        const j = ocGrupo[u.grupo][enGrupo(u, t - (t % FRANJAS) + ((t % FRANJAS) ^ 1))]
        if (j >= 0 && unidades[j].areaId === u.areaId) sacar(j, 'bloqueExcluido')
      }
    // Media técnica: el docente atiende un solo grupo por día, y las horas de un grupo que caben en un día van juntas.
    if (u.mt) {
      const k = Math.floor(celda / FRANJAS)
      for (const j of ocupadasDia(u.docente, k)) if (unidades[j].mt && unidades[j].grupo !== u.grupo) sacar(j, 'mediaTecnicaDia')
      if (mtEnUnDia.has(`${u.docente}|${u.grupo}`))
        for (let d = 0; d < u.ciclo; d++)
          if (d !== k) for (const j of ocupadasDia(u.docente, d)) if (unidades[j].mt && unidades[j].grupo === u.grupo) sacar(j, 'mediaTecnicaDia')
    }
    // Una materia corta no va el día anterior ni el siguiente (en el ciclo del grupo) a otra clase suya.
    if (espaciadas.has(`${u.grupo}|${u.areaId}`)) {
      const dia = Math.floor(celda / FRANJAS) + 1
      for (const v of diasVecinos(dia, u.ciclo))
        for (const j of diaGrupo(u.grupo, v - 1)) if (j >= 0 && unidades[j].areaId === u.areaId) sacar(j, 'diasSeguidos')
    }
    return posible ? [...fuera] : null
  }

  // Al conservar, cada clase suelta vuelve a su lugar si ahí no rompe ninguna regla; si no, se vuelve a ubicar.
  unidades.forEach((u, i) => {
    if (u.fija || u.celda < 0) return
    const celda = u.celda
    u.celda = -1
    if (estorbos(i, celda)?.length === 0) poner(i, celda)
  })
  // --- Búsqueda ---
  const inicioReloj = Date.now()
  const fin = inicioReloj + tiempoMs
  /** Celdas del ciclo donde puede empezar la unidad: un bloque solo en las franjas 1, 3 y 5. */
  const celdasPosibles = (u: Unidad): number[] => {
    const todas = Array.from({ length: u.ciclo * FRANJAS }, (_, c) => c)
    return u.largo === 2 ? todas.filter((c) => (c % FRANJAS) % 2 === 0) : todas
  }
  /**
   * Ubica `i` en un hueco o, si `prof` > 0, en el lugar de otra clase de su grupo que a su vez se ubica igual,
   * en una cadena de a lo sumo `prof` clases desplazadas. Las de `quietas` no se desplazan. Deshace todo si no lo logra.
   */
  const enCadena = (i: number, prof: number, quietas: Set<number>): boolean => {
    const u = unidades[i]
    const hueco = celdasPosibles(u).find((c) => estorbos(i, c)?.length === 0)
    if (hueco !== undefined) {
      poner(i, hueco)
      return true
    }
    if (prof === 0) return false
    for (const celda of celdasPosibles(u)) {
      const j = ocGrupo[u.grupo][enGrupo(u, celda)]
      const v = unidades[j]
      if (j < 0 || quietas.has(j) || v.fija || v.celda !== celda || v.largo !== u.largo) continue
      quitar(j)
      if (estorbos(i, celda)?.length === 0) {
        poner(i, celda)
        if (enCadena(j, prof - 1, new Set([...quietas, i]))) return true
        quitar(i)
      }
      poner(j, celda)
    }
    return false
  }
  // Al conservar, lo que quedó sin lugar prueba primero la cadena más corta de cambios dentro de su grupo.
  // Solo lo que así no se ubica pasa a la búsqueda general.
  if (conservar)
    unidades.forEach((u, i) => {
      for (let prof = 0; !u.fija && u.celda < 0 && prof <= 3 && Date.now() < fin; prof++) enCadena(i, prof, new Set([i]))
    })

  const libresDocente = (u: Unidad) => bloqueado[u.docente].reduce((n, b) => n + (b ? 0 : 1), 0)
  const cargaDocente = e.docentes.map((_, d) => unidades.reduce((n, u) => n + (u.docente === d ? u.largo : 0), 0))
  const tabu = new Map<number, number>() // unidad*1000+celda → iteración hasta la que no puede volver
  let cola: number[] = []
  let imposibles: number[] = []
  let mejor: Int32Array | null = null
  let mejorFaltan = Infinity
  let iter = 0
  const guardarSiMejora = () => {
    const faltan = [...cola, ...imposibles].reduce((n, i) => n + unidades[i].largo, 0)
    if (faltan < mejorFaltan) {
      mejorFaltan = faltan
      mejor = Int32Array.from(unidades, (u) => u.celda)
    }
  }
  /** Deja el tablero en la mejor solución vista. */
  const restaurarMejor = () => {
    const final: Int32Array = mejor ?? Int32Array.from(unidades, (u) => u.celda)
    unidades.forEach((u, i) => !u.fija && u.celda >= 0 && quitar(i))
    unidades.forEach((u, i) => !u.fija && final[i] >= 0 && poner(i, final[i]))
  }
  const buscar = (hasta: number) => {
    cola = unidades.map((_, i) => i).filter((i) => !unidades[i].fija && unidades[i].celda < 0)
    imposibles = []
    mejor = null
    mejorFaltan = Infinity
    // Primero las más difíciles: bloques, y docentes con menos franjas disponibles para su carga.
    cola.sort((a, b) => {
      const [ua, ub] = [unidades[a], unidades[b]]
      return ub.largo - ua.largo || libresDocente(ua) - cargaDocente[ua.docente] - (libresDocente(ub) - cargaDocente[ub.docente]) || rnd() - 0.5
    })
    guardarSiMejora()
    for (const tope = iter + 400000; cola.length > 0 && iter < tope; iter++) {
      if ((iter & 63) === 0 && Date.now() > hasta) break
      const i = cola.shift()!
      const u = unidades[i]
      let elegida = -1
      let elegidaFuera: number[] = []
      let menor = Infinity
      for (const celda of celdasPosibles(u)) {
        const fuera = estorbos(i, celda)
        if (!fuera) continue
        const vetada = (tabu.get(i * 1000 + celda) ?? -1) > iter
        // Entre celdas iguales prefiere repartir la materia en días distintos.
        const inicio = celda - (celda % FRANJAS)
        // Con carga pareja, también prefiere los días en que el docente tiene menos clases.
        let mismaMateria = 0
        let delDocente = 0
        mismaMateria = contarDiaGrupo(u.grupo, inicio / FRANJAS, (j) => unidades[j].areaId === u.areaId)
        if (pareja) delDocente = ocupadasDia(u.docente, inicio / FRANJAS, (j) => j === i).length
        const costo = fuera.reduce((n, j) => n + unidades[j].largo, 0) * 100 + (vetada ? 1000 : 0) + mismaMateria * 3 + delDocente * 4 + rnd()
        if (costo < menor) [menor, elegida, elegidaFuera] = [costo, celda, fuera]
      }
      if (elegida < 0) {
        imposibles.push(i)
        continue
      }
      for (const j of elegidaFuera) {
        tabu.set(j * 1000 + unidades[j].celda, iter + 20 + Math.floor(rnd() * 20))
        quitar(j)
        cola.push(j)
      }
      poner(i, elegida)
      guardarSiMejora()
    }
    restaurarMejor()
  }

  const hayBloques = unidades.some((u) => u.largo === 2)
  buscar(hayBloques ? inicioReloj + tiempoMs * 0.6 : fin)
  // Los bloques que no cupieron se parten en dos horas sueltas y se sigue buscando.
  if (unidades.some((u) => u.largo === 2 && u.celda < 0)) {
    for (const u of [...unidades]) {
      if (u.largo !== 2 || u.celda >= 0 || u.obligatorio) continue
      u.largo = 1
      unidades.push({ ...u })
    }
    buscar(fin)
  }

  // Carga pareja: pasa clases del docente de sus días más llenos a los más libres: a una franja vacía del grupo,
  // intercambiándola con otra clase del grupo o llevando esa otra clase a cualquier lugar donde quepa.
  // Ningún cambio rompe una regla, toca una clase fijada ni deja más disparejo al otro docente.
  if (pareja) {
    const limite = fin + 1500
    const libresPorDia = (d: number): (number | null)[] =>
      disponibles[d].map((cap, k) => (cap > 0 ? cap - ocupadasDia(d, k).length : null))
    const desorden = (d: number) => libresPorDia(d).reduce<number>((s, l) => s + (l ?? 0) ** 2, 0)
    const diasDe = (u: Unidad, celda: number) => celdasDe(u, celda).map((t) => Math.floor(t / FRANJAS))
    /** Lleva cada unidad a su celda nueva; deshace todo y devuelve false si algo rompe una regla o no queda más parejo. */
    const probar = (movidas: [number, number][]): boolean => {
      const docentes = [...new Set(movidas.map(([i]) => unidades[i].docente))]
      const antes = docentes.reduce((s, d) => s + desorden(d), 0)
      const desde = movidas.map(([i]) => unidades[i].celda)
      for (const [i] of movidas) quitar(i)
      let cabe = true
      for (const [i, celda] of movidas) {
        if (estorbos(i, celda)?.length !== 0) {
          cabe = false
          break
        }
        poner(i, celda)
      }
      if (cabe && docentes.reduce((s, d) => s + desorden(d), 0) < antes) return true
      for (const [i] of movidas) if (unidades[i].celda >= 0) quitar(i)
      movidas.forEach(([i], k) => poner(i, desde[k]))
      return false
    }
    const emparejarUno = (d: number): boolean => {
      const libres = libresPorDia(d)
      const valores = libres.filter((l): l is number => l !== null)
      if (valores.length === 0) return false
      const [menos, mas] = [Math.min(...valores), Math.max(...valores)]
      if (mas - menos < 2) return false
      for (let i = 0; i < unidades.length; i++) {
        const u = unidades[i]
        if (u.docente !== d || u.fija || u.celda < 0 || !diasDe(u, u.celda).some((k) => libres[k] === menos)) continue
        for (const celda of celdasPosibles(u)) {
          if (Date.now() > limite) return false
          const destino = diasDe(u, celda)
          if (destino.some((k) => (libres[k] ?? -1) < menos + 2)) continue
          const j = ocGrupo[u.grupo][enGrupo(u, celda)]
          if (j < 0) {
            if (probar([[i, celda]])) return true
            continue
          }
          const v = unidades[j]
          if (j === i || v.fija || v.celda !== celda || v.largo !== u.largo) continue
          const desde = u.celda
          if (probar([[i, celda], [j, desde]])) return true
          for (const otra of celdasPosibles(v)) if (otra !== celda && otra !== desde && probar([[i, celda], [j, otra]])) return true
        }
      }
      return false
    }
    // Varias vueltas: emparejar a un docente puede abrir lugar para otro.
    for (let vuelta = 0, hubo = true; vuelta < 6 && hubo && Date.now() < limite; vuelta++) {
      hubo = false
      for (let d = 0; d < e.docentes.length; d++) for (let paso = 0; paso < 60 && emparejarUno(d); paso++) hubo = true
    }
  }

  // --- Resultado ---
  const usados = new Set(unidades.map((u) => u.claseId))
  const contador = new Map<Id, number>()
  const idNuevo = (asignacionId: Id): Id => {
    let n = contador.get(asignacionId) ?? 0
    let id: Id
    do id = `${asignacionId}#${++n}`
    while (usados.has(id))
    contador.set(asignacionId, n)
    return id
  }
  const clases: Clase[] = []
  const faltantes = new Map<Id, SinUbicar>()
  unidades.forEach((u, i) => {
    if (u.celda >= 0) {
      for (let k = 0; k < u.largo; k++)
        clases.push({
          id: u.claseId ?? idNuevo(u.asignacionId), asignacionId: u.asignacionId,
          dia: Math.floor(u.celda / FRANJAS) + 1, franja: (u.celda % FRANJAS) + 1 + k,
          ...(u.aulaManual ? { aulaId: u.aulaManual } : {}), fijada: u.fija,
        })
      return
    }
    const s = faltantes.get(u.asignacionId) ?? { asignacionId: u.asignacionId, horas: 0, causas: {} }
    s.horas += u.largo
    for (const celda of celdasPosibles(u)) {
      const causas = new Set<TipoCruce>()
      estorbos(i, celda, causas)
      for (const c of causas) s.causas[c] = (s.causas[c] ?? 0) + 1
    }
    faltantes.set(u.asignacionId, s)
  })
  const sinUbicar = [...faltantes.values()]
  // Con aulas libres, cada clase de quien rota recibe un aula que esté libre a esa hora.
  return { clases: repartirAulas({ ...e, clases }).clases, sinUbicar, completo: sinUbicar.length === 0 }
}

type Cruces = ReturnType<typeof detectarCruces>

/**
 * Vuelve a ubicar, partiendo del horario que existe, lo que hoy rompe una regla: cada clase se queda donde está
 * salvo que haga falta moverla, y las fijadas no se tocan. Devuelve null si no logra un horario mejor según
 * `mejor`, o si quedarían menos clases. Quita los reemplazos guardados desde `hoy` de las clases que cambiaron de hora.
 */
const reacomodar = (e: Estado, hoy: string, mejor: (antes: Cruces, despues: Cruces) => boolean) => {
  const antes = detectarCruces(e)
  const r = generarUnaVez(e, { conservar: true, tiempoMs: 1500, semilla: 1 })
  const despues = detectarCruces({ ...e, clases: r.clases })
  if (r.clases.length < e.clases.length || !mejor(antes, despues)) return null
  const previas = new Map(e.clases.map((c) => [c.id, c]))
  const movidas = new Set(r.clases.filter((c) => previas.get(c.id)?.dia !== c.dia || previas.get(c.id)?.franja !== c.franja).map((c) => c.id))
  const ajustes = e.ajustes.map((aj) =>
    aj.fecha < hoy ? aj : { ...aj, reemplazos: aj.reemplazos.filter((x) => !movidas.has(x.claseId)), movimientos: aj.movimientos.filter((x) => !movidas.has(x.claseId)) })
  return { estado: { ...e, clases: r.clases, ajustes }, antes, despues, movidas: movidas.size }
}

/** Cruces que se arreglan moviendo clases (las horas por ubicar y la carga se cuentan aparte). */
const deReglas = (cs: Cruces) => cs.filter((c) => c.tipo !== 'carga' && c.tipo !== 'sinUbicar' && c.tipo !== 'cargaPareja').length

/**
 * Después de cambiar docentes, aulas, grupos o reglas con un horario ya hecho: mueve solo las clases que
 * quedaron rompiendo una regla (por ejemplo, las de un docente en franjas en que ya no está disponible).
 */
export const reacomodarHorario = (e: Estado, hoy = new Date().toLocaleDateString('sv')): { estado: Estado; movidas: number } => {
  if (e.clases.length === 0 || deReglas(detectarCruces(e)) === 0) return { estado: e, movidas: 0 }
  const r = reacomodar(e, hoy, (antes, despues) => deReglas(despues) < deReglas(antes))
  return r ? { estado: r.estado, movidas: r.movidas } : { estado: e, movidas: 0 }
}

/**
 * Con la regla de carga pareja, empareja el horario que ya existe: mueve o intercambia las clases necesarias
 * sin tocar las fijadas. Nunca deja menos clases ni más cruces que antes.
 */
export const emparejarHorario = (e: Estado, hoy = new Date().toLocaleDateString('sv')): { estado: Estado; emparejados: number; quedan: number; movidas: number } => {
  const nada = { estado: e, emparejados: 0, quedan: 0, movidas: 0 }
  if (!e.colegio.reglas.cargaPareja?.activa || e.clases.length === 0) return nada
  const disparejos = (cs: Cruces) => new Set(cs.filter((c) => c.tipo === 'cargaPareja').map((c) => c.docenteId))
  const otros = (cs: Cruces) => cs.filter((c) => c.tipo !== 'cargaPareja').length
  const antes = disparejos(detectarCruces(e))
  if (antes.size === 0) return nada
  const r = reacomodar(e, hoy, (a, d) => otros(d) <= otros(a))
  if (!r) return { ...nada, quedan: antes.size }
  const quedan = disparejos(r.despues)
  return { estado: r.estado, emparejados: [...antes].filter((d) => !quedan.has(d)).length, quedan: quedan.size, movidas: r.movidas }
}

/**
 * Cuando cambia la asignación y ya hay horario: ubica las horas que faltan sin mover ninguna clase que ya está.
 * Lo que no cabe así queda por ubicar (y "Generar de nuevo" puede reacomodar todo).
 */
export const completarHorario = (e: Estado): { estado: Estado; ubicadas: number; sinUbicar: number } => {
  const puestas = new Map<Id, number>()
  for (const c of e.clases) puestas.set(c.asignacionId, (puestas.get(c.asignacionId) ?? 0) + 1)
  const faltan = e.asignaciones.reduce((n, a) => n + Math.max(0, Math.floor(a.horas) - (puestas.get(a.id) ?? 0)), 0)
  if (e.clases.length === 0 || faltan === 0) return { estado: e, ubicadas: 0, sinUbicar: 0 }
  const r = generarHorario({ ...e, clases: e.clases.map((c) => ({ ...c, fijada: true })) }, { tiempoMs: 250, semilla: 1 })
  const antes = new Map(e.clases.map((c) => [c.id, c]))
  const nuevas = r.clases.filter((c) => !antes.has(c.id))
  return { estado: { ...e, clases: [...e.clases, ...nuevas] }, ubicadas: nuevas.length, sinUbicar: faltan - nuevas.length }
}

/**
 * Vuelve a ubicar solo la media técnica: todas las demás clases se quedan exactamente donde están.
 * Cada docente de media técnica queda con un grupo por día y, si caben, las horas de cada grupo en un solo día.
 */
export const organizarMediaTecnica = (e: Estado): { estado: Estado; ubicadas: number; sinUbicar: number } => {
  const deMt = new Set(e.asignaciones.filter((a) => esMediaTecnica(e, a.areaId)).map((a) => a.id))
  const otras = e.clases.filter((c) => !deMt.has(c.asignacionId))
  const r = generarHorario({ ...e, clases: otras.map((c) => ({ ...c, fijada: true })) }, { tiempoMs: 1500, semilla: 1 })
  const nuevas = r.clases.filter((c) => deMt.has(c.asignacionId))
  const pedidas = e.asignaciones.filter((a) => deMt.has(a.id)).reduce((n, a) => n + Math.floor(a.horas), 0)
  return { estado: { ...e, clases: [...otras, ...nuevas] }, ubicadas: nuevas.length, sinUbicar: pedidas - nuevas.length }
}
