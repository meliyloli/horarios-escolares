// Clases en bloque con Educación Física excluida: el horario sale sin horas pegadas de esa materia.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const marcar = (pagina, inicio) =>
  pagina.evaluate((t) => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith(t)).querySelector('input').click(), inicio)

export default async ({ pagina, clic }) => {
  await clic('Colegio', 'nav button')
  await marcar(pagina, 'Clases en bloque')
  await espera(150)
  await marcar(pagina, 'Educación Física')
  await espera(150)
  const reglas = await pagina.evaluateHandle(() => [...document.querySelectorAll('section.panel')].find((s) => s.textContent.startsWith('Reglas del horario')))
  await reglas.screenshot({ path: `${process.argv[2]}/103-sin-bloque.png` })
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(300)
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('Sin cruces pendientes'), 'el horario sale completo y sin cruces')
  // En la vista general (por docente), Wilson dicta Educación Física: ninguna celda suya pegada a otra del mismo grupo en 1-2, 3-4, 5-6.
  const pegadas = await pagina.evaluate(() => {
    let n = 0
    for (const tabla of document.querySelectorAll('.horario')) {
      const celdas = [...tabla.querySelectorAll('.clase')].map((c) => c.getAttribute('aria-label') ?? '')
      for (const c of celdas) {
        const m = /^Educación Física, ([^,]+), .*?(\w+), franja (\d)/.exec(c)
        if (m && Number(m[3]) % 2 === 1 && celdas.some((x) => x.startsWith(`Educación Física, ${m[1]},`) && x.includes(`${m[2]}, franja ${Number(m[3]) + 1}`))) n++
      }
    }
    return n
  })
  comprobar(pegadas === 0, `ninguna Educación Física en bloque en la vista del grupo (${pegadas})`)
}
