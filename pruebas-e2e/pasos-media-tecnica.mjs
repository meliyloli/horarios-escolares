// Media técnica: se marca en Áreas e intensidad y no cuenta en el máximo de 30 horas del grupo.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)

export default async ({ pagina, clic }) => {
  await clic('Áreas e intensidad', 'nav button')
  await pagina.click('input[aria-label="Tecnología e Informática es media técnica"]')
  await espera(200)
  const tabla = await pagina.evaluateHandle(() => [...document.querySelectorAll('section.pila')].find((s) => s.textContent.startsWith('Intensidad horaria')))
  await tabla.screenshot({ path: `${process.argv[2]}/109-media-tecnica.png` })
  const t = await pagina.evaluate(() => document.body.textContent)
  comprobar(t.includes('+2 MT'), 'la intensidad de media técnica sale aparte del total')
  await clic('Asignación académica', 'nav button')
  await clic('Por grupo', '[role=tab]')
  await clic('10-1', '.lista button')
  await espera(200)
  const g = await pagina.evaluate(() => document.body.textContent)
  comprobar(g.includes('Media técnica, aparte: 2 de 2 horas'), 'el grupo muestra la media técnica aparte del máximo')
}
