// Cambiar el nombre de un docente escribiendo en su ficha, con y sin horario.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

const renombrar = async (pagina, clic, foto, nombre, sufijo) => {
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic(nombre, '.lista button')
  await espera(200)
  const campo = await pagina.evaluateHandle(() => [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Nombre'))?.querySelector('input'))
  if (!campo.asElement()) return comprobar(false, 'no encontré el campo Nombre')
  await campo.asElement().focus()
  await campo.asElement().evaluate((el) => el.select())
  const inicio = Date.now()
  await pagina.keyboard.type(`${nombre} ${sufijo}`, { delay: 30 })
  await espera(400)
  const valor = await campo.asElement().evaluate((el) => el.value)
  const enfocado = await campo.asElement().evaluate((el) => el === document.activeElement)
  console.log(`escribir tardó ${Date.now() - inicio} ms; valor: «${valor}»; sigue con el cursor: ${enfocado}`)
  await foto(`95-nombre-${sufijo}`, false)
  comprobar(valor === `${nombre} ${sufijo}`, `el nombre cambia a «${nombre} ${sufijo}»`)
}

export default async ({ pagina, clic, foto }) => {
  await renombrar(pagina, clic, foto, 'Luz Marina Restrepo', 'Uno')
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await espera(300)
  await renombrar(pagina, clic, foto, 'Jorge Iván Cardona', 'Dos')
}

// Con la app abierta en dos pestañas, escribir en una no debe deshacerse por la otra.
export const dosPestanas = async ({ pagina, clic, foto, url }) => {
  const otra = await pagina.browser().newPage()
  await otra.goto(url)
  await espera(500)
  await pagina.bringToFront()
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Luz Marina Restrepo', '.lista button')
  await espera(200)
  const campo = await pagina.evaluateHandle(() => [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Nombre'))?.querySelector('input'))
  await campo.asElement().focus()
  await campo.asElement().evaluate((el) => el.select())
  await pagina.keyboard.type('Luz Marina Restrepo Nueva', { delay: 40 })
  await espera(1500)
  const valor = await campo.asElement().evaluate((el) => el.value)
  console.log(`valor: «${valor}»`)
  comprobar(valor === 'Luz Marina Restrepo Nueva', 'con otra pestaña abierta el nombre queda como se escribió')
  const enLaOtra = await otra.evaluate(() => localStorage.getItem('horarios-escolares')?.includes('Luz Marina Restrepo Nueva'))
  comprobar(!!enLaOtra, 'lo guardado tiene el nombre nuevo')
  await otra.close()
}

// Desde la asignación académica: «Cambiar nombre» en la ficha del docente.
export const asignacion = async ({ pagina, clic, foto }) => {
  await clic('Asignación académica', 'nav button')
  await clic('Carlos Mario Giraldo', '.lista button')
  await clic('Cambiar nombre')
  const campo = await pagina.$('input[aria-label="Nombre nuevo"]')
  await campo.evaluate((el) => el.select())
  await pagina.keyboard.type('Carlos M. Giraldo', { delay: 20 })
  await foto('96-cambiar-nombre', false)
  await clic('Guardar nombre')
  await espera(200)
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('Carlos M. Giraldo') && !t.includes('Carlos Mario Giraldo'), 'el nombre cambia en la asignación y en la lista')
}
