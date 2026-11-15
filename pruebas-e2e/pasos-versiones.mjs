// Colegios y versiones: versiones completas e independientes, varios colegios y que todo siga al recargar.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const escribir = async (pagina, selector, valor) => {
  const campo = await pagina.$(selector)
  await campo.evaluate((el) => el.select())
  await pagina.keyboard.type(valor, { delay: 10 })
}
const celdas = (pagina, version) =>
  pagina.evaluate((v) => [...document.querySelectorAll('.tabla-versiones tbody tr')].find((tr) => tr.querySelector('th')?.textContent.startsWith(v))?.textContent ?? '', version)

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await espera(4500)

  // 1. Versión nueva y un cambio solo en ella: Luz Marina deja de venir el lunes
  await clic('Nueva versión')
  await escribir(pagina, 'input[type=text]', 'Sin Luz los lunes')
  await clic('Crear versión')
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Luz Marina Restrepo', '.lista button')
  await pagina.click('input[aria-label="No viene el lunes"]')
  await espera(400)
  console.log('aviso:', await pagina.evaluate(() => document.querySelector('.brindis')?.textContent ?? ''))
  await clic('Colegios y versiones', 'nav button')
  await espera(300)
  await foto('97-versiones', false)
  comprobar((await celdas(pagina, 'Sin Luz los lunes')).includes('En uso'), 'la versión nueva está en uso')
  comprobar((await celdas(pagina, 'Sin Luz los lunes')).includes('Sin cruces'), 'el horario de la versión nueva se reacomodó sin cruces')
  comprobar((await celdas(pagina, 'Horario principal')).includes('455 clases'), 'la versión principal conserva su horario')

  // 2. Colegio nuevo; el de ejemplo queda en la lista
  await clic('Nuevo colegio')
  await clic('Sí, crear un colegio nuevo')
  await espera(300)
  await pagina.evaluate(() => [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === 'Colegio').click())
  await espera(250)
  await escribir(pagina, 'input[type=text]', 'Colegio San José')
  await espera(300)

  // 3. Todo sigue después de recargar
  await pagina.reload()
  await pagina.evaluate(() => document.fonts.ready)
  await clic('Colegios y versiones', 'nav button')
  await espera(300)
  const t = await texto(pagina)
  comprobar(t.includes('Colegio San José') && t.includes('Institución Educativa de Ejemplo'), 'al recargar están los dos colegios')
  comprobar(t.includes('2 versiones: Sin Luz los lunes, Horario principal'), 'el colegio guardado conserva sus dos versiones')
  await foto('98-colegios', false)

  // 4. Volver al colegio de ejemplo y a su versión principal
  await clic('Abrir Institución Educativa de Ejemplo')
  await espera(300)
  await clic('Abrir Horario principal')
  await espera(300)
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Luz Marina Restrepo', '.lista button')
  const marcado = await pagina.$eval('input[aria-label="No viene el lunes"]', (el) => el.checked)
  comprobar(!marcado, 'en la versión principal Luz Marina sigue viniendo el lunes')
}
