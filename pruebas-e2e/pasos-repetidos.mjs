// Una versión importada con docentes repetidos (como quedaba antes de emparejar nombres) se arregla uniéndolos.
// Uso: HORARIO_PDF=<PDF> RESPALDO=<respaldo .json> [UNIR_A_MANO='Nombre en el PDF>Nombre en el colegio'] PASOS=./pasos-repetidos.mjs node pruebas-e2e/captura.mjs <carpeta>
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const crucesDeCarga = async (pagina) => (await texto(pagina)).match(/tiene 0 clases en el horario/g)?.length ?? 0

export default async ({ pagina, clic, foto }) => {
  const entrada = await pagina.$('input[type=file][accept^=".json"]')
  await entrada.uploadFile(resolve(process.env.RESPALDO))
  await espera(400)
  await clic('Sí, abrir el respaldo')
  await clic('Colegios y versiones', 'nav button')
  await (await pagina.$('input[aria-label="Horario general en PDF"]')).uploadFile(resolve(process.env.HORARIO_PDF))
  await pagina.waitForFunction(() => document.body.textContent.includes('Horario leído del PDF'), { timeout: 30000 })
  // Como antes: los cuatro nombres distintos entran como docentes nuevos.
  for (const s of await pagina.$$('select[aria-label^="Docente del colegio para"]')) await s.select('')
  await espera(200)
  await clic('Crear versión')
  await espera(400)
  await clic('Horario', 'nav button')
  await espera(400)
  console.log('antes de unir, docentes con 0 clases:', await crucesDeCarga(pagina))
  const pares = await pagina.evaluate(() => [...document.querySelectorAll('[aria-label="Docentes repetidos"] li')].map((li) => li.textContent.replace('Unir', '').trim()))
  for (const p of pares) console.log('  repetido:', p)
  await foto('102-repetidos', false)
  await clic(`Unir los ${pares.length}`)
  await espera(500)
  console.log('aviso:', await pagina.evaluate(() => document.querySelector('.brindis')?.textContent ?? ''))

  // Dos nombres demasiado distintos para proponerlos solos se unen a mano desde la ficha del docente.
  const [origen, destino] = (process.env.UNIR_A_MANO ?? '').split('>')
  if (origen && destino) {
    await clic('Grupos, docentes y aulas', 'nav button')
    await clic('Docentes', '[role=tab]')
    await clic(origen, '.lista button')
    const id = await pagina.evaluate((d) => [...document.querySelectorAll('label.campo select option')].find((o) => o.textContent === d)?.value, destino)
    await pagina.evaluate((v) => {
      const s = [...document.querySelectorAll('label.campo')].find((l) => l.textContent.startsWith('Unir con otro docente')).querySelector('select')
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, v)
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }, id)
    await clic('Unir', 'button.boton.chico')
    await clic('Sí, unir')
    await espera(400)
  }
  await clic('Horario', 'nav button')
  await espera(400)
  const quedan = await crucesDeCarga(pagina)
  comprobar(quedan === 0, `ya no hay docentes con 0 clases (${quedan})`)
  comprobar(!(await pagina.$('[aria-label="Docentes repetidos"]')), 'el aviso de repetidos desaparece')
  console.log((await texto(pagina)).match(/Cruces pendientes · \d+/)?.[0])
}
