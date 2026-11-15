// Celular: el horario de un docente y la lista de docentes, desplazados hasta el contenido.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(4500)
  await clic('Por docente', '[role=tab]')
  await pagina.evaluate(() => document.querySelector('.horario')?.scrollIntoView())
  await espera(300)
  await foto('m1-horario-docente', false)
  await clic('Incapacidades', 'nav button')
  await pagina.evaluate(() => document.querySelector('main')?.scrollIntoView())
  await espera(300)
  await foto('m2-incapacidades', false)
  const anchoDoc = await pagina.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vista: innerWidth }))
  console.log(JSON.stringify(anchoDoc))
}
