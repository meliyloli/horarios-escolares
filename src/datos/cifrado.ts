// Los datos de un colegio en línea viajan y se guardan cifrados con su código: sin el código no se pueden leer,
// ni siquiera desde la consola de la base de datos. El código nunca sale del navegador.

/** Sin mayúsculas, espacios ni guiones: «Feya 2026-abcd» y «FEYA2026ABCD» son el mismo código. */
export const normalizarCodigo = (codigo: string): string => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')

const bytes = (texto: string) => new TextEncoder().encode(texto)
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const aBase64 = (datos: Uint8Array) => {
  let s = ''
  for (let i = 0; i < datos.length; i += 0x8000) s += String.fromCharCode(...datos.subarray(i, i + 0x8000))
  return btoa(s)
}
const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
const pasar = async (datos: Uint8Array<ArrayBuffer>, flujo: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Response(datos).body!.pipeThrough(flujo)).arrayBuffer())

/** Dónde se guarda el colegio en la nube: sale del código, pero del identificador no se puede sacar el código. */
export const idDeCodigo = async (codigo: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', bytes(`horarios-escolares:id:${normalizarCodigo(codigo)}`)))

const clave = async (codigo: string): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', bytes(normalizarCodigo(codigo)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 150_000, salt: bytes(`horarios-escolares:clave:${await idDeCodigo(codigo)}`) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

/** Comprime y cifra un texto: el resultado es «iv + datos cifrados» en base64. */
export const cerrarSobre = async (texto: string, codigo: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const comprimido = await pasar(bytes(texto), new CompressionStream('gzip'))
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await clave(codigo), comprimido))
  const todo = new Uint8Array(iv.length + cifrado.length)
  todo.set(iv)
  todo.set(cifrado, iv.length)
  return aBase64(todo)
}

export const abrirSobre = async (sobre: string, codigo: string): Promise<string> => {
  const todo = deBase64(sobre)
  let comprimido: Uint8Array<ArrayBuffer>
  try {
    comprimido = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: todo.subarray(0, 12) }, await clave(codigo), todo.subarray(12)))
  } catch {
    throw new Error('No se pudieron abrir los datos con ese código.')
  }
  return new TextDecoder().decode(await pasar(comprimido, new DecompressionStream('gzip')))
}
