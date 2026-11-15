# Horarios escolares

App para armar el horario del colegio (docente, grupo y aula), ajustarlo a mano y resolver reemplazos por incapacidad.

## Cómo abrirla

Haz doble clic en **`Horarios.html`**. Se abre en Chrome y funciona sin internet. No hay que instalar ni encender nada.

La primera vez muestra un colegio de ejemplo. Cuando quieras empezar con el tuyo, toca **«Empezar con mi colegio»** arriba.

## El orden para armar el horario

1. **Colegio.** Nombre, ciclo de 5 o 10 días, cómo se usan las aulas y las reglas (entre ellas, las clases en bloque de 2 horas). El botón «Guardar colegio» confirma que quedó guardado.
2. **Áreas e intensidad.** Las áreas del plan de estudios, sus afines y las horas por semana en cada grado. Se pueden llenar subiendo un Word o PDF (ver abajo). La media técnica no va aquí: tiene su propio apartado.
3. **Grupos, docentes y aulas.** Lo que tiene el colegio. En cada docente: sus horas extra (si tiene) y el apartado «Disponibilidad» para decir desde qué franja entra, hasta cuál se queda, qué días no viene o franjas sueltas. Un docente puede tener jornada «Mañana y tarde (horario intermedio)»: dicta a grupos de las dos jornadas, incluso el mismo día (la franja 1 de la mañana y la de la tarde son horas distintas), y su disponibilidad tiene una cuadrícula para cada jornada. En la **asignación** de un docente de horario intermedio, cada materia con su grupo se marca **en la mañana** o **en la tarde**: las de la tarde van en las franjas de la tarde aunque el grupo sea de la mañana (contrajornada), y ese grupo se ve entonces con una tabla de la mañana y otra de la tarde.
4. **Media técnica** (solo si el colegio la tiene; ver abajo).
5. **Asignación académica.** Qué horas dicta cada docente a cada grupo. «Por docente» muestra su carga, permite agregarle materias o grupos en la última fila y cambiarle el nombre («Cambiar nombre»). «Por grupo» muestra cada materia del grupo con sus docentes, si está completa, si le faltan o le sobran horas, y permite asignar ahí lo que falta. La app avisa cuando dos docentes comparten una materia en un grupo (y si sus horas suman la intensidad) y cuando un grupo pasa de 30 horas por semana en bachillerato o de 25 en primaria. También se puede importar de un Word o PDF.
6. **Horario.** «Generar horario». Luego puedes mover clases, fijarlas, imprimir, descargar el PDF y exportar a Excel.
7. **Acompañamiento.** Las zonas que se cuidan en los descansos y quién las acompaña cada día (ver abajo).
8. **Incapacidades.** El día que alguien falta se registra la ausencia y la app pregunta cómo cubrirla:
   - **Con el reemplazo que más convenga:** elige en cada hora a alguien libre, primero de la misma área, repartiendo entre quienes menos han cubierto.
   - **Ya tengo a alguien:** se elige el docente (la lista dice en cuántas de esas horas está libre) y cubre todas las que pueda.
   - **Sin reemplazo:** pregunta si se prefiere que el grupo **llegue tarde** o **salga temprano**, y corre ese día las clases de otros docentes. Si lo preferido no se puede sin cruzar a nadie, hace lo otro y lo dice.

   Para las horas que nadie puede cubrir también pregunta qué se prefiere. Debajo de cada pregunta se ve cómo queda cada grupo, y abajo está el **resumen para enviar**: uno completo para el **correo institucional** (quién falta, quién reemplaza, qué clases cambian de hora, qué grupos llegan tarde o salen temprano, descansos sin acompañar) y uno corto para el **WhatsApp de las familias** (solo qué grupos entran tarde o salen temprano). Se copian con un botón o se abren directo en el correo o en WhatsApp. «Ajustar a mano» permite cambiar clase por clase.

## Media técnica

Es opcional: en **Colegio → Media técnica** se dice si el colegio la tiene. Si la tiene, aparece «Media técnica» en el menú. Sus programas (Sistemas, Contabilidad, Agropecuaria…) van **por fuera del plan de estudios**: se dictan en la jornada contraria (en la tarde si el grupo es de la mañana) sin tocar su jornada, no cuentan en las 30 horas por semana y no tienen máximo de horas por día.

