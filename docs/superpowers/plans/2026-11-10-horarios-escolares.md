# Horarios escolares — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app web local, en un solo archivo `Horarios.html`, que valida la asignación académica, genera el horario (docente, grupo, aula), permite editarlo a mano y resuelve reemplazos por incapacidad.

**Architecture:** Toda la lógica del colegio vive en `src/dominio/` como funciones puras sobre un único objeto `Estado`, con pruebas. `src/datos/` guarda y exporta. `src/ui/` (React) solo llama al dominio. El estado se guarda en `localStorage` y en respaldos `.json`.

**Tech Stack:** Node 26 (en `.tools/node`), Vite, React 19, TypeScript, Vitest, vite-plugin-singlefile, write-excel-file.

**Spec:** `docs/superpowers/specs/2026-11-10-horarios-escolares-design.md` y el PDF "Especificación: aplicación de horarios escolares".

## Global Constraints

- Todo comando usa `export PATH="$PWD/.tools/node/bin:$PATH"` desde la raíz del proyecto. No se toca `~/.zshrc`.
- 6 franjas por día; descansos fijos después de la franja 2 y de la 4.
- Ciclo de 5 o 10 días. Carga: 22 (bachillerato) y 25 (primaria) por semana; 44 y 50 en 10 días.
- Mínimo en el área de nombramiento: 12 por semana, editable. No se revisa a titulares de primaria.
- Valores por defecto: máximo 2 horas de la misma materia por grupo y día; máximo 2 horas con el mismo docente por grupo y día (solo bachillerato; en primaria nunca al titular y a especialistas según un interruptor); hora libre activa.
- El día 10 y el día 1 no son contiguos.
- La app nunca relaja una regla sola, nunca impide guardar un cambio manual, y los ajustes por incapacidad nunca cambian `estado.clases`.
- Textos de la interfaz en español de Colombia con el vocabulario del glosario. Identificadores de código en español.
- Sin dependencias nuevas fuera de las listadas, salvo herramientas de prueba.
- Cada tarea termina con `npm test` en verde y un commit.

## Review Focus

1. Borrar un docente, grupo, área o aula que otras cosas usan: debe pedir confirmación y borrar en cascada sin dejar referencias rotas. Prueba en Tarea 3 (`edicion.test.ts`).
2. Abrir un respaldo dañado o de otro programa: se rechaza con mensaje claro y se conservan los datos actuales. Prueba en Tarea 7 (`almacen.test.ts`).
3. Cambiar la asignación después de generar: las clases sobrantes se quitan y las faltantes aparecen como cruce "sin ubicar". Prueba en Tarea 3 (`sincronizarClases`).
4. Cambiar el ciclo de 10 a 5 con clases y disponibilidad en los días 6 a 10: se descartan sin error. Prueba en Tarea 3.
5. Generar con datos vacíos o incompletos (sin docentes, grupo sin aula, asignación en cero): termina rápido con un mensaje, sin colgarse. Prueba en Tarea 4.

---

## Estructura de archivos

```
index.html  package.json  vite.config.ts  tsconfig.json
src/dominio/tipos.ts          tipos de datos
src/dominio/tiempo.ts         días, franjas, ciclos, sesiones
src/dominio/asignacion.ts     validación de la asignación y sugerencias
src/dominio/cruces.ts         detector único de cruces y reglas
src/dominio/edicion.ts        mover, fijar, borrar en cascada, sincronizar
src/dominio/generador.ts      generador automático
src/dominio/diagnostico.ts    bloqueos y propuestas cuando no hay solución
src/dominio/reemplazos.ts     ausencias, reemplazos, reorganización del día
src/dominio/vistas.ts         tablas de las cuatro vistas (pantalla, impresión, Excel)
src/dominio/ejemplo.ts        colegio de ejemplo y precargas
src/dominio/casos-especificacion.test.ts   los 12 casos del PDF
src/datos/almacen.ts          localStorage y respaldos
src/datos/excel.ts            exportación .xlsx
src/ui/…                      App, estado, pantallas, estilos, impresión
```

---

