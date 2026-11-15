// Acompañamiento en descansos: zonas comunes, una pareja fija y el reparto de turnos.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes/.test(document.body.textContent), { timeout: 30000 })
  await espera(4500)
  await clic('Acompañamiento', 'nav button')
  await clic('Agregar zonas comunes')
  // La tienda escolar con pareja fija.
  const ids = await pagina.$eval('select[aria-label="Pareja de Tienda escolar, docente 1"]', (s) => [...s.options].slice(1, 3).map((o) => o.value))
  await pagina.select('select[aria-label="Pareja de Tienda escolar, docente 1"]', ids[0])
  await pagina.select('select[aria-label="Pareja de Tienda escolar, docente 2"]', ids[1])
  await clic('Repartir turnos')
  await espera(400)
  const avisos = await pagina.evaluate(() => [...document.querySelectorAll('section[aria-labelledby="titulo-turnos"] .aviso')].map((a) => a.textContent))
  comprobar(avisos.length === 0, `el reparto sale sin avisos (${avisos.join(' | ')})`)
  const pareja = await pagina.evaluate(() => document.body.textContent.includes('pareja:'))
  comprobar(pareja, 'la pareja fija queda guardada y se ve en los turnos')
  await foto('111-acompanamiento', false)
  await pagina.evaluate(() => document.querySelector('#titulo-carga-acompanamiento')?.scrollIntoView())
  await foto('112-turnos-por-docente', false)

  // Si quien acompaña falta ese día, Incapacidades avisa qué turno queda solo y sugiere quién lo cubre.
  const quien = await pagina.$eval('select[aria-label="Patio principal, Lunes, 1.er descanso"]', (s) => ({ id: s.value, nombre: s.selectedOptions[0].textContent }))
  await clic('Incapacidades', 'nav button')
  await pagina.evaluate(() => {
    const f = document.querySelector('input[type=date]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f, '2026-11-16')
    f.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await espera(200)
  await pagina.evaluate((id) => {
    const s = [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith('Docente ausente')).querySelector('select')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, id)
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }, quien.id)
  await clic('Registrar ausencia')
  await espera(400)
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('Acompañamiento en descansos') && t.includes(`le tocaba a ${quien.nombre}`) && t.includes('Puede cubrirlo'), `Incapacidades avisa que ${quien.nombre} deja el patio y sugiere quién lo cubre`)
  await pagina.evaluate(() => [...document.querySelectorAll('h4')].find((h) => h.textContent === 'Acompañamiento en descansos')?.scrollIntoView())
  await foto('113-acompanamiento-ausencia', false)
}
