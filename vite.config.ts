import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const SUPABASE_LOCAL = 'http://127.0.0.1:64321'
const API_LOCAL = process.env.API_LOCAL ?? 'http://127.0.0.1:4000'

/**
 * Demo pública por túnel: la app, la autenticación y la API de Festy salen por la misma dirección.
 * El Supabase local usa claves de desarrollo conocidas públicamente, así que se
 * rechaza todo pedido con privilegios de administrador (clave secreta o JWT con
 * rol service_role). Solo pasa lo que hace un usuario normal, que está limitado por RLS.
 */
function esPedidoAdministrativo(req: IncomingMessage): boolean {
  const apikey = String(req.headers.apikey ?? '')
  if (apikey.startsWith('sb_secret_')) return true
  for (const valor of [apikey, String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')]) {
    const partes = valor.split('.')
    if (partes.length !== 3) continue
    try {
      const carga = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8')) as { role?: string }
      if (carga.role === 'service_role' || carga.role === 'supabase_admin') return true
    } catch { /* token ilegible: lo valida Supabase */ }
  }
  return false
}
const proxySupabase: ProxyOptions = {
  target: SUPABASE_LOCAL,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req, res) => {
      if (esPedidoAdministrativo(req)) {
        proxyReq.destroy()
        const r = res as ServerResponse
        if (!r.headersSent) { r.writeHead(403, { 'Content-Type': 'application/json' }); r.end('{"message":"Acceso administrativo bloqueado en la demo"}') }
      }
    })
  },
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  // Solo para la demo publicada por túnel (pnpm demo:publicar): expone únicamente
  // la autenticación y la API de Festy (stored procedures), nunca PostgREST, Studio ni la base.
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: true,
    proxy: { '/auth/v1': proxySupabase, '/api': { target: API_LOCAL, changeOrigin: true } },
  },
})
