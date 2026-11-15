# Diseño: aplicación de horarios escolares (versión local)

Fecha: 2026-11-10. Basado en "Especificación: aplicación de horarios escolares".

## Para qué

Coordinación arma hoy el horario del colegio a mano. La app lo genera completo (docente, grupo y aula) a partir de la asignación académica que define rectoría, deja ajustarlo a mano y resuelve reemplazos por incapacidad durante el año sin tocar el horario base.

## Metas, fuera de alcance y lo que sería un fracaso

**Metas**

- Cumplir todo lo que pide la especificación y pasar sus 12 casos de prueba.
- Abrirse con doble clic en Chrome, sin instalar ni encender nada.
- Todos los datos (docentes, grupos, áreas, aulas, asignación, reglas) se agregan, editan y borran desde la app.
- Interfaz en español de Colombia, con el vocabulario del glosario.

**Fuera de alcance en esta etapa**

- Cuentas de usuario y acceso en línea. "Cada docente ve únicamente el suyo" se cumple entregándole su horario impreso, en PDF o en Excel.
- Varias sedes, bloques dobles, salas compartidas y docente de apoyo (la especificación ya los excluye).
- Leer automáticamente PDF o fotos. Los datos reales se digitan en la app, o Claude los transcribe a un archivo de respaldo que la app importa.

**Sería un fracaso si**

- La app relaja una regla sin que el usuario lo decida.
- La app impide guardar un cambio manual.
- Un reemplazo o una reorganización modifica el horario base.
- Se pierden los datos sin que exista un respaldo recuperable.

## Caminos considerados

| Camino | Ventaja | Costo | Decisión |
|---|---|---|---|
| A. App web en un solo archivo, datos en el navegador | Nada que instalar ni arrancar. El mismo código sirve luego en línea o empaquetado. | Los datos viven en un solo navegador; se mitiga con respaldo en archivo. | **Elegido** (decisión de Claude; la usuaria delegó lo técnico) |
| B. App de escritorio instalable | Ícono propio en el Mac | Instalación y permisos de Apple, sin beneficio con un solo computador | Descartado por ahora |
| C. Servidor local con base de datos | Listo para cuentas de usuario | Hay que arrancar un programa antes de usarla | Queda para la etapa en línea |

Para generar el horario se consideró un motor externo de optimización, que exigiría servidor. Se eligió un generador propio dentro de la app: a escala de un colegio (decenas de docentes, cientos de clases) resuelve en segundos.

## Decisiones técnicas (de Claude)

- TypeScript, React y Vite. La construcción produce un solo archivo `Horarios.html`.
- Toda la lógica del colegio (validación, generador, cruces, reemplazos) vive en módulos sin interfaz, con pruebas automáticas. La interfaz solo los llama. Así la etapa en línea cambia el guardado y agrega cuentas sin rehacer la lógica.
- Guardado automático en el navegador. Botones "Guardar respaldo" y "Abrir respaldo" (archivo `.json`). La app recuerda cuándo fue el último respaldo y lo sugiere si hay cambios sin respaldar.
- PDF: se usa la impresión del navegador ("Guardar como PDF") con hojas diseñadas para imprimir. Excel: archivo `.xlsx` generado en la app.
- Node se instala en la carpeta del usuario, sin contraseña de administrador.

## Datos

| Dato | Campos |
|---|---|
| Colegio | nombre, ciclo por defecto (5 o 10 días), mínimo de horas en el área de nombramiento (12), modelo de aula, reglas configurables |
| Área | nombre, áreas afines |
| Intensidad horaria | horas por semana de cada área en cada grado (regla 7 de la especificación: la app comprueba que cada grupo reciba exactamente esas horas) |
| Grupo | grado, número (7-1), jornada, ciclo (hereda el del colegio, se puede cambiar), aula propia |
| Docente | nombre, área de nombramiento, nivel, jornada, carga semanal (22 o 25, editable), rol en primaria (titular o especialista), dirección de grupo, disponibilidad, aula fija |
| Aula | nombre, capacidad opcional |
| Asignación | docente, grupo, área, horas por ciclo del grupo |
| Clase | una hora de una asignación, con día, franja, aula y si está fijada |
| Ajuste del día | fecha, día del ciclo, ausencias, reemplazos, clases movidas, grupos que no asisten |

**Ciclos distintos en el mismo colegio.** Si algún grupo usa ciclo de 10 días, el horario se arma sobre 10 días. Un grupo con ciclo de 5 días repite su semana en los días 6 a 10. La carga de cada docente se comprueba sobre el ciclo completo: 22 horas semanales son 44 en 10 días.

**Intensidad horaria en ciclo de 10 días.** La tabla se llena en horas por semana y acepta medias horas: 1,5 horas por semana son 3 horas en el ciclo de 10 días.

**Docente titular de primaria.** El mínimo de horas en el área de nombramiento no se le revisa; solo aplica a especialistas y a bachillerato. *Confirmado por la docente.*

## Pantallas

