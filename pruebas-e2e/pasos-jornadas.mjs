// Docentes de mañana y tarde: grupos de la tarde, una docente de horario intermedio, sus dos tablas y el PDF de la tarde.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic, foto }) => {
  await clic('Grupos, docentes y aulas', 'nav button')
  for (const g of ['10-1', '10-2', '11-1']) await pagina.select(`select[aria-label="Jornada del grupo ${g}"]`, 'tarde')
  await clic('Docentes', '[role=tab]')
  await clic('Sandra Milena Ríos', '.lista button')
  await pagina.evaluate(() => {
    const s = [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith('Jornada')).querySelector('select')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ambas')
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await espera(300)
  await foto('104-docente-dos-jornadas')
  comprobar((await texto(pagina)).includes('Disponible en 60 de 60 franjas.'), 'la disponibilidad cuenta las dos jornadas (60 franjas)')

  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(400)
  console.log('tras generar:', (await texto(pagina)).match(/Cruces pendientes · \d+|No se pudo ubicar[^.]*/)?.[0])
  await clic('Por docente', '[role=tab]')
  await pagina.select('select[aria-label="Elegir docente"]', await pagina.$eval('select[aria-label="Elegir docente"]', (s) => [...s.options].find((o) => o.textContent === 'Sandra Milena Ríos').value))
  await espera(300)
  const titulos = await pagina.evaluate(() => [...document.querySelectorAll('h4')].map((h) => h.textContent))
  comprobar(titulos.includes('Jornada de la mañana') && titulos.includes('Jornada de la tarde'), 'la docente de horario intermedio se ve en dos tablas')
  await foto('105-dos-tablas', false)

  // PDF de todos los grupos, solo la tarde.
  const carpeta = resolve('pruebas-e2e/descargas')
  rmSync(carpeta, { recursive: true, force: true })
  mkdirSync(carpeta)
  const cdp = await pagina.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: carpeta })
  await pagina.select('select[aria-label="Jornada"]', 'tarde')
  await clic('Por grupo', '[role=tab]')
  await pagina.select('select[aria-label="Qué imprimir o exportar"]', 'todos')
  await clic('PDF', 'header button')
  for (let i = 0; i < 40 && !readdirSync(carpeta).length; i++) await espera(250)
  const archivos = readdirSync(carpeta)
  comprobar(existsSync(`${carpeta}/Horarios por grupo · tarde.pdf`), `descarga el PDF de los grupos de la tarde (${archivos.join(', ')})`)
  rmSync(carpeta, { recursive: true, force: true })
}
