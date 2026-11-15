---
version: 1
slug: "src-ui-app-tsx"
primary_target: "src/ui/App.tsx"
related_targets: []
---

# Surface: app de horarios (todas las pantallas)

Mode: Operate. Audience: una docente que arma el horario en su computador y prefiere que la app la guíe. Job: validar la asignación, generar el horario, corregir cruces, imprimir y repartir, resolver incapacidades. Constraints: un solo archivo, Chrome, impresión a color, PDF por WhatsApp.

## Direction contract

THESIS: El horario como lo conoce todo el colegio en la pared del salón: bloques grandes de color por materia. Rechaza el tablero administrativo gris con fichas pastel.

OWN-WORLD: Barra lateral azul noche (#14285A, más oscura a pedido de la usuaria) sobre fondo azul cielo muy claro (#EAF2FB); paneles de cartulina blanca sin sombras; cada área es un bloque de color pleno con tinta azul noche (#1B2B4B); acción principal en el azul noche del riel con texto blanco (el color vivo es solo de las materias); esquinas redondeadas 12-14 px; Baloo 2 redonda en títulos y nombre de materia; Nunito Sans para leer.

STORY: Ve su colegio en colores conocidos, entiende de un vistazo qué falta o choca, y lo corrige con ayuda escrita en palabras del colegio.

FIRST VIEWPORT: Riel de seis pantallas a la izquierda (264 px); al centro título, acciones (Imprimir, Excel, Generar horario) y la cuadrícula de 5 días por 6 franjas con descansos; a la derecha el panel de cruces pendientes (320 px).

SIGNATURE: el bloque de color de la materia, idéntico en las cuatro vistas, en la impresión y en la leyenda; al tomar una clase se levanta y los destinos posibles se marcan.

FORM: Cartelera del salón, posición 1 de la lista propia (elegida por la usuaria sobre la asignada). seed:014ad2eb7fb47e76

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
