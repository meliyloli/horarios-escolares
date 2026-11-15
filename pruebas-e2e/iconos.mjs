// Uso: node pruebas-e2e/iconos.mjs (desde la raíz del proyecto). Regenera los PNG de public/ a partir del mismo dibujo del favicon.
// Dibuja el ícono de la app (cartelera de bloques) en PNG de 192, 512 y 512 «maskable» (con margen de seguridad).
import puppeteer from 'puppeteer-core'
const svg = (margen) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
<rect width='32' height='32' rx='${margen ? 0 : 7}' fill='#14285a'/>
<g transform='translate(${margen ? 4 : 0} ${margen ? 4 : 0}) scale(${margen ? 0.75 : 1})'>
<rect x='6' y='8' width='6' height='6' rx='1.5' fill='#ff7a45'/><rect x='13' y='8' width='6' height='6' rx='1.5' fill='#4fb3e8'/><rect x='20' y='8' width='6' height='6' rx='1.5' fill='#ffc93c'/>
<rect x='6' y='15' width='6' height='6' rx='1.5' fill='#3cc47c'/><rect x='13' y='15' width='6' height='6' rx='1.5' fill='#ffc93c'/><rect x='20' y='15' width='6' height='6' rx='1.5' fill='#f58bb4'/>
<rect x='6' y='22' width='6' height='4' rx='1.5' fill='#6a4bc4'/><rect x='13' y='22' width='6' height='4' rx='1.5' fill='#ff7a45'/><rect x='20' y='22' width='6' height='4' rx='1.5' fill='#5cc9bb'/>
</g></svg>`
const nav = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const pag = await nav.newPage()
for (const [nombre, tam, margen] of [['icono-192.png', 192, false], ['icono-512.png', 512, false], ['icono-512-maskable.png', 512, true]]) {
  await pag.setViewport({ width: tam, height: tam })
  await pag.setContent(`<html><body style="margin:0;background:transparent">${svg(margen).replace('<svg ', `<svg width='${tam}' height='${tam}' `)}</body></html>`)
  await pag.screenshot({ path: `public/${nombre}`, omitBackground: true, clip: { x: 0, y: 0, width: tam, height: tam } })
}
await nav.close()
console.log('listo')
