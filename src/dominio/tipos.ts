export type Id = string
export type Nivel = 'primaria' | 'bachillerato'
export type Jornada = 'manana' | 'tarde'
export type Ciclo = 5 | 10
/** 'libre': algunos docentes tienen aula fija y los demás dictan en la que esté libre a esa hora. */
/** 'ninguna': el horario no asigna aulas. */
export type ModeloAula = 'grupo' | 'docente' | 'mixto' | 'libre' | 'ninguna'

export interface Reglas {
  minimoAreaNombramiento: number
  maxMateriaDia: { activa: boolean; valor: number }
  maxDocenteDia: { activa: boolean; valor: number; aplicaEspecialistas: boolean }
  horaLibre: { activa: boolean }
  /** Preferir dos horas seguidas de la misma materia (franjas 1-2, 3-4 o 5-6) todas las veces que se pueda. */
  bloques?: { activa: boolean; primaria: boolean; /** Áreas que nunca van en bloque (por ejemplo, Educación Física). */ sinBloque?: Id[] }
  /** Cada docente tiene al menos una franja sin clase cada día que está en el colegio. */
  libreDiaria?: { activa: boolean }
  /** Las clases de cada docente se reparten parejo: de un día a otro sus horas libres difieren a lo sumo en una. */
  cargaPareja?: { activa: boolean }
  /** Una materia de `horas` (4 si falta) o menos por semana en un grupo no se dicta en dos días seguidos. */
  espaciarMaterias?: { activa: boolean; horas?: number }
  /** Una materia de 2 horas por semana que dicta un mismo docente a un grupo va siempre en un bloque de dos horas seguidas. */
  bloquesDeDos?: { activa: boolean }
}

export interface Colegio {
  nombre: string
  ciclo: Ciclo
  modeloAula: ModeloAula
  reglas: Reglas
}

export interface Area {
  /** Color del área en los horarios; si falta, se le asigna uno de la paleta. */
  color?: string
  id: Id
  nombre: string
  afines: Id[]
  /**
   * Media técnica: jornada extra en la otra jornada del grupo, sin máximos diarios y fuera del máximo de horas por semana
   * (30 en bachillerato). Sin marcar, lo es un área llamada «Media técnica…».
   */
  mediaTecnica?: boolean
}

export interface Grupo {
  id: Id
  grado: number
  numero: number
  jornada: Jornada
  ciclo?: Ciclo
  aulaId?: Id
}

export interface Docente {
  id: Id
  nombre: string
  areaId: Id
  nivel: Nivel
  /** 'ambas': dicta en la mañana y en la tarde (horario intermedio), incluso el mismo día. */
  jornada: Jornada | 'ambas'
  cargaSemanal: number
  /** Horas por semana adicionales a la carga. La regla de 22 o 25 horas se mantiene para quien no las tiene. */
  horasExtra?: number
  rolPrimaria?: 'titular' | 'especialista'
  direccionGrupoId?: Id
  /** Claves "dia-franja" en las que no puede dictar; en un docente de dos jornadas, las de la tarde son "dia-franja-t". */
  noDisponible: string[]
  /** Aula fija, para los modelos de aula por docente y mixto. */
  aulaId?: Id
}

export interface Aula {
  id: Id
  nombre: string
  capacidad?: number
}

/** `horas` se cuenta por ciclo del grupo. */
export interface Asignacion {
  id: Id
  docenteId: Id
  grupoId: Id
  areaId: Id
  horas: number
  /** Jornada en que se dicta, si no es la del grupo (contrajornada, con docentes de horario intermedio). */
  jornada?: Jornada
}

export interface Clase {
  id: Id
  asignacionId: Id
  dia: number
  franja: number
  aulaId?: Id
  fijada: boolean
}

export interface AjusteDia {
  fecha: string
  diaCiclo: number
  ausencias: { docenteId: Id; franjas: number[] }[]
  reemplazos: { claseId: Id; docenteId: Id }[]
  movimientos: { claseId: Id; franja: number }[]
  gruposAusentes: Id[]
}

/** Otra versión del horario del colegio, guardada para comparar o volver a ella. */
export interface Borrador {
  id: Id
  nombre: string
  /** Cuándo se guardó (fecha y hora ISO). */
  guardado: string
  /** Copia completa de esa versión: reglas, áreas, grupos, docentes, aulas, asignación y horario. */
  estado: Estado
}

/** 1: el descanso después de la franja 2; 2: el que va después de la franja 4. */
export type Descanso = 1 | 2

/** Un lugar del colegio que algún docente acompaña durante los descansos. */
export interface Zona {
  id: Id
  nombre: string
  /** Docentes que se necesitan en cada turno. */
  personas: number
  descansos: Descanso[]
  jornada: Jornada
  /** Zona difícil: quien la cuida un día no la repite el día anterior ni el siguiente. */
  algida?: boolean
  /** Pareja fija: solo estos dos docentes la cuidan durante el ciclo (se turnan, o van juntos si la zona pide dos). '' = aún sin elegir. */
  pareja?: [Id, Id]
}

/** Quién acompaña una zona en un descanso de un día del ciclo. */
export interface Turno {
  zonaId: Id
  dia: number
  descanso: Descanso
  docenteIds: Id[]
}

export interface Estado {
  version: 1
  colegio: Colegio
  areas: Area[]
  /** grado → área → horas por semana */
  intensidad: Record<number, Record<Id, number>>
  grupos: Grupo[]
  docentes: Docente[]
  aulas: Aula[]
  asignaciones: Asignacion[]
  clases: Clase[]
  ajustes: AjusteDia[]
  /** Nombre de la versión en uso. */
  nombreHorario?: string
  /** Las demás versiones del horario de este colegio. */
  borradores?: Borrador[]
  ultimoRespaldo?: string
  /** Zonas de acompañamiento en los descansos y sus turnos. */
  acompanamiento?: { zonas: Zona[]; turnos: Turno[] }
  /** Marca de la última vez que una pestaña guardó estos datos en el navegador (para reconocer ecos entre pestañas). */
  guardadoEn?: number
}

/** Una clase en un día concreto del horario. Un grupo de ciclo 5 en un horario de 10 días produce dos. */
export interface Sesion {
  claseId: Id
  asignacionId: Id
  docenteId: Id
  grupoId: Id
  areaId: Id
  aulaId?: Id
  /** La de la materia si se eligió, si no la del grupo. */
  jornada: Jornada
  dia: number
  franja: number
  fijada: boolean
}
