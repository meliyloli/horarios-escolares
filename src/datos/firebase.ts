import type { ConfigFirebase } from './nube'

/**
 * La base de datos en línea donde se comparten los colegios (Firebase, de Google). Estos datos no son secretos:
 * identifican el proyecto, y lo que protege a cada colegio es su código (los datos van cifrados con él).
 * null mientras no esté configurada: la app funciona igual, pero solo en este navegador.
 */
export const CONFIG_FIREBASE: ConfigFirebase | null = null
