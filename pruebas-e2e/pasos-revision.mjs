// Capturas para la revisión de diseño: el horario generado, en escritorio y en celular, página completa.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export default async ({ pagina, clic }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await pagina.select('select[aria-label="Elegir grupo"]', await pagina.$$eval('select[aria-label="Elegir grupo"] option', (os) => os.find((o) => o.textContent === '8-1').value))
  await espera(4500) // deja ir el aviso flotante
  scrollTo(0, 0)
  await pagina.screenshot({ path: `${process.argv[2]}/desktop.png`, fullPage: true })
  await pagina.setViewport({ width: 390, height: 844 })
  await espera(300)
  await pagina.screenshot({ path: `${process.argv[2]}/mobile.png`, fullPage: true })
}

function scrollTo() {}
