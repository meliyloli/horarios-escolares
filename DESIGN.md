---
name: Horarios escolares
description: El horario del colegio como se ve en la cartelera del salón, hecho herramienta de trabajo.
colors:
  riel: "#14285a"
  riel-tinta: "#dce7fb"
  riel-activo: "#ffc93c"
  fondo: "#eaf2fb"
  panel: "#ffffff"
  tinta: "#1b2b4b"
  suave: "#4e607f"
  linea: "#c9d8ee"
  linea-fuerte: "#9db4d9"
  primario: "#ff7a45"
  primario-fuerte: "#f2622a"
  seleccion: "#1f5fbf"
  peligro: "#b3261e"
  peligro-fondo: "#ffe9e3"
  aviso: "#7a4f00"
  aviso-fondo: "#fff1c7"
  bien: "#17693d"
  bien-fondo: "#dff5e6"
  area-matematicas: "#ff7a45"
  area-lengua: "#4fb3e8"
  area-ingles: "#3cc47c"
  area-naturales: "#a5d152"
  area-sociales: "#ffc93c"
  area-filosofia: "#c3a6f0"
  area-artistica: "#f58bb4"
  area-fisica: "#6a4bc4"
  area-etica: "#3fd0e0"
  area-religion: "#c9b7ae"
  area-tecnologia: "#5cc9bb"
typography:
  headline:
    fontFamily: "'Baloo 2', ui-rounded, 'Segoe UI', system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Baloo 2', ui-rounded, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'Baloo 2', ui-rounded, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "'Baloo 2', ui-rounded, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  chico: "8px"
  normal: "12px"
  dialogo: "16px"
  ficha: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "22px"
  xl: "32px"
components:
  boton:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.normal}"
    padding: "7px 16px"
    height: "42px"
  boton-primario:
    backgroundColor: "{colors.primario}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.normal}"
    padding: "7px 16px"
    height: "42px"
  boton-primario-hover:
    backgroundColor: "{colors.primario-fuerte}"
  riel-item-activo:
    backgroundColor: "{colors.riel-activo}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.normal}"
    padding: "11px 12px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.normal}"
    padding: "20px 22px"
  clase:
    backgroundColor: "{colors.area-matematicas}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.normal}"
    padding: "8px 10px"
  ficha:
    backgroundColor: "#e1edff"
    textColor: "{colors.tinta}"
    rounded: "{rounded.ficha}"
    padding: "1px 10px"
---

## Overview

**Creative North Star: "La cartelera del salón"**

El horario que todo el colegio conoce, pegado en la pared del salón en cartulina de colores, convertido en una herramienta para armarlo. Cada materia es un bloque de color pleno con letra redonda y gruesa. La estructura es la de cualquier programa de trabajo (barra lateral, encabezado, tablas); el mundo solo aporta el color, la letra, la densidad y el bloque de clase.

La usa una docente en su computador, de día, con luz de oficina o de salón: fondo claro. Prefiere que la app la guíe, así que cada pantalla abre con una frase que dice para qué sirve y cada aviso nombra la causa con palabras del colegio.

**Key Characteristics:**

- Bloques de clase de color pleno, sin sombras, idénticos en las cuatro vistas, en el papel y en la leyenda.
- Riel azul noche con el ítem activo en amarillo cartulina.
- Una sola familia de letra, redonda, con cifras tabulares.
- Avisos en bandas de color suave con ícono y texto; nunca solo color.

## Colors

