// Primera vista del horario y del menú en un portátil de colegio (1366×768).
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(4500)
  await foto('p01-horario-768', false)
  const medidas = await pagina.evaluate(() => ({
    rejilla: Math.round(document.querySelector('.clase')?.getBoundingClientRect().top ?? -1),
    riel: document.querySelector('.riel').scrollHeight,
    alto: innerHeight,
  }))
  console.log(JSON.stringify(medidas))
}
