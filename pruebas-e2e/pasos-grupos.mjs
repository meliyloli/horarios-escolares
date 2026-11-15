// Vista por grupo de la asignación: materias, docentes, materia compartida, exceso de horas y asignar lo que falta.
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comprobar = (ok, texto) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${texto}`)
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)

export default async ({ pagina, clic, foto }) => {
  // Se quitan 3 horas de Matemáticas de Carlos en 6-1 y se le dan 3 a Gloria: queda compartida. Y 7-1 recibe 2 horas de más.
  await pagina.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('horarios-escolares'))
    const mat = e.asignaciones.find((a) => a.id === 'd6-6-1-mat')
    mat.horas = 2
    e.asignaciones.push({ id: 'x1', docenteId: 'd7', grupoId: 'g6-1', areaId: 'mat', horas: 3 }, { id: 'x2', docenteId: 'd7', grupoId: 'g7-1', areaId: 'efi', horas: 2 })
    localStorage.setItem('horarios-escolares', JSON.stringify(e))
  })
  await pagina.reload()
  await espera(300)
  await clic('Asignación académica')
  await clic('Por grupo', '[role=tab]')
  await clic('6-1', '.lista button')
  await espera(200)
  await foto('50-grupo-compartida')
  let t = await texto(pagina)
  comprobar(t.includes('Matemáticas en 6-1 la dictan 2 docentes: Carlos Mario Giraldo (2 h) y Gloria Inés Arango (3 h). Suman 5 de 5 horas.'), 'avisa la materia compartida y que la suma coincide')
  comprobar(t.includes('Compartida'), 'marca la materia como compartida')
  await clic('7-1', '.lista button')
  await espera(200)
  t = await texto(pagina)
  comprobar(t.includes('El grupo 7-1 tiene 32 horas por semana asignadas; en bachillerato el máximo es 30.'), 'avisa el grupo con más de 30 horas')
  comprobar(t.includes('Sobran 2'), 'muestra cuántas horas sobran en la materia')
  await foto('51-grupo-exceso')
  await clic('Grupos, docentes y aulas')
  await foto('52-grupos-horas')
  comprobar((await texto(pagina)).includes('32/30'), 'la lista de grupos muestra 32/30 en 7-1')
}
