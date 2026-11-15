// Importa un Word con asignaturas (Física, Química, Español, Geometría, Robótica), revisa a qué área van,
// lee la intensidad desde la asignación y prueba el modelo sin aulas.
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const valorSelect = (pagina, etiqueta) => pagina.$eval(`select[aria-label="${etiqueta}"]`, (s) => s.options[s.selectedIndex].textContent)

export default async ({ pagina, clic, foto }) => {
  await clic('Empezar con mi colegio')
  await clic('Sí, borrar el ejemplo')
  await clic('Asignación académica')
  await clic('Importar Word o PDF')
  const entrada = await pagina.$('input[aria-label="Documento de Word o PDF"]')
  await entrada.uploadFile(resolve('pruebas-e2e/muestras/asignaturas.docx'))
  await pagina.waitForFunction(() => document.body.textContent.includes('Lo que se va a importar'), { timeout: 20000 })
  await espera(200)
  await foto('70-asignaturas')
  comprobar((await valorSelect(pagina, 'Área de Física')) === 'Ciencias Naturales (sugerida)', 'Física se sugiere en Ciencias Naturales')
  comprobar((await valorSelect(pagina, 'Área de Química')) === 'Ciencias Naturales (sugerida)', 'Química se sugiere en Ciencias Naturales')
  comprobar((await valorSelect(pagina, 'Área de Español')) === 'Lengua Castellana (sugerida)', 'Español se sugiere en Lengua Castellana')
  comprobar((await valorSelect(pagina, 'Área de Geometría')) === 'Matemáticas (sugerida)', 'Geometría se sugiere en Matemáticas')
  comprobar((await valorSelect(pagina, 'Área de Robótica')) === 'Crear área nueva «Robótica»', 'Robótica queda como área nueva')
  // Robótica la pasa a Tecnología a mano
  await pagina.select('select[aria-label="Área de Robótica"]', 'tec')
  await espera(150)
  comprobar(!(await texto(pagina)).includes('Áreas nuevas'), 'al elegir Tecnología ya no se crea un área nueva')
  // …pero se deja como área nueva, sin intensidad, para probar la lectura de la intensidad
  await pagina.select('select[aria-label="Área de Robótica"]', 'nueva')
  await espera(150)
  await clic('Importar', 'button.primario')
  await espera(300)

  // Por grupo: 10-1 tiene Ciencias Naturales completa con dos docentes (Física 3 + Química 3 = 6)
  await clic('Por grupo', '[role=tab]')
  await clic('10-1', '.lista button')
  await espera(200)
  const t = await texto(pagina)
  comprobar(t.includes('Rubén Darío Salazar · 6 h'), 'Física y Química suman 6 h de Rubén en Ciencias Naturales')
  comprobar(t.includes('Clara Inés Toro · 4 h'), 'Español tomó las 4 h de la intensidad de Lengua Castellana')
  // Robótica es área nueva sin intensidad: se lee desde la asignación
  comprobar(t.includes('intensidad horaria está en 0'), 'avisa que hay materias con horas pero sin intensidad')
  await clic('Leer intensidad desde la asignación')
  await espera(200)
  await foto('71-leer-intensidad')
  await clic('Aplicar a la intensidad')
  await espera(200)
  comprobar(!(await texto(pagina)).includes('intensidad horaria está en 0'), 'tras leer la intensidad ya no hay materias en 0')

  // Sin aulas
  await clic('Colegio', 'nav button')
  await clic('Sin aulas', 'label')
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  await espera(300)
  const h = await texto(pagina)
  comprobar(!h.includes('Por aula') && !h.includes('Sin aula'), 'sin aulas: no hay vista por aula ni avisos de aula')
  await foto('72-sin-aulas')
}
