// Crea un PDF desde un HTML con Chrome. Uso: node pruebas-e2e/muestras/crear-pdf.mjs [entrada.html] [salida.pdf]
import puppeteer from 'puppeteer-core'
import { pathToFileURL } from 'node:url'
const [entrada = 'pruebas-e2e/muestras/asignacion.html', salida = 'pruebas-e2e/muestras/asignacion.pdf'] = process.argv.slice(2)
const navegador = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const pagina = await navegador.newPage()
await pagina.goto(pathToFileURL(entrada).href)
await pagina.pdf({ path: salida, format: 'Letter' })
await navegador.close()