- **Estructura.** Riel `riel` (#14285a) con texto `riel-tinta`; el ítem activo va en `riel-activo` (#ffc93c) con `tinta`. Fondo `fondo` (#eaf2fb), paneles `panel` blancos con borde `linea`.
- **Texto.** `tinta` (#1b2b4b) para todo; `suave` (#4e607f) para ayudas y secundarios. Nunca gris neutro.
- **Acción.** `primario` (#ff7a45) solo para la acción principal de cada pantalla, con texto `tinta` (el blanco no alcanza contraste AA sobre este naranja). `seleccion` (#1f5fbf) para foco, selección y destinos al mover una clase.
- **Estados.** `peligro`, `aviso`, `bien` sobre sus fondos suaves. Un cruce se marca con anillo `peligro` y con ícono, no solo con color.
- **Áreas.** Paleta de 16 cartulinas (`src/ui/colores.ts`). Cada área guarda su color y el colegio lo puede cambiar.

**The Tinta Automática Rule.** Sobre un color de área el texto es `tinta` o blanco, el que tenga más contraste (`tintaSobre`). Todo color de la paleta debe dar al menos 4,5:1; hay una prueba que lo exige.

**The Un Naranja Rule.** El naranja `primario` aparece una vez por pantalla, en lo que la usuaria vino a hacer.

## Typography

Baloo 2 variable (400 a 800), incluida dentro del archivo: sin conexión se ve igual. Escala fija en rem: 0.875 (etiquetas y fichas), 1 (cuerpo), 1.0625 (guías y navegación), 1.375 (títulos de panel), 2 (título de pantalla). Jerarquía por peso (500 cuerpo, 600 a 700 etiquetas y controles, 800 títulos), no por color. Cifras tabulares en toda la app. Prosa a 72 caracteres como máximo.

## Layout

- Rejilla de la app: riel fijo de 264 px y contenido fluido. El contenido usa 28 px arriba, 32 px a los lados.
- Patrones: `columnas` (contenido + panel lateral de 320 px), `maestro` (lista de 340 px + detalle). El panel de detalle queda pegado al desplazarse.
- Horario: columna de 40 px para el número de franja y una columna igual por día. Los descansos son bandas completas después de las franjas 2 y 4. Con más de 5 días la cuadrícula pasa a modo compacto.
- Menos de 1100 px: las columnas se apilan. Menos de 860 px: el riel pasa arriba con navegación horizontal.
- Impresión: hoja horizontal, un docente, grupo o aula por hoja; el horario general va un día por hoja. Los colores se imprimen exactos.

## Elevation & Depth

Plano, como cartulina pegada. Los paneles se separan con borde de 1,5 px, no con sombra. La sombra aparece solo para decir "esto está levantado": la clase bajo el cursor o seleccionada (desplazada y con desenfoque), el diálogo de confirmación y el aviso flotante.

## Shapes

Esquinas de 12 px en paneles, botones y bloques de clase; 8 px en campos y elementos chicos; 16 px en diálogos; píldora en fichas. Bordes de 1,5 px. Las celdas vacías llevan borde punteado; los destinos al mover, punteado azul de 2 px.

## Components

- **Botón.** 42 px de alto, borde `linea-fuerte`, peso 700. Variantes: `primario` (naranja), `peligro` (texto rojo), `chico` (34 px), `icono`. Estados: hover (borde `seleccion`), activo (baja 1 px), foco (anillo de 3 px), deshabilitado (55 %).
- **Riel.** Botones de navegación con ícono de trazo; el activo en amarillo. El contador de cruces va en una marca roja suave.
- **Bloque de clase.** Color del área, primera línea en negrita (lo principal de esa vista), líneas siguientes en 0.875 rem. Fijada y cruce se marcan con sellos de ícono arriba a la derecha. Seleccionada: se levanta 3 px con doble anillo blanco y azul.
- **Aviso.** Banda de fondo suave con ícono a la izquierda y acciones a la derecha. Tipos: aviso (ámbar), error, bien, info. Los cruces son avisos tocables que llevan a la clase.
- **Ficha.** Píldora para estados cortos: carga 22/22, horas cubiertas.
- **Tabla de datos.** Encabezado tenue, filas con campos editables en línea, contenedor con borde y desplazamiento horizontal propio.
- **Diálogo.** Solo para confirmar algo que borra o reemplaza datos. Cancelar toma el foco.
- **Estado vacío.** Borde punteado, un título, una frase que explica qué hacer y, si aplica, el botón para hacerlo.

## Do's and Don'ts

- Do: usar el color del área como relleno pleno del bloque de clase, igual en pantalla, papel y leyenda.
- Do: acompañar todo estado con ícono o texto; el color nunca va solo.
- Do: abrir cada pantalla con una frase guía en palabras del colegio.
- Do: confirmar antes de borrar y decir qué más se borra con ello.
- Don't: poner sombras a paneles ni usar degradados.
- Don't: usar el naranja para algo que no sea la acción principal.
- Don't: poner texto blanco sobre el naranja primario ni sobre cartulinas claras.
- Don't: abrir un diálogo para editar; se edita en línea o en el panel de detalle.
- Don't: introducir una segunda familia de letra.
