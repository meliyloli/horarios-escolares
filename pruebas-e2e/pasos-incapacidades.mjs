const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await clic('Incapacidades', 'nav button')
  await foto('20-incapacidades-inicio')

  // Martes 10 de noviembre de 2026: falta Wilson Alberto Marín (Educación Física) todo el día.
  await pagina.$eval('input[type=date]', (el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, '2026-11-10')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const docente = await pagina.$$eval('.panel select option', (os) => os.find((o) => o.textContent.includes('Wilson'))?.value)
  await pagina.select('.panel select', docente)
  await clic('Registrar ausencia')
  await espera(200)
  await foto('21-clases-sin-docente')

  // Elegir el primer candidato en el primer reemplazo disponible.
  const elegido = await pagina.evaluate(() => {
    const sel = [...document.querySelectorAll('select[aria-label^="Reemplazo para"]')].find((s) => s.options.length > 1)
    if (!sel) return 'ninguno'
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    set.call(sel, sel.options[1].value)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return sel.options[1].textContent
  })
  console.log(`reemplazo elegido: ${elegido}`)
  await espera(200)
  await clic('Confirmar y guardar')
  await espera(200)
  await foto('22-dia-guardado')
  await clic('Ver este día en el horario')
  await espera(200)
  await foto('23-horario-del-dia')
}
