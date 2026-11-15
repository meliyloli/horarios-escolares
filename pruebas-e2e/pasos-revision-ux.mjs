// Recorrido para revisión de experiencia: captura cada pantalla con horario generado.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export default async ({ pagina, clic, foto }) => {
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(4500)
  await foto('ux-1-horario', false)
  await clic('Grupos, docentes y aulas', 'nav button')
  await clic('Docentes', '[role=tab]')
  await clic('Carlos Mario Giraldo', '.lista button')
  await foto('ux-2-docente', false)
  await clic('Asignación académica', 'nav button')
  await foto('ux-3-asignacion', false)
  await clic('Incapacidades', 'nav button')
  await foto('ux-4-incapacidades', false)
  await clic('Colegios y versiones', 'nav button')
  await foto('ux-5-versiones', false)
  const tiempos = await pagina.evaluate(() => {
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) document.querySelector('nav button')?.getBoundingClientRect()
    return performance.now() - t0
  })
  console.log('ok', tiempos)
}