1. **Colegio.** Nombre, ciclo, jornadas, modelo de aula y reglas configurables con su valor.
2. **Áreas e intensidad horaria.** Lista de áreas con sus afines y tabla de horas de cada área por grado. Trae una precarga editable.
3. **Grupos, Docentes y Aulas.** Listas con agregar, editar y borrar. La disponibilidad del docente es una cuadrícula de días por franjas donde se marcan las franjas bloqueadas, con atajos "entra desde la franja…" y "sale después de la franja…".
4. **Asignación académica.** Por docente: sus áreas, grupos y horas, con la carga sumada frente a la asignada. Avisos en la misma pantalla y sugerencias para completar la carga.
5. **Horario.** Botón "Generar horario", las cuatro vistas (general, por docente, por grupo, por aula), edición manual, lista de cruces pendientes, imprimir y exportar a Excel. Un selector de fecha muestra el día con sus ajustes por incapacidad.
6. **Incapacidades.** Solo se habilita cuando ya existe un horario generado; se usa el día en que se presenta la ausencia. Registro de ausencias, opciones de reemplazo o reorganización, y registro de horas cubiertas.

La primera vez la app abre con un colegio de ejemplo, para ver todo funcionando, y un botón "Empezar con mi colegio" que lo borra.

## Validación de la asignación

La app avisa, sin impedir guardar:

- Carga distinta a la asignada.
- Menos del mínimo de horas en el área de nombramiento.
- Horas en un área que no es la de nombramiento ni afín.
- Horas en área afín cuando aún quedan horas sin asignar en el área propia.
- Docente de un nivel dictando en el otro (se marca como excepción, no como error).
- Grupo que recibe más o menos horas de un área que las de la intensidad horaria.

**Ayuda para completar la carga.** Para un docente con horas faltantes, la app lista horas aún sin docente, en este orden: su área en grupos donde ya dicta, su área en su dirección de grupo, su área en otros grupos de su nivel, y luego lo mismo con áreas afines. Se agregan con un clic.

## Generador

- Trabaja por jornada. Coloca cada clase en un día y una franja, y le pone el aula que indica el modelo: la del docente si tiene aula fija, si no la del grupo.
- Para el generador, todas las reglas activas son obligatorias: sin cruces de docente, grupo ni aula, disponibilidad, máximos por día y hora libre.
- Las clases fijadas no se mueven.
- Entre horarios válidos prefiere repartir cada materia en días distintos.
- Método: coloca primero las clases más difíciles; cuando una no cabe, saca las que le estorban y las reubica, hasta que todas queden o se acabe el tiempo (unos segundos).

**Regla de hora libre.** Si un docente tiene 6 clases un día, el día anterior o el siguiente del ciclo debe tener al menos una franja sin clase. El primer día solo mira el siguiente y el último solo el anterior. El día 10 y el día 1 no son contiguos.

## Cuando no hay solución

1. Antes de buscar, la app revisa imposibles evidentes y los nombra: docente con más horas que franjas disponibles, grupo con más horas que franjas del ciclo, aula con más clases que franjas, materia cuyas horas no caben con el máximo diario.
2. Si la búsqueda no logra ubicar todo, muestra qué clases quedaron por fuera y qué regla o recurso bloqueó cada una.
3. Propone soluciones de menor a mayor impacto: reasignar horas a otro docente del área o afín con cupo, relajar una regla configurable, cambiar una disponibilidad, agregar un aula o cambiar el modelo. La app prueba cada propuesta por dentro y marca las que sí resuelven.
4. El usuario elige una, la app la aplica y recalcula. Nunca aplica una por su cuenta.

## Edición manual y cruces

- Mover una clase: arrastrarla, o seleccionarla y elegir la celda destino con teclado o clic. Si el destino está ocupado en esa vista, las dos clases se intercambian.
- En una clase se puede cambiar el aula y fijarla o soltarla.
- Todo cambio se guarda. La lista de cruces pendientes se recalcula tras cada cambio y nombra la causa: docente en dos clases, grupo con dos clases, aula repetida, carga distinta a la asignada, disponibilidad violada o regla configurable rota. Cada cruce lleva a la clase afectada.

## Incapacidades y reemplazos

- Se registra docente, fecha, día del ciclo y franjas. Con ciclo de 5 días el día del ciclo sale del día de la semana; con ciclo de 10 la app lo propone y el coordinador lo confirma.
- La app lista las clases sin docente y, para cada una, los reemplazos posibles: misma jornada, libres y disponibles en esa franja, con al menos 2 franjas libres ese día y al menos 1 el día anterior o el siguiente. Orden: misma área, luego docentes que ya dictan en el grupo, luego quien menos horas ha cubierto.
- Para las horas que queden sin cubrir, propone reorganizar el día del grupo: mueve clases de docentes que sí asisten para que los huecos queden al inicio (llega tarde) o al final (sale temprano), sin cruces y respetando disponibilidad.
- En primaria agrega la opción "falta todo el grupo".
- Cada opción muestra su impacto: horas cubiertas, grupos que llegan tarde o salen temprano, docentes que cambian de clase. El coordinador confirma.
- El resultado se guarda como ajuste de esa fecha, se ve en las cuatro vistas al elegir la fecha, y suma al registro de horas cubiertas por docente.

## Salidas

- Cuatro vistas con docente, grupo y aula en cada franja, y los descansos marcados después de la franja 2 y de la 4.
- Imprimir: una vista, o todas las de un tipo (todos los docentes, uno por hoja).
- Excel: un libro con el horario general y una hoja por docente, grupo o aula, según se elija.

## Pruebas

- Cada uno de los 12 casos de la especificación es una prueba automática sobre la lógica.
- Pruebas adicionales para el generador (un colegio de ejemplo se resuelve sin cruces), la validación, los reemplazos y la reorganización.
- Revisión visual de cada pantalla en Chrome.

## Lo que queda a criterio de quien construye

Nombres internos, estructura de archivos, detalle del algoritmo de búsqueda, librería para Excel y estilo visual (se define con las guías de diseño al construir la interfaz).
