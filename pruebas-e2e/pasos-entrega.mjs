// Recorrido de entrega: lo que debe funcionar al abrir Horarios.html con doble clic.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`)
  if (!ok) fallos.push(texto)
}
const tiene = (pagina, texto) => pagina.evaluate((t) => document.body.textContent.includes(t), texto)

export default async ({ pagina, clic, foto, url }) => {
  const descargas = join(process.argv[2], 'descargas')
  rmSync(descargas, { recursive: true, force: true })
  const cdp = await pagina.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: descargas })

  // 1. Generar y comprobar que queda guardado al recargar.
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Sin cruces pendientes'), { timeout: 30000 })
  comprobar(true, 'genera el horario del ejemplo sin cruces')
  await pagina.goto(`${url}#horario`)
  await espera(300)
  comprobar(await tiene(pagina, 'Generar de nuevo'), 'el horario sigue ahí después de recargar la página')

  // 2. Excel.
  await clic('Excel')
  await espera(1500)
  const excel = readdirSync(descargas).find((f) => f.endsWith('.xlsx'))
  comprobar(!!excel && readFileSync(join(descargas, excel)).subarray(0, 2).toString() === 'PK', `descarga un Excel válido (${excel})`)

  // 3. Respaldo: guardar, borrar todo y volver a abrirlo.
  await clic('Guardar respaldo')
  await espera(1000)
  const respaldo = readdirSync(descargas).find((f) => f.endsWith('.json'))
  comprobar(!!respaldo && existsSync(join(descargas, respaldo)), `guarda el respaldo (${respaldo})`)
  await clic('Empezar con mi colegio')
  await clic('Sí, borrar el ejemplo')
  await clic('Grupos, docentes y aulas')
  comprobar(await tiene(pagina, 'Todavía no hay grupos'), 'empezar con mi colegio borra el ejemplo')
  const entrada = await pagina.$('input[type=file]')
  await entrada.uploadFile(join(descargas, respaldo))
  await espera(400)
  await clic('Sí, abrir el respaldo')
  await clic('Horario', 'nav button')
  comprobar(await tiene(pagina, 'Generar de nuevo'), 'abrir el respaldo recupera el colegio con su horario')

  // 4. Un archivo que no es respaldo se rechaza sin tocar los datos.
  await entrada.uploadFile(join(descargas, excel))
  await espera(400)
  comprobar(await tiene(pagina, 'no es un respaldo'), 'rechaza un archivo que no es un respaldo')
  comprobar(await tiene(pagina, 'Generar de nuevo'), 'y conserva los datos actuales')

  // 5. Pantallas en un portátil pequeño y en celular.
  await pagina.setViewport({ width: 1280, height: 720 })
  await foto('30-horario-1280', false)
  const desborda = await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  comprobar(!desborda, 'a 1280 px no hay desplazamiento horizontal de la página')
  await pagina.setViewport({ width: 390, height: 844 })
  await foto('31-horario-390', false)
  comprobar(!(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'a 390 px no hay desplazamiento horizontal de la página')

  console.log(fallos.length ? `\n${fallos.length} FALLAS` : '\nRecorrido de entrega completo, sin fallas')
}
