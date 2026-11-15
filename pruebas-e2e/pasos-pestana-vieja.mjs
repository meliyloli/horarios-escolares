// La app abierta en otra pestaña con una versión anterior no debe deshacer lo que se cambia en esta.
// Uso: VIEJA=<ruta a un Horarios.html anterior> PASOS=./pasos-pestana-vieja.mjs node pruebas-e2e/captura.mjs <carpeta>
import { pathToFileURL } from 'node:url'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic }) => {
  const otra = await pagina.browser().newPage()
  await otra.goto(pathToFileURL(process.env.VIEJA).href)
  await espera(800)
  await pagina.bringToFront()
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Sandra Milena Ríos', '.lista button')
  await pagina.evaluate(() => {
    const s = [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith('Jornada')).querySelector('select')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ambas')
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await espera(1500)
  const jornada = await pagina.evaluate(() => [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith('Jornada')).querySelector('select').value)
  const aviso = await pagina.evaluate(() => document.querySelector('.brindis')?.textContent ?? '')
  console.log(`jornada: ${jornada}; aviso: «${aviso}»`)
  comprobar(jornada === 'ambas', 'la jornada «Mañana y tarde» se queda puesta')
  const alerta = await pagina.evaluate(() => document.querySelector('[role=alert]')?.textContent ?? '')
  comprobar(alerta.includes('versión anterior'), 'avisa que hay otra pestaña con una versión anterior')
  await pagina.screenshot({ path: `${process.argv[2]}/106-pestana-vieja.png` })
  await otra.close()
}
