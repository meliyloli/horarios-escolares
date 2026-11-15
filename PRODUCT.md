# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript, compilado a un solo archivo `Horarios.html` que se abre en Chrome con doble clic. La usuaria delegó las decisiones técnicas. Se eligió así porque no exige instalar ni arrancar nada y el mismo código sirve después para una versión en línea o instalable.

## Users

Una docente de un colegio colombiano que arma el horario del colegio en su propio computador. Prefiere que la app la guíe: pasos claros, textos de ayuda y avisos que expliquen qué hacer. No es ingeniera. Más adelante la podrían usar coordinación y rectoría.

## Product Purpose

Genera el horario completo del colegio (docente, grupo y aula) a partir de la asignación académica que define rectoría, permite ajustarlo a mano y resuelve reemplazos por incapacidad durante todo el año sin tocar el horario base. Éxito: un horario sin cruces que cumple las reglas del colegio, listo para imprimir y repartir, y reemplazos resueltos en minutos el mismo día de la ausencia.

## Positioning

Conoce las reglas de un colegio oficial colombiano: carga de 22 y 25 horas, mínimo de horas en el área de nombramiento, áreas afines, dirección de grupo, titular de primaria, jornadas y ciclo de 5 o 10 días. Nunca relaja una regla por su cuenta: explica qué bloquea y deja decidir.

## Operating Context

- Un solo computador, en Chrome. Los datos viven en el navegador y en archivos de respaldo.
- Los datos de origen están en PDF o fotos y se digitan en la app.
- El horario se arma una vez al año y se ajusta; las incapacidades se registran el día que ocurren, con el horario ya creado.
- Los horarios se imprimen a color y se reparten: general para rectoría y coordinación, uno por docente, uno por grupo, uno por aula. También se exportan a PDF y Excel, y se mandan por WhatsApp: cada horario individual debe caber en una hoja y leerse en un celular.

## Capabilities and Constraints

- Seis pantallas: Colegio, Áreas e intensidad horaria, Grupos/Docentes/Aulas, Asignación académica, Horario, Incapacidades.
- 6 franjas por día con descansos fijos después de la 2.ª y la 4.ª.
- La app avisa cada cruce pero nunca impide guardar un cambio manual.
- Vocabulario obligatorio del colegio: asignación académica, área, área de nombramiento, área afín, dirección de grupo, titular, jornada, franja, hora libre, intensidad horaria, incapacidad.
- Sin cuentas de usuario ni acceso en línea en esta etapa. Sin varias sedes, bloques dobles, salas compartidas ni docente de apoyo.
- Interfaz en español de Colombia.

## Evidence on Hand

- Especificación en PDF con glosario y 12 casos de prueba.
- Colegio de ejemplo ficticio incluido en la app (16 grupos, 20 docentes). No hay datos reales cargados todavía.

## Product Principles

1. La app propone, la persona decide.
2. Cada aviso nombra la causa con las palabras del colegio y dice qué se puede hacer.
3. El horario base es sagrado: lo del día no lo cambia.
4. Guiar sin estorbar: ayuda visible donde se necesita, nada de pasos obligatorios de más.
5. Lo que se ve en pantalla es lo que sale en el papel.

## Accessibility & Inclusion

Texto legible para uso prolongado, contraste AA, todo operable con teclado (incluido mover clases) y nunca depender solo del color para distinguir un cruce o un estado.