### Task 1: Proyecto, tipos y tiempo

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/dominio/tipos.ts`, `src/dominio/tiempo.ts`. Test: `src/dominio/tiempo.test.ts`.

**Interfaces — Produces:**

```ts
// tipos.ts
export type Id = string
export type Nivel = 'primaria' | 'bachillerato'
export type Jornada = 'manana' | 'tarde'
export type Ciclo = 5 | 10
export type ModeloAula = 'grupo' | 'docente' | 'mixto'
export interface Reglas {
  minimoAreaNombramiento: number
  maxMateriaDia: { activa: boolean; valor: number }
  maxDocenteDia: { activa: boolean; valor: number; aplicaEspecialistas: boolean }
  horaLibre: { activa: boolean }
}
export interface Colegio { nombre: string; ciclo: Ciclo; modeloAula: ModeloAula; reglas: Reglas }
export interface Area { id: Id; nombre: string; afines: Id[] }
export interface Grupo { id: Id; grado: number; numero: number; jornada: Jornada; ciclo?: Ciclo; aulaId?: Id }
export interface Docente {
  id: Id; nombre: string; areaId: Id; nivel: Nivel; jornada: Jornada; cargaSemanal: number
  rolPrimaria?: 'titular' | 'especialista'; direccionGrupoId?: Id
  noDisponible: string[]            // claves "dia-franja"
  aulaId?: Id                       // aula fija (modelos docente y mixto)
}
export interface Aula { id: Id; nombre: string; capacidad?: number }
export interface Asignacion { id: Id; docenteId: Id; grupoId: Id; areaId: Id; horas: number } // por ciclo del grupo
export interface Clase { id: Id; asignacionId: Id; dia: number; franja: number; aulaId?: Id; fijada: boolean }
export interface AjusteDia {
  fecha: string; diaCiclo: number
  ausencias: { docenteId: Id; franjas: number[] }[]
  reemplazos: { claseId: Id; docenteId: Id }[]
  movimientos: { claseId: Id; franja: number }[]
  gruposAusentes: Id[]
}
export interface Estado {
  version: 1; colegio: Colegio; areas: Area[]
  intensidad: Record<number, Record<Id, number>>   // grado → área → horas por semana
  grupos: Grupo[]; docentes: Docente[]; aulas: Aula[]
  asignaciones: Asignacion[]; clases: Clase[]; ajustes: AjusteDia[]; ultimoRespaldo?: string
}
// Una sesión es una clase en un día concreto del horario (un grupo de ciclo 5 en horario de 10 produce dos).
export interface Sesion { claseId: Id; asignacionId: Id; docenteId: Id; grupoId: Id; areaId: Id; aulaId?: Id; dia: number; franja: number; fijada: boolean }