1. **Programas:** el nombre y las horas por semana en 10.° y 11.°.
2. **Qué grupos la ven:** un grupo completo puede ver un programa. Si los estudiantes de varios grupos eligen programas distintos, se arman **grupos mezclados** (por ejemplo, «11.° Sistemas» con estudiantes de 11-1 y 11-2), cada uno con su jornada y su aula y con su propio horario.
3. **Quién la dicta:** un **docente de planta** (esas horas cuentan en su carga de 22; si es de la otra jornada, pasa a «mañana y tarde») o un **instructor externo** (SENA u otra entidad), que no tiene carga ni acompaña descansos ni aparece como reemplazo. Sus días se marcan en su ficha de «Grupos, docentes y aulas».

Cada docente de media técnica atiende un solo grupo por día y, si caben, todas las horas de un grupo van el mismo día. En **Horario**, «Organizar la media técnica» la vuelve a ubicar sin mover nada más.

## Acompañamiento en descansos

En **Acompañamiento** se arman las zonas del colegio (patio, cancha, baños, tienda, pasillos…); «Agregar zonas comunes» pone las más usuales para empezar. En cada zona se elige:

- **Docentes por turno** (1 a 4) y en qué **descansos** se cuida (1.º, entre las franjas 2 y 3; 2.º, entre la 4 y la 5).
- **Jornada**, si el colegio tiene mañana y tarde.
- **Álgida**: zonas más pesadas (baños, tienda). Quien la acompaña un día no la repite el día anterior ni el siguiente.
- **Pareja fija**: dos docentes que se reparten esa zona solos durante todo el ciclo. Con 1 docente por turno se dividen los días completos (quien la cubre un día la cubre en los dos descansos).

«Repartir turnos» llena la tabla del ciclo. Solo elige a quien ese día tiene clase en esa jornada y está disponible alrededor del descanso, nunca pone a alguien en dos zonas a la vez, y reparte **en proporción al espacio libre**: quien tiene menos horas de clase acompaña más, y quien está muy cargado, menos. La tabla «Turnos por docente» muestra cuántos tiene cada uno y cuántos le tocarían en proporción. Cada turno se puede cambiar a mano; la app avisa si algo no cuadra (una zona sin cubrir, alguien que ese día no está, una álgida repetida). «Imprimir o PDF» saca la tabla para la cartelera.

## Subir un Word o PDF

En **Asignación académica** o en **Áreas e intensidad**, toca «Importar Word o PDF». La app busca las tablas del documento:

- La tabla de **intensidad** tiene las áreas en filas y los grados en columnas (6°, 7°, Sexto…).
- La tabla de **asignación** tiene una columna de docente y otras de área o asignatura, grupos y horas. Los grupos pueden ir como 6-1, 601, 6°1 o 6A. Si el nombre del docente está solo en su primera fila, las de abajo se le asignan a él.

Antes de importar muestra lo que entendió, qué columna es cada cosa (se puede corregir) y las filas que no entendió. Las asignaturas que no se llaman igual que un área (Física, Química, Español, Geometría, Religión…) se asocian solas a su área cuando se puede; las demás las eliges tú, o las creas como área nueva. No cambia nada hasta tocar «Importar». Un PDF que sea foto o escaneo no se puede leer; los .doc antiguos hay que guardarlos como .docx desde Word.

## Opciones del colegio

