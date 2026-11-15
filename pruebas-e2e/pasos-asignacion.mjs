export default async ({ pagina, clic, foto }) => {
  await clic('Asignación académica')
  await clic('Juan David Henao')
  // Escribir en un campo de horas no debe perder el foco.
  const campo = await pagina.$('table.datos input[type=number]')
  await campo.click()
  await campo.evaluate((el) => el.select())
  await pagina.keyboard.type('12')
  const activo = await pagina.evaluate(() => `${document.activeElement?.tagName} valor=${document.activeElement?.value}`)
  console.log(activo === 'INPUT valor=12' ? 'el campo conserva el foco' : `ERROR: foco en ${activo}`)
  await foto('6-asignacion-docente')
  await clic('Por grupo', '[role=tab]')
  await foto('7-asignacion-grupo')
}