// tiempo.ts
export const FRANJAS = 6
export const DESCANSOS_DESPUES_DE = [2, 4]
export function clave(dia: number, franja: number): string
export function nivelDeGrado(grado: number): Nivel            // 1–5 primaria, 6–11 bachillerato
export function nombreGrupo(g: Grupo): string                 // "7-1"
export function cicloDeGrupo(e: Estado, g: Grupo): Ciclo
export function diasHorario(e: Estado): Ciclo                 // 10 si algún grupo usa 10
export function diasOcupados(dia: number, cicloGrupo: Ciclo, dias: Ciclo): number[]  // [3] o [3, 8]
export function cargaEnCiclo(d: Docente, dias: Ciclo): number // cargaSemanal × dias/5
export function diasVecinos(dia: number, dias: Ciclo): number[] // sin dar la vuelta
export function nuevoId(): Id
```

- [ ] **Step 1:** Scaffold: `npm init`, instalar `vite react react-dom typescript vitest @vitejs/plugin-react vite-plugin-singlefile @types/react @types/react-dom`. Scripts: `dev`, `build` (tsc --noEmit && vite build), `test` (vitest run). `vite.config.ts` con `viteSingleFile()` y prueba en entorno `node`.
- [ ] **Step 2:** Escribir `tiempo.test.ts`: `diasOcupados(3,5,10)` → `[3,8]`; `diasOcupados(3,10,10)` → `[3]`; `diasVecinos(1,5)` → `[2]`; `diasVecinos(10,10)` → `[9]`; `diasVecinos(5,10)` → `[4,6]`; `cargaEnCiclo({cargaSemanal:22},10)` → `44`; `cargaEnCiclo({cargaSemanal:25},10)` → `50`; `diasHorario` es 10 cuando el colegio es de 5 y un grupo tiene `ciclo: 10`.
- [ ] **Step 3:** Ver que falla; implementar `tipos.ts` y `tiempo.ts`; ver que pasa.
- [ ] **Step 4:** `npm run build` produce `dist/index.html` único. Commit.

### Task 2: Colegio de ejemplo y validación de la asignación

**Files:** Create `src/dominio/ejemplo.ts`, `src/dominio/asignacion.ts`. Test: `src/dominio/asignacion.test.ts`.

**Interfaces — Produces:**

```ts
// ejemplo.ts
export function reglasPorDefecto(): Reglas
export function areasIniciales(): Area[]                       // áreas obligatorias de la Ley 115 con afines iniciales
export function intensidadInicial(areas: Area[]): Estado['intensidad']  // suma 25 en grados 1–5 y 30 en 6–11
export function estadoVacio(): Estado                          // con precargas, sin grupos ni docentes
export function colegioEjemplo(): Estado                       // asignación completa y válida, sin clases
// asignacion.ts
export type TipoAviso = 'carga' | 'minimoArea' | 'areaNoAfin' | 'afinConHorasPropias' | 'nivel' | 'intensidad' | 'jornada'
export interface Aviso { tipo: TipoAviso; gravedad: 'error' | 'excepcion'; mensaje: string; docenteId?: Id; grupoId?: Id; areaId?: Id }
export function horasRequeridas(e: Estado, g: Grupo, areaId: Id): number   // intensidad × cicloGrupo/5
export function horasDocente(e: Estado, docenteId: Id): { total: number; enArea: number; enAfines: number; otras: number } // en días del horario
export function horasSinAsignar(e: Estado): { grupoId: Id; areaId: Id; horas: number }[]
export function validarAsignacion(e: Estado): Aviso[]
export interface Sugerencia { grupoId: Id; areaId: Id; horas: number; motivo: 'areaGrupoPropio' | 'areaDireccion' | 'areaNivel' | 'afinGrupoPropio' | 'afinDireccion' | 'afinNivel' }
export function sugerirParaDocente(e: Estado, docenteId: Id): Sugerencia[] // en ese orden, sin pasar la carga faltante
```

El colegio de ejemplo: jornada de la mañana, ciclo de 5, modelo de aula por grupo; bachillerato con 6 grupos (6-1, 7-1, 8-1, 9-1, 10-1, 11-1) y primaria con 5 grupos (1-1 a 5-1), cada uno con titular; docentes de bachillerato con 22 horas exactas y al menos 12 en su área; al menos un docente con disponibilidad restringida (entra desde la franja 3). Debe pasar `validarAsignacion` sin errores.

- [ ] **Step 1:** Pruebas: `colegioEjemplo()` no produce avisos de gravedad `error`; la intensidad inicial suma 25 y 30; docente con 21 horas → aviso `carga`; docente con 8 en su área y 14 en afín → `minimoArea`; con 12 y 10 → ninguno; titular de primaria con 0 horas "de su área" → sin `minimoArea`; área que no es propia ni afín → `areaNoAfin`; horas en afín mientras `horasSinAsignar` tiene horas de su área → `afinConHorasPropias`; docente de primaria en grupo de bachillerato → `nivel` con gravedad `excepcion`; grupo con 4 de 5 horas de Matemáticas → `intensidad`; docente de la mañana en grupo de la tarde → `jornada`; `sugerirParaDocente` ordena área propia en grupo propio antes que afín y no supera la carga faltante.
- [ ] **Step 2:** Ver que falla; implementar; ver que pasa. Commit.

### Task 3: Cruces, aulas y edición

**Files:** Create `src/dominio/cruces.ts`, `src/dominio/edicion.ts`. Test: `src/dominio/cruces.test.ts`, `src/dominio/edicion.test.ts`.

**Interfaces — Produces:**

```ts
// cruces.ts
export function aulaDeClase(e: Estado, c: Clase): Id | undefined  // c.aulaId ?? aula fija del docente (modelos docente/mixto) ?? aula del grupo
export function sesiones(e: Estado, clases?: Clase[]): Sesion[]
export type TipoCruce = 'docente' | 'grupo' | 'aula' | 'carga' | 'disponibilidad' | 'maxMateria' | 'maxDocente' | 'horaLibre' | 'sinUbicar' | 'sinAula'
export interface Cruce { tipo: TipoCruce; mensaje: string; claseIds: Id[]; docenteId?: Id; grupoId?: Id; aulaId?: Id; dia?: number; franja?: number }
export function aplicaMaxDocente(e: Estado, docente: Docente, grupo: Grupo): boolean
export function detectarCruces(e: Estado, reglas?: Reglas): Cruce[]
export function avisosAulas(e: Estado): string[]   // menos aulas que grupos, grupos o docentes sin aula según el modelo
// edicion.ts
export function moverClase(e: Estado, claseId: Id, dia: number, franja: number): Estado  // intercambia si el grupo ya tiene clase ahí
export function cambiarClase(e: Estado, claseId: Id, cambios: Partial<Pick<Clase, 'aulaId' | 'fijada'>>): Estado
export function sincronizarClases(e: Estado): Estado   // quita clases huérfanas, sobrantes o fuera del ciclo; recorta noDisponible fuera del ciclo
export function eliminarDocente(e: Estado, id: Id): Estado
export function eliminarGrupo(e: Estado, id: Id): Estado
export function eliminarArea(e: Estado, id: Id): Estado
export function eliminarAula(e: Estado, id: Id): Estado
```

`sinUbicar`: una asignación con menos clases que horas. `carga`: docente cuyas sesiones no suman `cargaEnCiclo`. `horaLibre`: docente con 6 sesiones un día y ningún día vecino con menos de 6.

- [ ] **Step 1:** Pruebas de cruces: dos clases del mismo docente en la misma franja → `docente`; del mismo grupo → `grupo`; misma aula → `aula`; clase en franja de `noDisponible` → `disponibilidad`; 3 de Matemáticas el mismo día en 8-1 → `maxMateria`; con la regla inactiva → nada; 3 horas del mismo docente en un día en bachillerato → `maxDocente`; titular de primaria con 4 → nada; especialista con 3 → según `aplicaEspecialistas`; 6 clases el día 2 con días 1 y 3 llenos → `horaLibre`; 6 clases el día 1 y 5 el día 2 → nada; día 10 lleno y día 1 con huecos, día 9 lleno → `horaLibre`; grupo de ciclo 5 en horario de 10 genera sesiones en `dia` y `dia+5`; modelos de aula: grupo, docente y mixto devuelven el aula esperada.
- [ ] **Step 2:** Pruebas de edición: mover a celda vacía; mover a celda ocupada intercambia; mover creando choque de docente guarda y `detectarCruces` lo reporta; `eliminarDocente` quita sus asignaciones, clases, ausencias y reemplazos; `eliminarGrupo`, `eliminarArea` (también de `afines` e `intensidad`) y `eliminarAula` no dejan referencias; bajar horas de una asignación y `sincronizarClases` quita las sobrantes (primero las no fijadas); pasar el colegio de 10 a 5 quita clases y `noDisponible` de los días 6–10.
- [ ] **Step 3:** Ver que fallan; implementar; ver que pasan. Commit.

### Task 4: Generador

**Files:** Create `src/dominio/generador.ts`. Test: `src/dominio/generador.test.ts`.

**Interfaces — Consumes:** `sesiones`, `detectarCruces`, `aulaDeClase`, `aplicaMaxDocente`. **Produces:**

```ts
export interface OpcionesGenerar { tiempoMs?: number; semilla?: number }   // 4000 ms por defecto
export interface SinUbicar { asignacionId: Id; horas: number; causas: Partial<Record<TipoCruce, number>> }
export interface ResultadoGenerar { clases: Clase[]; sinUbicar: SinUbicar[]; completo: boolean }
export function generarHorario(e: Estado, opciones?: OpcionesGenerar): ResultadoGenerar
```

Algoritmo: una unidad por hora de cada asignación; las clases fijadas se conservan. Se toma la unidad sin ubicar con menos celdas posibles; para cada celda se calcula qué unidades habría que sacar (choques de docente, grupo o aula en todos los días ocupados, exceso de máximos diarios, hora libre) y se descarta la celda si choca con disponibilidad o con una clase fijada. Se elige la celda con menos expulsiones (desempate: menos horas de esa materia ese día, luego azar con semilla), se expulsan y vuelven a la cola. Lista tabú corta por unidad y celda. Se guarda la mejor solución; termina cuando no queda nada por ubicar o se acaba el tiempo. `causas` cuenta, para cada unidad no ubicada, qué bloqueó sus celdas.

- [ ] **Step 1:** Pruebas: `colegioEjemplo()` → `completo`, y `detectarCruces` del estado con esas clases es `[]`; el docente que entra desde la franja 3 no tiene clases en franjas 1 y 2; una clase fijada conserva día y franja; misma semilla → mismo resultado; grupo de ciclo 5 en colegio con otro grupo de ciclo 10 queda sin cruces en los 10 días; estado sin docentes ni asignaciones → `completo` con `clases: []` en menos de 100 ms; asignación imposible (docente con 22 horas y solo 10 franjas disponibles) → `completo: false`, `sinUbicar` no vacío, termina dentro del tiempo.
- [ ] **Step 2:** Ver que falla; implementar; ver que pasa. Commit.

### Task 5: Diagnóstico y propuestas

**Files:** Create `src/dominio/diagnostico.ts`. Test: `src/dominio/diagnostico.test.ts`.

**Interfaces — Produces:**

```ts
export interface Bloqueo { tipo: 'docenteSinFranjas' | 'grupoSinFranjas' | 'aulaSinFranjas' | 'materiaNoCabe' | 'docenteGrupoNoCabe' | 'busqueda'; mensaje: string; docenteId?: Id; grupoId?: Id; aulaId?: Id; areaId?: Id }
export interface Propuesta { tipo: 'reasignar' | 'relajarRegla' | 'disponibilidad' | 'aula'; impacto: 1 | 2 | 3 | 4; descripcion: string; resuelve: boolean; aplicar: (e: Estado) => Estado }
export function prechequear(e: Estado): Bloqueo[]
export function diagnosticar(e: Estado, r: ResultadoGenerar): { bloqueos: Bloqueo[]; propuestas: Propuesta[] }
```

Impacto: 1 reasignar, 2 relajar regla, 3 disponibilidad, 4 aula. Máximo 8 propuestas; `resuelve` se comprueba con `generarHorario(aplicar(e), { tiempoMs: 800 })`. Orden: impacto ascendente y, dentro de cada impacto, primero las que resuelven.

- [ ] **Step 1:** Pruebas: docente con 22 horas y 10 franjas disponibles → bloqueo `docenteSinFranjas` y propuesta `disponibilidad` con `resuelve: true`; grupo con 12 horas de un área en ciclo de 5 y máximo 2 por día → `materiaNoCabe` y propuesta `relajarRegla`; dos grupos con la misma aula y 30 horas cada uno → `aulaSinFranjas` y propuesta `aula`; `diagnosticar` no cambia `e.colegio.reglas`; las propuestas salen ordenadas por impacto.
- [ ] **Step 2:** Ver que falla; implementar; ver que pasa. Commit.

### Task 6: Incapacidades y reemplazos

**Files:** Create `src/dominio/reemplazos.ts`. Test: `src/dominio/reemplazos.test.ts`.

**Interfaces — Produces:**

```ts
export type EstadoSesion = 'normal' | 'reemplazo' | 'movida' | 'sinDocente' | 'grupoAusente'
export interface SesionDia extends Sesion { docenteOriginalId: Id; situacion: EstadoSesion }
export function diaCicloDeFecha(e: Estado, fecha: string): number | undefined  // lunes=1…viernes=5; ciclo 10: continúa desde el último ajuste si puede
export function ajusteDe(e: Estado, fecha: string): AjusteDia | undefined
export function sesionesDelDia(e: Estado, ajuste: AjusteDia): SesionDia[]
export function clasesSinDocente(e: Estado, ajuste: AjusteDia): SesionDia[]
export interface Candidato { docenteId: Id; motivo: 'area' | 'grupo' | 'otro'; horasCubiertas: number }
export function candidatosReemplazo(e: Estado, ajuste: AjusteDia, claseId: Id): Candidato[]
export interface OpcionReorganizar { tipo: 'llegaTarde' | 'saleTemprano'; grupoId: Id; movimientos: { claseId: Id; franja: number }[]; docentesQueCambian: Id[]; horasSinClase: number }
export function opcionesReorganizar(e: Estado, ajuste: AjusteDia, grupoId: Id): OpcionReorganizar[]
export function puedeFaltarGrupo(e: Estado, grupoId: Id): boolean      // solo primaria
export interface Impacto { horasCubiertas: number; horasSinCubrir: number; gruposLleganTarde: Id[]; gruposSalenTemprano: Id[]; gruposAusentes: Id[]; docentesQueCambian: Id[] }
export function impactoAjuste(e: Estado, ajuste: AjusteDia): Impacto
export function guardarAjuste(e: Estado, ajuste: AjusteDia): Estado     // reemplaza el de esa fecha; no toca e.clases
export function registroHorasCubiertas(e: Estado): { docenteId: Id; horas: number }[]
```

Candidato válido: misma jornada, no ausente, sin clase y disponible en esa franja (contando reemplazos y movimientos ya puestos ese día), al menos 2 franjas sin clase ese día antes de cubrir, y al menos 1 franja sin clase en el día anterior o el siguiente del horario base. Reorganizar: probar todas las permutaciones de las clases cubiertas del grupo sobre las últimas (llega tarde) o primeras (sale temprano) franjas; válida si cada docente está libre y disponible y el aula está libre; se queda con la de menos movimientos.

- [ ] **Step 1:** Pruebas: ausencia en franjas 1, 3 y 5 → `clasesSinDocente` devuelve exactamente esas clases; todo candidato tiene ≥ 2 franjas libres ese día y ≥ 1 en un día vecino; un docente con 5 clases ese día no es candidato; un docente no disponible en esa franja no es candidato; orden misma área → mismo grupo → menos horas cubiertas; ausencia en franjas 1 y 2 sin candidatos → `opcionesReorganizar` incluye `llegaTarde` sin cruces; ausencia en franjas 5 y 6 → `saleTemprano` sin movimientos; titular de primaria ausente todo el día → `puedeFaltarGrupo` verdadero y, al marcar el grupo, sus sesiones quedan `grupoAusente`; bachillerato → falso; `guardarAjuste` deja `e.clases` idéntico; `registroHorasCubiertas` suma reemplazos de varias fechas.
- [ ] **Step 2:** Ver que falla; implementar; ver que pasa. Commit.

### Task 7: Vistas, guardado, Excel y los 12 casos

**Files:** Create `src/dominio/vistas.ts`, `src/datos/almacen.ts`, `src/datos/excel.ts`, `src/dominio/casos-especificacion.test.ts`. Test: `src/dominio/vistas.test.ts`, `src/datos/almacen.test.ts`.

**Interfaces — Produces:**

```ts
// vistas.ts
export type TipoVista = 'general' | 'docente' | 'grupo' | 'aula'
export interface Celda { claseId?: Id; lineas: string[]; situacion?: EstadoSesion; fijada?: boolean }
export interface Tabla { titulo: string; subtitulo?: string; dias: number[]; celdas: Celda[][][] }  // [dia][franja] → celdas (varias si hay cruce)
export function nombreDia(dia: number, dias: Ciclo): string     // "Lunes"… en ciclo 5; "Día 1"… en ciclo 10
export function tablaDe(e: Estado, tipo: Exclude<TipoVista, 'general'>, id: Id, ajuste?: AjusteDia): Tabla
export function tablaGeneral(e: Estado, ajuste?: AjusteDia): { docentes: Docente[]; dias: number[]; celdas: Celda[][][][] } // [docente][dia][franja]
// almacen.ts
export function cargarEstado(): Estado                 // sin datos guardados → colegioEjemplo()
export function guardarEstado(e: Estado): boolean      // false si el navegador no deja guardar
export function exportarRespaldo(e: Estado): string
export function importarRespaldo(texto: string): Estado // lanza Error con mensaje en español si no es un respaldo válido
// excel.ts
export function hojasExcel(e: Estado, tipo: TipoVista): { nombre: string; filas: string[][] }[]
export async function descargarExcel(e: Estado, tipo: TipoVista): Promise<void>
```

- [ ] **Step 1:** Pruebas de vistas: en la vista por grupo cada celda muestra área, docente y aula; por docente: área, grupo y aula; por aula: grupo y docente; con un ajuste, la sesión reemplazada muestra al reemplazo y `situacion: 'reemplazo'`; dos clases en la misma celda aparecen las dos.
- [ ] **Step 2:** Pruebas de almacén: exportar e importar devuelve un estado igual; texto que no es JSON, JSON sin `version` y JSON con `docentes` que no es lista lanzan error; `hojasExcel(e,'docente')` da una hoja por docente con 6 filas de franjas más encabezado y filas de descanso.
- [ ] **Step 3:** `casos-especificacion.test.ts`: un `it` por cada uno de los 12 casos del PDF, con su texto como nombre, usando las funciones de las tareas 2 a 6.
- [ ] **Step 4:** Ver que fallan; implementar (revisar la documentación de `write-excel-file` antes de usarla); ver que pasan. Commit.

### Task 8: Interfaz base y pantallas de datos

**Files:** Create `src/ui/App.tsx`, `src/ui/estado.tsx`, `src/ui/estilos.css`, `src/ui/componentes/*`, `src/ui/pantallas/Colegio.tsx`, `Areas.tsx`, `Grupos.tsx`, `Docentes.tsx`, `Aulas.tsx`. Test: `src/ui/App.test.tsx` (jsdom).

**Interfaces — Produces:** `useEstado(): { estado: Estado; cambiar: (f: (e: Estado) => Estado) => void }`; `cambiar` aplica `sincronizarClases` y guarda.

- [ ] **Step 1:** Cargar las skills `impeccable` y `ui-ux-pro-max`; definir el sistema visual (tipografía, color, espaciado, componentes) para una herramienta de trabajo densa en datos y usada por coordinación.
- [ ] **Step 2:** Prueba de humo: `App` se monta con `colegioEjemplo()` y cada pantalla se abre sin errores.
- [ ] **Step 3:** Implementar la navegación, el estado y las cinco pantallas con agregar, editar y borrar (borrar pide confirmación y usa `eliminar*`); cuadrícula de disponibilidad con atajos "entra desde la franja…" y "sale después de la franja…"; reglas configurables; modelo de aula con `avisosAulas`; "Guardar respaldo", "Abrir respaldo" y "Empezar con mi colegio" (con confirmación).
- [ ] **Step 4:** Pruebas en verde, revisión visual en Chrome. Commit.

### Task 9: Pantalla de asignación académica

**Files:** Create `src/ui/pantallas/Asignacion.tsx`.

- [ ] **Step 1:** Por docente: filas de área, grupo y horas; carga sumada frente a la asignada; avisos de `validarAsignacion` junto al docente o grupo que los causa; sugerencias de `sugerirParaDocente` con botón para agregarlas; panel de horas sin asignar por grupo.
- [ ] **Step 2:** Prueba de humo ampliada; revisión visual. Commit.

### Task 10: Pantalla de horario

**Files:** Create `src/ui/pantallas/Horario.tsx`, `src/ui/componentes/TablaHorario.tsx`, `src/ui/impresion.css`.

- [ ] **Step 1:** "Generar horario" (pide confirmación si ya hay uno; conserva fijadas); si no es completo, muestra bloqueos y propuestas con "Aplicar y recalcular".
- [ ] **Step 2:** Cuatro vistas con selector; descansos visibles; mover con arrastre y con selección más clic o teclado; panel de clase (aula, fijar); lista de cruces pendientes que lleva a la clase.
- [ ] **Step 3:** Imprimir la vista o todas las de un tipo (una por hoja); exportar a Excel; selector de fecha que aplica el ajuste del día.
- [ ] **Step 4:** Revisión visual en Chrome, incluida la vista previa de impresión. Commit.

### Task 11: Pantalla de incapacidades

**Files:** Create `src/ui/pantallas/Incapacidades.tsx`.

- [ ] **Step 1:** Deshabilitada con explicación si no hay horario. Registro de ausencia (docente, fecha, día del ciclo, franjas o todo el día); lista de clases sin docente con sus candidatos; opciones de reorganización por grupo y "falta todo el grupo" en primaria; resumen de impacto; confirmar guarda el ajuste; lista de ajustes con borrar; registro de horas cubiertas.
- [ ] **Step 2:** Revisión visual. Commit.

### Task 12: Entrega

- [ ] **Step 1:** `npm run build` y copiar `dist/index.html` a `Horarios.html` en la raíz.
- [ ] **Step 2:** Recorrido completo en Chrome sobre `Horarios.html`: generar, mover una clase creando un cruce, registrar una ausencia, imprimir, exportar a Excel, guardar y abrir respaldo.
- [ ] **Step 3:** Análisis de calidad con ruflo (`analyze`), revisión con `ponytail-review` y corrección de lo que encuentren.
- [ ] **Step 4:** `LEEME.md` con cómo abrir la app, cómo respaldar y cómo reconstruirla. Commit final.