- **Aulas.** Además de «cada grupo tiene su aula», «cada docente tiene su aula» y «mixto», está «aula fija para algunos, aula libre para los demás»: los docentes con aula fija dictan en la suya y los demás reciben un aula libre a esa hora (incluida la de un docente con aula fija cuando no tiene clase). En el horario, «Repartir aulas libres» vuelve a repartirlas después de mover clases.
- **Una hora libre todos los días.** Cada docente tiene al menos una franja sin clase cada día que está en el colegio. Si a alguien no le caben sus horas así (por ejemplo, porque entra tarde algunos días), la app lo dice al generar y propone qué hacer.
- **Carga pareja.** Las clases de cada docente se reparten entre los días sin dejar uno recargado y otro con muchas horas libres: de un día a otro, sus horas libres difieren a lo sumo en una. Con 22 horas, por ejemplo, queda con 4 o 5 clases cada día. El horario se empareja solo al generarlo, al activar la regla y al cambiar la asignación o la disponibilidad de un docente. Si después mueves clases a mano y alguien queda disparejo, toca «Emparejar la carga» junto a los cruces pendientes: mueve o intercambia lo necesario sin tocar las clases fijadas.
- **Materias de 2 horas siempre en bloque.** Si un docente dicta una materia de 2 horas por semana a un grupo, las dos horas van juntas el mismo día (franjas 1-2, 3-4 o 5-6). Funciona aunque «Clases en bloque» esté apagada; no se aplica a las materias excluidas de los bloques ni si el máximo de horas de la materia por día es 1.
- **Materias cortas en días separados.** Una materia de 4 horas o menos por semana (el número se puede cambiar junto a la casilla) en un grupo (sumando todos sus docentes) no se dicta en dos días seguidos: sus bloques o sus horas sueltas quedan con al menos un día de por medio (lunes y miércoles; o lunes, miércoles y viernes). No se aplica cuando no se puede cumplir con el máximo de horas de la materia por día. Si la activas con un horario ya hecho, se reacomoda solo.
- **Clases en bloque.** Si se activa, el generador pone dos horas seguidas de la misma materia (franjas 1-2, 3-4 o 5-6) todas las veces que puede; lo que no cabe queda suelto. Debajo se marcan las materias que nunca van en bloque (por ejemplo, Educación Física): quedan en horas sueltas, sin dos horas pegadas el mismo día en esas franjas.
- **Leer intensidad desde la asignación.** En «Asignación académica» o en «Áreas e intensidad»: llena la intensidad de cada grado con las horas que ya tienen asignadas sus grupos, para no escribirla a mano. Muestra los cambios antes de aplicarlos.
- **Unir áreas.** En «Áreas e intensidad», «Unir con…» pasa todo lo de un área (horas, intensidad, docentes y clases) a otra. Sirve cuando una misma área quedó con dos nombres.
- **Sin aulas.** En «Colegio → Aulas», si no necesitas llevar el control de aulas, el horario no las asigna ni las revisa.
- **Horas extra.** Un docente puede tener horas extra por semana, adicionales a su carga. Para los demás la regla de 22 (o 25) horas sigue igual.

## Tus datos

- Se guardan solos en Chrome, en este computador. Si borras los datos de navegación de Chrome, se pierden.
- Si pasan más de 7 días sin respaldo, el menú lo avisa en amarillo.
- Por eso, usa **«Guardar respaldo»** (abajo a la izquierda) cada vez que termines de trabajar. Crea un archivo `Respaldo <colegio> AAAA-MM-DD.json` en Descargas con el colegio abierto y todas sus versiones. Si tienes varios colegios, abre cada uno y guarda su respaldo. Guárdalos en una carpeta segura o en tu correo.
- **«Abrir respaldo»** carga uno de esos archivos. Si es del colegio abierto, lo reemplaza; si es de otro colegio, el abierto queda guardado en «Otros colegios».
- Para pasar el trabajo a otro computador: copia `Horarios.html` y el último respaldo, y ábrelo allá.

## Imprimir, PDF y WhatsApp

En **Horario**, si el colegio tiene grupos en las dos jornadas, el primer selector deja ver y descargar **solo la mañana** o **solo la tarde**. Los docentes de horario intermedio se ven en dos tablas (una por jornada). Junto a los botones eliges también qué sacar: solo el grupo (docente o aula) que estás viendo, todos uno por hoja, o **todos juntos en una tabla** (la sábana: una fila por grupo o por docente y una columna por cada franja de la semana, en hoja oficio, con un código por área como MAT o LEN y su leyenda al pie). Luego:

- **Imprimir** abre la ventana de impresión.
- **PDF** descarga un archivo a color en Descargas («Horario Grupo 7-1.pdf» o «Horarios por grupo.pdf»). Ese archivo se adjunta tal cual en WhatsApp o en un correo.
- **Excel** descarga lo mismo como hoja de cálculo.

## Colegios y versiones

