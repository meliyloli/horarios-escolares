// Abre Horarios.html en Chrome, ejecuta pasos y guarda capturas. Uso: node pruebas-e2e/captura.mjs <carpeta> <ancho>
import puppeteer from 'puppeteer-core'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const [carpeta = 'capturas', ancho = '1440', alto = '900'] = process.argv.slice(2)
mkdirSync(carpeta, { recursive: true })
const navegador = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const pagina = await navegador.newPage()
await pagina.setViewport({ width: Number(ancho), height: Number(alto) })
const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
const url = pathToFileURL('Horarios.html').href

export const clic = async (texto, selector = 'button') => {
  const ok = await pagina.evaluate((t, s) => {
    // El texto exacto gana: «Colegio» no debe abrir «Colegios y versiones».
    const todos = [...document.querySelectorAll(s)]
    const el = todos.find((x) => x.textContent.trim() === t) ?? todos.find((x) => (x.textContent + ' ' + (x.getAttribute('aria-label') ?? '')).includes(t))
    el?.click()
    return !!el
  }, texto, selector)
  if (!ok) throw new Error(`No encontré «${texto}»`)
  await new Promise((r) => setTimeout(r, 250))
}
const foto = (nombre, completa = true) => pagina.screenshot({ path: `${carpeta}/${nombre}.png`, fullPage: completa })

await pagina.goto(url)
await pagina.evaluate(() => document.fonts.ready)
const modulo = await import(process.env.PASOS ?? './pasos-datos.mjs')
const pasos = modulo[process.env.PARTE ?? 'default']
await pasos({ pagina, clic, foto, url })
console.log(errores.length ? `ERRORES:\n${errores.join('\n')}` : 'sin errores de consola')
await navegador.close()
