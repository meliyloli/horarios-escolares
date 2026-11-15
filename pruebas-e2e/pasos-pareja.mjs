// Un horario hecho sin la regla de carga pareja se empareja solo al activarla, y con el botón tras mover a mano.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const moverPrimeraAlFinal = async (pagina, n) => {
  await (await pagina.$$('.horario button.clase'))[n].click()
  await espera(200)
  await (await pagina.$$('button.celda.destino')).at(-1).click()
  await espera(300)
}

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await espera(4500)
  await clic('Colegio', 'nav button')
  await pagina.evaluate(() => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith('Carga pareja')).querySelector('input').click())
  await espera(300)
  console.log('aviso:', await pagina.evaluate(() => document.querySelector('.brindis')?.textContent ?? ''))
  await clic('Horario', 'nav button')
  await espera(300)
  const t = await texto(pagina)
  comprobar(!t.includes('no está pareja') && t.includes('Sin cruces pendientes'), 'al activar la regla el horario queda parejo y sin cruces')

  // Desemparejar a mano: dos clases de un docente pasan al viernes en la última franja libre.
  await clic('Por docente', '[role=tab]')
  await moverPrimeraAlFinal(pagina, 0)
  await moverPrimeraAlFinal(pagina, 1)
  const conAviso = (await texto(pagina)).includes('no está pareja')
  console.log('tras mover a mano, aviso de carga dispareja:', conAviso)
  if (conAviso) {
    await foto('90-dispareja', false)
    await clic('Emparejar la carga')
    await espera(400)
    comprobar(!(await texto(pagina)).includes('no está pareja'), '«Emparejar la carga» la corrige')
    await foto('91-emparejada', false)
  }
}