La pantalla **«Colegios y versiones»** (la primera del menú) muestra el colegio abierto con todas sus versiones del horario y, debajo, los demás colegios.

- **Versiones.** Cada versión es una copia completa: reglas, áreas, grupos, docentes, aulas, asignación y horario. La versión en uso es la que ves y cambias en las demás pantallas; lo que cambies ahí no toca las otras. La tabla compara cuántos grupos, docentes, horas asignadas, clases y cruces tiene cada una. «Nueva versión» guarda la que está en uso y te deja seguir en una copia; «Abrir» pone en uso otra (la que tenías queda guardada). También se crea una versión desde la barra de arriba en «Asignación académica» y en «Horario».
- **Importar un horario en PDF como versión.** «Importar horario en PDF» lee un «Horario general» descargado de la app (Horario → General → PDF) y crea con él una versión nueva, en uso: cada clase en su día y franja, y la asignación que sale de contarlas. Reconoce a los docentes, grupos y áreas del colegio abierto por su nombre, también los que el PDF corta. Si un docente se llama distinto (por ejemplo, porque le cambiaste el nombre después de descargar el PDF), propone el más parecido y te deja elegir a quién corresponde o agregarlo como nuevo. Antes de crear la versión muestra qué va a agregar. Si el PDF no trae aulas, la versión queda sin control de aulas. El horario entra tal cual: no se mueve ninguna clase, y lo que no cumpla las reglas queda en «Cruces pendientes».
- **Docentes repetidos.** Si una misma persona quedó con dos nombres (por ejemplo, al importar un horario hecho antes de cambiarle el nombre), en «Asignación académica» y en «Horario» aparece el aviso «Parece que hay docentes repetidos» con el botón «Unir»: las clases pasan al docente del colegio, que conserva su nombre, carga y disponibilidad. Para unir a mano dos nombres muy distintos, en la ficha del docente («Grupos, docentes y aulas») está «Unir con otro docente».
- **Lo que es de todas las versiones:** el nombre del colegio y las incapacidades.
- **Varios colegios.** «Nuevo colegio» abre uno vacío; el que tenías queda en «Otros colegios» con todas sus versiones, y lo vuelves a abrir con «Abrir».
- **Cambiar datos con un horario ya hecho.** Si cambias la disponibilidad de un docente, un aula, un grupo o una regla, el horario se reacomoda solo: mueve únicamente las clases que quedaron rompiendo una regla, con los cambios más cortos posibles (y nunca las fijadas). Un aviso dice cuántas se movieron.

## Si algo sale mal

- **Deshacer último cambio** (abajo a la izquierda, en cualquier pantalla) revierte los cambios uno por uno.
- Si abres la app en dos pestañas, cada una toma lo que la otra guarda; aun así, es mejor trabajar en una sola. Si quedó abierta una pestaña con una versión anterior de la app, la app avisa arriba que la cierres (esa pestaña no puede deshacer los cambios de la nueva).
- Si la app no puede armar el horario, dice qué lo bloquea y propone soluciones. Nunca cambia una regla sin que tú lo decidas.
- Si moviste algo y aparecen cruces, están en la lista «Cruces pendientes»; tocar uno te lleva a la clase. «Arreglar cruces» mueve solo las clases que chocan, con los cambios más cortos posibles. Al mover una clase a mano, solo se intercambia con otra del grupo en la misma jornada (una de la tarde no desplaza a una de la mañana).

## Para quien mantenga el código

Node está dentro de la carpeta del proyecto (`.tools/node`), no en el sistema.

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
npm test          # pruebas de la lógica y de las pantallas
npm run build     # vuelve a crear Horarios.html
PASOS=./pasos-entrega.mjs node pruebas-e2e/captura.mjs capturas   # recorrido en Chrome real
```

La lógica del colegio está en `src/dominio/` (sin interfaz, con pruebas), el guardado y Excel en `src/datos/`, y las pantallas en `src/ui/`. Los 12 casos de prueba de la especificación están en `src/dominio/casos-especificacion.test.ts`. El diseño visual está descrito en `DESIGN.md` y el producto en `PRODUCT.md`.

Todavía no hay cuentas de usuario ni versión en línea; el diseño está en `docs/superpowers/specs/`.
