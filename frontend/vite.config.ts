import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Convencion de desarrollo: el emulador de Firestore usa el 8080 (lo dice firebase.json)
// y el backend el 8090. Compartir puerto los mata a los dos. El proxy evita CORS en
// desarrollo y hace que el codigo hable siempre de rutas relativas: en produccion
// apunta al Cloud Run con VITE_API y no cambia nada mas.
//
// El modo demo vive en .env.demo y no en una variable suelta delante del comando: una
// variable que no llega se nota tarde y mal -- compila, arranca, y la demo sale pidiendo
// un backend que no existe. Con `--mode demo` el fichero o esta o no esta.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // La demo publica se sirve desde un subdirectorio. Sin base, el HTML pide
    // /assets/... desde la raiz del dominio y la pagina sale en blanco.
    base: env['VITE_BASE'] ?? '/',
    plugins: [react()],
    server: { port: 5183, proxy: { '/tablero': 'http://localhost:8090', '/sincronizar': 'http://localhost:8090', '/turnos': 'http://localhost:8090' } },
  }
})
