// Sube un Word y un PDF reales a la app y comprueba lo que entendió y lo que importó.
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`)
  if (!ok) fallos.push(texto)
}
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)

export default async ({ pagina, clic, foto }) => {
  await clic('Empezar con mi colegio')
  await clic('Sí, borrar el ejemplo')

  for (const archivo of ['asignacion.docx', 'asignacion.pdf']) {
    if (archivo.endsWith('.pdf')) {
      await clic('Colegio', 'nav button')
      await clic('Borrar todo y empezar de cero')
      await clic('Sí, borrar todo')
    }
    await clic('Asignación académica')
    await clic('Importar Word o PDF')
    const entrada = await pagina.$('input[aria-label="Documento de Word o PDF"]')
    await entrada.uploadFile(resolve('pruebas-e2e/muestras', archivo))
    await pagina.waitForFunction(() => document.body.textContent.includes('Lo que se va a importar') || document.querySelector('.aviso.error'), { timeout: 20000 })
    await espera(200)
    await foto(`40-importar-${archivo}`)
    const t = await texto(pagina)
    comprobar(t.includes('Intensidad: 5 áreas'), `${archivo}: encuentra la intensidad de 5 áreas`)
    comprobar(t.includes('Asignación: 10 filas'), `${archivo}: entiende la asignación (Ana 4+2 grupos, Luis 2+2)`)
    comprobar(t.includes('Docentes nuevos: 2'), `${archivo}: reconoce 2 docentes`)
    comprobar(t.includes('Grupos nuevos: 6-1, 6-2, 7-1, 7-2'), `${archivo}: reconoce los grupos escritos de varias formas`)
    comprobar(t.includes('Áreas nuevas: Emprendimiento'), `${archivo}: solo Emprendimiento es área nueva (Humanidades: Lengua Castellana se reconoce)`)
    if (archivo.endsWith('.pdf')) {
      await clic('Cancelar')
      continue
    }
    await clic('Importar', 'button.primario')
    await espera(300)
    await clic('Por grupo', '[role=tab]')
    const t2 = await texto(pagina)
    comprobar(t2.includes('Ana María Ruiz Gómez') || (await pagina.$$eval('[title]', (els) => els.some((e) => e.title.includes('Ana María Ruiz Gómez')))), 'docx: la asignación quedó cargada')
    await foto('41-despues-de-importar')
    await clic('Áreas e intensidad')
    const horas = await pagina.$eval('input[aria-label="Horas de Emprendimiento en grado 10"]', (el) => el.value)
    comprobar(horas === '1', 'docx: la intensidad de Emprendimiento en 10° quedó en 1')
  }
  console.log(fallos.length ? `\n${fallos.length} FALLAS` : '\nImportación completa, sin fallas')
}

/** Formatos difíciles: una tabla por docente con su nombre como título y sin horas; un PDF con renglones partidos y en dos páginas. */
export const dificiles = async ({ pagina, clic, foto }) => {
  const casos = [
    ['por-docente.docx', ['Docentes nuevos: 2', 'Asignación: 6 filas'], 'Marta Cecilia Ochoa'],
    ['renglones.pdf', ['Docentes nuevos: 2', 'Asignación: 8 filas'], 'María Fernanda Restrepo Villegas'],
  ]
  for (const [archivo, esperado, nombre] of casos) {
    await clic('Colegio', 'nav button')
    await clic('Borrar todo y empezar de cero')
    await clic('Sí, borrar todo')
    await clic('Asignación académica')
    await clic('Importar Word o PDF')
    const entrada = await pagina.$('input[aria-label="Documento de Word o PDF"]')
    await entrada.uploadFile(resolve('pruebas-e2e/muestras', archivo))
    await pagina.waitForFunction(() => document.body.textContent.includes('Lo que se va a importar') || document.querySelector('.aviso.error'), { timeout: 20000 })
    await espera(200)
    await foto(`42-importar-${archivo}`)
    const t = await texto(pagina)
    for (const e of esperado) comprobar(t.includes(e), `${archivo}: ${e}`)
    comprobar(!t.includes('no entendió'), `${archivo}: no quedan filas sin entender`)
    await clic('Importar', 'button.primario')
    await espera(300)
    comprobar((await texto(pagina)).includes(nombre), `${archivo}: ${nombre} quedó con su asignación`)
  }
  console.log(fallos.length ? `\n${fallos.length} FALLAS` : '\nFormatos difíciles sin fallas')
}
