import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/tipos/database'

// 'mismo-origen': la API de Supabase se sirve en la misma dirección que la app
// (demo publicada por túnel, con proxy en vite preview).
const urlConfigurada = import.meta.env.VITE_SUPABASE_URL as string | undefined
const url = urlConfigurada === 'mismo-origen' ? window.location.origin : urlConfigurada
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !clave) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completalo.')
}

export const supabase = createClient<Database>(url, clave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export type Tablas = Database['public']['Tables']
export type Fila<T extends keyof Tablas> = Tablas[T]['Row']
export type EstadoReserva = Database['public']['Enums']['estado_reserva']
export type EstadoContrato = Database['public']['Enums']['estado_contrato']
