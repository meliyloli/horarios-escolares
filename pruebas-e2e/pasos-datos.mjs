export default async ({ clic, foto }) => {
  await foto('1-colegio')
  await clic('Áreas e intensidad')
  await foto('2-areas')
  await clic('Grupos, docentes y aulas')
  await foto('3-grupos')
  await clic('Docentes (')
  await clic('Óscar Darío Vélez')
  await foto('4-docente')
  await clic('Borrar docente')
  await foto('5-confirmar', false)
}
