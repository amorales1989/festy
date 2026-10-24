import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/tipos/database'

// Cliente de autenticación. VITE_AUTH_URL es el servidor de cuentas (GoTrue)
// que corre en el propio VPS junto a la API y la base; supabase-js se usa solo
// como librería para hablarle (login, registro, recuperación, sesión).
// 'mismo-origen': se sirve en la misma dirección que la app (demo por túnel).
const urlConfigurada = import.meta.env.VITE_AUTH_URL as string | undefined
const url = urlConfigurada === 'mismo-origen' ? window.location.origin : urlConfigurada
const clave = import.meta.env.VITE_AUTH_KEY as string | undefined

if (!url || !clave) {
  throw new Error('Faltan VITE_AUTH_URL y VITE_AUTH_KEY. Copiá .env.example a .env.local y completalo.')
}

export const supabase = createClient<Database>(url, clave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export type Tablas = Database['public']['Tables']
export type Fila<T extends keyof Tablas> = Tablas[T]['Row']
export type EstadoReserva = Database['public']['Enums']['estado_reserva']
export type EstadoContrato = Database['public']['Enums']['estado_contrato']
