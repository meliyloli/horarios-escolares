// Guarda una copia de la app para abrirla sin internet. Siempre intenta la red primero: así cada publicación
// llega de inmediato y la copia solo se usa cuando no hay conexión.
const CACHE = 'horarios-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((llaves) => Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (ev) => {
  const { request } = ev
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  ev.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((c) => c.put(request, copia))
        }
        return respuesta
      })
      .catch(async () => (await caches.match(request)) ?? (request.mode === 'navigate' ? caches.match('./') : undefined)),
  )
})
