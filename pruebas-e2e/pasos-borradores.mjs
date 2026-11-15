// Reglas de hora libre diaria y carga pareja, descarga del PDF y borradores del horario.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (pagina) => pagina.evaluate(() => document.body.textContent)
const comprobar = (ok, t) => console.log(`${ok ? 'OK   ' : 'FALLA'} ${t}`)
const marcar = (pagina, inicio) =>
  pagina.evaluate((t) => [...document.querySelectorAll('label.marca')].find((l) => l.textContent.trim().startsWith(t)).querySelector('input').click(), inicio)
const generar = async (pagina, clic, boton) => {
  await clic(boton)
  if ((await texto(pagina)).includes('¿Generar el horario de nuevo?')) await clic('Sí, generar de nuevo')
  await pagina.waitForFunction(() => /Cruces pendientes|No se pudo ubicar/.test(document.body.textContent), { timeout: 30000 })
  await espera(300)
}

export default async ({ pagina, clic, foto }) => {
  // 1. Carga pareja
  await clic('Colegio', 'nav button')
  await marcar(pagina, 'Carga pareja')
  await espera(200)
  await foto('80-reglas', false)
  await clic('Horario', 'nav button')
  await generar(pagina, clic, 'Generar horario')
  const t = await texto(pagina)
  comprobar(t.includes('Sin cruces pendientes') && !t.includes('no está pareja'), 'con carga pareja el horario sale sin cruces')

  // 2. Hora libre diaria: Óscar entra a la 3.ª franja dos días y sus 22 horas no caben
  await clic('Colegio', 'nav button')
  await marcar(pagina, 'Una hora libre todos los días')
  await clic('Horario', 'nav button')
  await generar(pagina, clic, 'Generar de nuevo')
  const d = await texto(pagina)
  comprobar(d.includes('dejando una hora libre cada día, solo caben 21'), 'explica por qué no cabe Óscar con la hora libre diaria')
  comprobar(d.includes('Desactivar la regla de una hora libre todos los días.'), 'propone desactivar la regla')
  await foto('81-diagnostico-hora-libre', false)
  await clic('Cerrar sin cambiar nada')

  // 3. PDF de todos los grupos
  const carpeta = resolve('pruebas-e2e/descargas')
  rmSync(carpeta, { recursive: true, force: true })
  mkdirSync(carpeta)
  const cdp = await pagina.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: carpeta })
  await pagina.select('select[aria-label="Qué imprimir o exportar"]', 'todos')
  await clic('PDF', 'header button')
  for (let i = 0; i < 40 && !existsSync(`${carpeta}/Horarios por grupo.pdf`); i++) await espera(250)
  const pdf = existsSync(`${carpeta}/Horarios por grupo.pdf`) ? readFileSync(`${carpeta}/Horarios por grupo.pdf`) : null
  const hojas = pdf ? (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length : 0
  comprobar(pdf?.subarray(0, 4).toString() === '%PDF' && hojas === 16, `descarga «Horarios por grupo.pdf» con 16 hojas (${readdirSync(carpeta).join(', ')}; ${hojas} hojas)`)
  await pagina.select('select[aria-label="Qué imprimir o exportar"]', 'uno')
  await clic('PDF', 'header button')
  for (let i = 0; i < 40 && readdirSync(carpeta).length < 2; i++) await espera(250)
  comprobar(readdirSync(carpeta).some((f) => /^Horario Grupo .+\.pdf$/.test(f)), `descarga el PDF de un solo grupo (${readdirSync(carpeta).join(', ')})`)

  // 4. Borradores
  await clic('Nueva versión')
  await pagina.$eval('input[type=text]', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Opción con bloques')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await foto('82-nuevo-borrador', false)
  await clic('Crear versión')
  await espera(300)
  comprobar((await texto(pagina)).includes('Versión: Opción con bloques'), 'el riel dice en qué versión se trabaja')
  await clic('Asignación académica', 'nav button')
  comprobar((await texto(pagina)).includes('Versión en uso: Opción con bloques'), 'la asignación muestra la versión en uso')
  await clic('Colegios y versiones', 'nav button')
  await espera(200)
  await foto('83-borradores', false)
  await clic('Abrir Horario principal')
  await espera(300)
  comprobar(await pagina.evaluate(() => [...document.querySelectorAll('.tabla-versiones tr[aria-current]')].some((tr) => tr.textContent.includes('Horario principal'))), 'vuelve al horario principal')
  rmSync(carpeta, { recursive: true, force: true })
}

// Sábana: todos los grupos y todos los docentes juntos en una tabla, en PDF.
export const sabana = async ({ pagina, clic }) => {
  const { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  await clic('Horario', 'nav button')
  await clic('Generar horario')
  await pagina.waitForFunction(() => document.body.textContent.includes('Cruces pendientes'), { timeout: 30000 })
  const carpeta = resolve('pruebas-e2e/descargas')
  rmSync(carpeta, { recursive: true, force: true })
  mkdirSync(carpeta)
  const cdp = await pagina.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: carpeta })
  await pagina.select('select[aria-label="Qué imprimir o exportar"]', 'tabla')
  await clic('PDF', 'header button')
  await clic('Por docente', '[role=tab]')
  await clic('PDF', 'header button')
  for (let i = 0; i < 40 && readdirSync(carpeta).length < 2; i++) await espera(250)
  for (const nombre of ['Horario de todos los grupos.pdf', 'Horario de todos los docentes.pdf']) {
    const ok = existsSync(`${carpeta}/${nombre}`) && readFileSync(`${carpeta}/${nombre}`).subarray(0, 4).toString() === '%PDF'
    comprobar(ok, `descarga «${nombre}» (${readdirSync(carpeta).join(', ')})`)
  }
  rmSync(carpeta, { recursive: true, force: true })
}
