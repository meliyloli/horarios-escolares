import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Solo en la versión publicada (https): guarda una copia para abrir la app sin internet e instalarla en el celular.
// Abierta como archivo en el computador no aplica, y si el navegador no lo soporta no pasa nada.
if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => undefined)
