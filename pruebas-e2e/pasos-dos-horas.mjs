// Materias de 2 horas siempre en bloque: se activa en Colegio y el horario generado la cumple.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic }) => {
  await clic('Colegio', 'nav button')
  await pagina.evaluate(() => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith('Materias de 2 horas')).querySelector('input').click())
  await espera(200)
  await pagina.evaluate(() => [...document.querySelectorAll('section.panel')].find((s) => s.textContent.startsWith('Reglas del horario')).scrollIntoView())
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(300)
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('Sin cruces pendientes') && !t.includes('horas separadas'), 'el horario sale completo y cada materia de 2 horas va en bloque')
  // En el grupo 7-1 (Educación Artística y Educación Física tienen 2 horas): sus dos horas, el mismo día y en el mismo par.
  await clic('Por grupo', '[role=tab]')
  await pagina.select('select[aria-label="Elegir grupo"]', await pagina.$eval('select[aria-label="Elegir grupo"]', (s) => [...s.options].find((o) => o.textContent === '7-1').value))
  await espera(200)
  const separadas = await pagina.evaluate(() => {
    const celdas = [...document.querySelectorAll('.horario .clase')].map((c) => c.getAttribute('aria-label') ?? '')
    return ['Educación Artística', 'Educación Física'].filter((area) => {
      const pos = celdas.filter((c) => c.startsWith(`${area},`)).map((c) => /(\w+), franja (\d)/.exec(c)).map((m) => `${m[1]}|${Math.ceil(Number(m[2]) / 2)}`)
      return pos.length !== 2 || pos[0] !== pos[1]
    })
  })
  comprobar(separadas.length === 0, `en 7-1 Educación Artística y Educación Física van en bloque (${separadas.join(', ') || 'ninguna separada'})`)
}
