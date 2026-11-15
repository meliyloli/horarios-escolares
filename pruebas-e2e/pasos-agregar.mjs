// Agregar cosas nuevas abriendo el archivo directamente (file://): ahí es donde corre la app de verdad.
export default async ({ pagina, clic }) => {
  const seguro = await pagina.evaluate(() => `contexto seguro: ${isSecureContext}, randomUUID: ${typeof crypto.randomUUID}`)
  console.log(seguro)
  await clic('Áreas e intensidad')
  await clic('Agregar área')
  await clic('Grupos, docentes y aulas')
  await clic('Agregar grupo')
  await clic('Docentes (')
  await clic('Agregar docente')
  await clic('Aulas (')
  await clic('Agregar aula')
  const cuenta = await pagina.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent).join(' | '))
  console.log(cuenta === 'Grupos (17) | Docentes (21) | Aulas (17)' ? 'OK    agrega área, grupo, docente y aula' : `FALLA al agregar: ${cuenta}`)
}
