// Media técnica como apartado propio: se activa en Colegio, un programa, grupos completos con un instructor externo
// y un grupo mezclado con un docente de planta. La mañana queda intacta y la media técnica va en la tarde.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const elegir = (pagina, etiqueta, textoOpcion) =>
  pagina.evaluate((et, t) => {
    const s = document.querySelector(`select[aria-label="${et}"]`)
    const o = [...s.options].find((x) => x.textContent.startsWith(t))
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value)
    s.dispatchEvent(new Event('change', { bubbles: true }))
  }, etiqueta, textoOpcion)
const escribir = async (pagina, selector, valor) => {
  await pagina.$eval(selector, (x) => x.select())
  await pagina.keyboard.type(valor)
}

export default async ({ pagina, clic, foto }) => {
  await clic('Colegio', 'nav button')
  await pagina.evaluate(() => [...document.querySelectorAll('label.opcion')].find((l) => l.textContent.startsWith('Sí tiene media técnica')).querySelector('input').click())
  await espera(200)
  await clic('Media técnica', 'nav button')
  await clic('Agregar programa')
  await escribir(pagina, 'input[aria-label="Nombre del programa"]', 'Sistemas')
  await espera(200)
  for (const g of ['10-1', '10-2']) await elegir(pagina, `Programa de ${g}`, 'Sistemas')
  await clic('Agregar grupo mezclado')
  await espera(200)
  await elegir(pagina, 'Grado de 10.° Sistemas', '11')
  await espera(200)
  await pagina.evaluate(() => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim() === '11-1').querySelector('input').click())
  await escribir(pagina, 'input[aria-label="Nombre del instructor externo"]', 'Instructor Técnico')
  await clic('Agregar instructor')
  await espera(200)
  for (const g of ['10-1', '10-2']) await elegir(pagina, `Quién dicta Sistemas a ${g}`, 'Instructor Técnico')
  await elegir(pagina, 'Quién dicta Sistemas a 11.° Sistemas', 'Carlos Mario Giraldo')
  await espera(300)
  await foto('120-media-tecnica', true)
  await clic('Áreas e intensidad', 'nav button')
  comprobar(!(await pagina.$$eval('input[aria-label="Nombre del área"]', (xs) => xs.some((x) => x.value === 'Sistemas'))), 'el programa no aparece entre las áreas del plan de estudios')

  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(400)
  console.log('tras generar:', (await texto(pagina)).match(/Cruces pendientes · \d+|No se pudo ubicar[^.]*/)?.[0])
  await clic('Por grupo', '[role=tab]')
  const tablas = async (g) => {
    await elegir(pagina, 'Elegir grupo', g)
    await espera(300)
    return pagina.evaluate(() => {
      const titulos = [...document.querySelectorAll('h4')].filter((h) => h.textContent.startsWith('Jornada'))
      // Con una sola jornada no hay título: se toma la tabla completa.
      const cajas = titulos.length ? titulos.map((h) => [h.textContent, h.parentElement]) : [['una jornada', document.querySelector('main')]]
      return cajas.map(([jornada, caja]) => {
        const clases = [...caja.querySelectorAll('.clase')].map((c) => c.getAttribute('aria-label') ?? '')
        const dias = new Set(clases.filter((c) => c.startsWith('Sistemas')).map((c) => /\. ([^,.]+), franja/.exec(c)?.[1]))
        return { jornada, total: clases.length, tecnica: clases.filter((c) => c.startsWith('Sistemas')).length, dias: dias.size }
      })
    })
  }
  const t101 = await tablas('10-1')
  console.log('10-1', JSON.stringify(t101))
  comprobar(t101.length === 2 && t101[0].total === 30 && t101[0].tecnica === 0, 'la mañana de 10-1 sigue con sus 30 horas, sin media técnica')
  comprobar(t101[1]?.tecnica === 6 && t101[1]?.dias === 1, 'las 6 horas de Sistemas de 10-1 van en la tarde, el mismo día')
  await foto('121-media-tecnica-10-1', false)
  const mezclado = await tablas('11.° Sistemas')
  await foto('122-media-tecnica-mezclado', false)
  console.log('cruces:', await pagina.evaluate(() => [...document.querySelectorAll('.cruce, [class*=cruce] li')].slice(0, 4).map((x) => x.textContent).join(' | ')))
  console.log('mezclado', JSON.stringify(mezclado))
  comprobar(mezclado.length === 1 && mezclado[0].tecnica === 6 && mezclado[0].dias === 1, 'el grupo mezclado tiene sus 6 horas, el mismo día')
}
