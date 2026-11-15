// Media técnica como jornada extra: área «Media técnica», un docente de la tarde y el horario de 10-1 con mañana intacta.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const escribir = async (pagina, el, valor) => {
  await el.evaluate((x) => x.select())
  await pagina.keyboard.type(valor)
}
const campo = (pagina, inicio, tipo = 'select') =>
  pagina.evaluateHandle((t, ty) => [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith(t)).querySelector(ty), inicio, tipo)
const elegir = (pagina, el, textoOpcion) =>
  el.evaluate((s, t) => {
    const o = [...s.options].find((x) => x.textContent.startsWith(t))
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value)
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }, textoOpcion)

export default async ({ pagina, clic, foto }) => {
  // 1. Área «Media técnica» con 6 horas en 10.° y 11.°
  await clic('Áreas e intensidad', 'nav button')
  await clic('Agregar área')
  const nombres = await pagina.$$('input[aria-label="Nombre del área"]')
  await escribir(pagina, nombres.at(-1), 'Media técnica')
  await espera(200)
  for (const g of [10, 11]) await escribir(pagina, await pagina.$(`input[aria-label="Horas de Media técnica en grado ${g}"]`), '6')
  await espera(200)
  comprobar(await pagina.$eval('input[aria-label="Media técnica es media técnica"]', (c) => c.checked), 'el área llamada «Media técnica» se reconoce sola')

  // 2. Docente de la tarde con la media técnica de 10-1, 10-2 y 11-1
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Agregar docente')
  await escribir(pagina, await campo(pagina, 'Nombre', 'input'), 'Profe Técnica')
  await elegir(pagina, await campo(pagina, 'Área de nombramiento'), 'Media técnica')
  await elegir(pagina, await campo(pagina, 'Jornada'), 'Tarde')
  await escribir(pagina, await campo(pagina, 'Carga por semana', 'input'), '18')
  await espera(300)
  await clic('Asignación académica', 'nav button')
  await clic('Profe Técnica', '.lista button')
  for (const g of ['10-1', '10-2', '11-1']) {
    await pagina.select('select[aria-label="Área nueva"]', await pagina.$eval('select[aria-label="Área nueva"]', (s) => [...s.options].find((o) => o.textContent === 'Media técnica').value))
    await pagina.select('select[aria-label="Grupo nuevo"]', await pagina.$eval('select[aria-label="Grupo nuevo"]', (s, g) => [...s.options].find((o) => o.textContent === g)?.value ?? '', g))
    await clic('Agregar', 'section.subpanel button.primario')
    await espera(300)
  }
  comprobar((await texto(pagina)).includes('Carga: 18 de 18'), 'la profe de media técnica (tarde) recibe los grupos de la mañana')

  // 3. Horario
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(400)
  console.log('tras generar:', (await texto(pagina)).match(/Cruces pendientes · \d+|No se pudo ubicar[^.]*/)?.[0])
  await clic('Por grupo', '[role=tab]')
  await pagina.select('select[aria-label="Elegir grupo"]', await pagina.$eval('select[aria-label="Elegir grupo"]', (s) => [...s.options].find((o) => o.textContent === '10-1').value))
  await espera(300)
  const tablas = await pagina.evaluate(() =>
    [...document.querySelectorAll('h4')].filter((h) => h.textContent.startsWith('Jornada')).map((h) => {
      const clases = [...h.parentElement.querySelectorAll('.clase')].map((c) => c.getAttribute('aria-label') ?? '')
      return { jornada: h.textContent, total: clases.length, tecnica: clases.filter((c) => c.startsWith('Media técnica')).length }
    }))
  console.log(JSON.stringify(tablas))
  comprobar(tablas.length === 2 && tablas[0].total === 30 && tablas[0].tecnica === 0, 'la mañana de 10-1 sigue con sus 30 horas, sin media técnica')
  comprobar(tablas[1]?.tecnica === 6, 'las 6 horas de media técnica van en la tarde')
  const dias = await pagina.evaluate(() => {
    const h = [...document.querySelectorAll('h4')].find((x) => x.textContent === 'Jornada de la tarde')
    return [...new Set([...h.parentElement.querySelectorAll('.clase')].map((c) => /\. ([^,.]+), franja/.exec(c.getAttribute('aria-label') ?? '')?.[1]))]
  })
  comprobar(dias.length === 1, `la media técnica de 10-1 va toda el mismo día (${dias.join(', ')})`)
  await pagina.evaluate(() => [...document.querySelectorAll('h4')].find((h) => h.textContent === 'Jornada de la tarde')?.scrollIntoView())
  await foto('110-media-tecnica-tarde', false)
}
