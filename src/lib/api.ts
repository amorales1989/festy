// Cliente de la API de Festy (Festy-back). Todos los datos pasan por acá:
// el front ya no consulta tablas; la API ejecuta stored procedures que validan
// permisos y aislamiento en la base. supabase-js queda solo para la sesión.
import { supabase } from './supabase'

const configurada = import.meta.env.VITE_API_URL as string | undefined
// 'mismo-origen': la API se sirve bajo /api en la misma dirección que la app (demo por túnel).
const BASE = (!configurada || configurada === 'mismo-origen' ? `${window.location.origin}/api` : configurada).replace(/\/$/, '')

/** Error con la forma { code, message, details, hint } que devuelve la API (igual que PostgREST). */
export class ErrorApi extends Error {
  code?: string
  details?: string | null
  hint?: string | null
  status: number
  constructor(status: number, cuerpo: { code?: string; message?: string; details?: string | null; hint?: string | null } | null) {
    super(cuerpo?.message ?? `Error ${status}`)
    this.status = status
    this.code = cuerpo?.code
    this.details = cuerpo?.details
    this.hint = cuerpo?.hint
  }
}

type Consulta = Record<string, string | number | boolean | null | undefined>

/** Arma ?a=1&b=2 omitiendo null/undefined. */
export function consulta(parametros: Consulta): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(parametros)) if (v !== undefined && v !== null) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  const texto = r.status === 204 ? '' : await r.text()
  let json: unknown = null
  try { json = texto ? JSON.parse(texto) : null } catch { json = null }
  if (!r.ok) throw new ErrorApi(r.status, json as ConstructorParameters<typeof ErrorApi>[1])
  return json as T
}

export const api = {
  get: <T>(ruta: string, parametros?: Consulta) => pedir<T>('GET', ruta + (parametros ? consulta(parametros) : '')),
  post: <T = void>(ruta: string, cuerpo: unknown = {}) => pedir<T>('POST', ruta, cuerpo),
  put: <T = void>(ruta: string, cuerpo: unknown = {}) => pedir<T>('PUT', ruta, cuerpo),
  patch: <T = void>(ruta: string, cuerpo: unknown = {}) => pedir<T>('PATCH', ruta, cuerpo),
  delete: <T = void>(ruta: string) => pedir<T>('DELETE', ruta),
}

/** Ruta de un recurso de la organización: org('reservas') → /organizaciones/<id>/reservas */
export const rutaOrg = (orgId: string, resto = '') => `/organizaciones/${orgId}${resto ? `/${resto}` : ''}`

/** Borrado genérico (la lista de entidades permitidas la valida la base). */
export const eliminar = (entidad: string, id: string) => api.delete(`/registros/${entidad}/${id}`)
/** Activar/desactivar (sucursales, espacios, servicios, recursos). */
export const activar = (entidad: string, id: string, activo: boolean) => api.patch(`/registros/${entidad}/${id}/activo`, { activo })
