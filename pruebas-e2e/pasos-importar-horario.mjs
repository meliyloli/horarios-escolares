// Importa un «Horario general» en PDF descargado de la app como una versión nueva del colegio abierto.
// Uso: HORARIO_PDF=<ruta del PDF> [RESPALDO=<respaldo .json del colegio>] PASOS=./pasos-importar-horario.mjs node pruebas-e2e/captura.mjs <carpeta>
// Sin RESPALDO, crea un colegio vacío con el nombre «Colegio de prueba».
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic, foto }) => {
  const ruta = process.env.HORARIO_PDF
  if (!ruta) return comprobar(false, 'falta HORARIO_PDF con la ruta del PDF')
  if (process.env.RESPALDO) {
    const entrada = await pagina.$('input[type=file][accept^=".json"]')
    await entrada.uploadFile(resolve(process.env.RESPALDO))
    await espera(400)
    await clic('Sí, abrir el respaldo')
    await espera(400)
  } else {
    await clic('Colegios y versiones', 'nav button')
    await clic('Nuevo colegio')
    await clic('Sí, crear un colegio nuevo')
    await clic('Colegio', 'nav button')
    const nombre = await pagina.$('input[type=text]')
    await nombre.evaluate((el) => el.select())
    await pagina.keyboard.type('Colegio de prueba')
  }
  await clic('Colegios y versiones', 'nav button')
  const antes = await pagina.evaluate(() => document.querySelectorAll('.tabla-versiones tbody tr').length)

  const entrada = await pagina.$('input[aria-label="Horario general en PDF"]')
  await entrada.uploadFile(resolve(ruta))
  await pagina.waitForFunction(() => document.body.textContent.includes('Horario leído del PDF'), { timeout: 30000 })
  await espera(300)
  const t = await texto(pagina)
  console.log('vista previa:', (t.match(/\d+ docentes, \d+ grupos, \d+ días y \d+ clases/) ?? ['?'])[0])
  const sugeridos = await pagina.evaluate(() =>
    [...document.querySelectorAll('select[aria-label^="Docente del colegio para"]')].map((s) => `${s.getAttribute('aria-label').replace('Docente del colegio para ', '')} → ${s.options[s.selectedIndex].textContent}`))
  for (const s of sugeridos) console.log('  ', s)
  console.log('nuevos:', (t.match(/Docentes que no están en el colegio y se agregan \(\d+\):[^.]*\./) ?? ['ninguno'])[0])
  await foto('101-importar-con-sugerencias')
  await clic('Crear versión')
  await espera(500)
  const v = await pagina.evaluate(() => [...document.querySelectorAll('.tabla-versiones tbody tr')].map((tr) => tr.textContent))
  console.log('versiones:', v.join(' | '))
  comprobar(v.length === antes + 1 && v[0].includes('Importada') && v[0].includes('En uso'), 'la versión importada queda en uso y las anteriores siguen guardadas')
  await clic('Horario', 'nav button')
  await espera(400)
  console.log((await texto(pagina)).match(/Cruces pendientes · \d+/)?.[0])
}
