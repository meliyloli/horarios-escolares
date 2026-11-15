// Regla de materias cortas en días separados: se activa en Colegio y el horario generado la cumple.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic, foto }) => {
  await clic('Colegio', 'nav button')
  await pagina.evaluate(() => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith('Materias cortas')).querySelector('input').click())
  await espera(200)
  const marcada = await pagina.evaluate(() => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith('Materias cortas')).querySelector('input').checked)
  comprobar(marcada, 'la regla queda activa en Colegio')
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(300)
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('Sin cruces pendientes') && !t.includes('días seguidos'), 'el horario sale completo y sin materias cortas en días seguidos')
  await foto('100-espaciadas', false)
}
