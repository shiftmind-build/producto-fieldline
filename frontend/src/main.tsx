import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { modoDemo } from './api'
import { DEMO } from './demo'

// Con VITE_DEMO=1 las pantallas leen de src/demo.ts en vez de la red. Es lo que se
// publica en la web como demo publica; el producto entregado se construye sin ella.
if (import.meta.env['VITE_DEMO'] === '1') modoDemo(DEMO)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
