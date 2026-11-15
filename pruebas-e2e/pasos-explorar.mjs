// Edita la asignación con un horario ya hecho y comprueba que la asignación y el horario se actualicen solos.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const carga = (pagina) => pagina.evaluate(() => [...document.querySelectorAll('.panel .ficha')].find((f) => f.textContent.startsWith('Carga'))?.textContent)

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await espera(4500) // deja pasar el aviso de "Horario generado"
  await clic('Asignación académica')
  await clic('Carlos Mario Giraldo')
  // 1. Escribir horas sin salir del campo
  const campo = await pagina.$('input[aria-label="Horas de Matemáticas en 6-1"]')
  await campo.click()
  await campo.evaluate((el) => el.select())
  await pagina.keyboard.type('4')
  await espera(1200)
  comprobar((await carga(pagina)) === 'Carga: 21 de 22', `la carga se actualiza sola al dejar de escribir (${await carga(pagina)})`)
  // 2. Agregar Ética en 6-1 con el bloque del final
  await pagina.select('select[aria-label="Área nueva"]', 'eti')
  await pagina.select('select[aria-label="Grupo nuevo"]', 'g6-1')
  await pagina.$eval('input[aria-label="Horas nuevas"]', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clic('Agregar', 'section.subpanel button.primario')
  await espera(300)
  comprobar((await texto(pagina)).includes('Se ubicó 1 hora nueva en el horario'), 'avisa que la hora nueva se ubicó sola en el horario')
  comprobar((await carga(pagina)) === 'Carga: 22 de 22', `la carga vuelve a 22 (${await carga(pagina)})`)
  // 3. Borrar la última fila de la tabla (ya no hay nada al lado que estorbe)
  const quitar = await pagina.$$('button[aria-label^="Quitar "]')
  const nombre = await quitar.at(-1).evaluate((b) => b.getAttribute('aria-label'))
  await quitar.at(-1).click()
  await espera(200)
  if ((await texto(pagina)).includes('¿Quitar estas horas?')) await clic('Sí, quitar')
  await espera(300)
  comprobar(!(await pagina.$(`button[aria-label="${nombre}"]`)), `se puede borrar la última fila (${nombre})`)
  await foto('60-asignacion-editada', false)
  // 4. El horario refleja los cambios
  await clic('Horario', 'nav button')
  await espera(400)
  const t = await texto(pagina)
  comprobar(!t.includes('por ubicar en el horario'), 'el horario no tiene horas por ubicar')
  console.log('cruces:', (t.match(/Cruces pendientes · \d+/) ?? ['?'])[0])
}
