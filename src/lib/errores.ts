// Traduce errores de Supabase/PostgreSQL a mensajes comprensibles en español.
// Las funciones de la base ya devuelven mensajes en español para reglas de
// negocio (P0001, 23P01 con hint, 42501, 23514): se respetan tal cual.

interface ErrorLike {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
  name?: string
}

const AUTH: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'El email o la contraseña no son correctos.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu email. Revisá tu casilla.'],
  [/user already registered/i, 'Ya existe una cuenta con ese email. Probá ingresar o recuperar la contraseña.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/new password should be different/i, 'La nueva contraseña debe ser distinta de la anterior.'],
  [/rate limit|too many requests/i, 'Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.'],
  [/unable to validate email|invalid email/i, 'El email no es válido.'],
  [/jwt expired|session.*(missing|expired)/i, 'Tu sesión venció. Volvé a ingresar.'],
  [/signups not allowed/i, 'El registro de nuevas cuentas está deshabilitado.'],
]

function esEspanol(texto: string): boolean {
  return /[áéíóúñ¿¡]|\b(el|la|los|las|no|de|tu|una?|para|con)\b/i.test(texto) && !/violates|duplicate key|permission denied/i.test(texto)
}

export function traducirError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.'
  if (typeof error === 'string') return error
  const e = error as ErrorLike
  const msg = e.message ?? ''

  for (const [re, texto] of AUTH) if (re.test(msg)) return texto
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.'
  }

  switch (e.code) {
    case '23P01':
      return esEspanol(msg) ? msg : 'Ese espacio ya está ocupado en el horario elegido (otra persona lo reservó recién). Elegí otro horario o espacio.'
    case '23505':
      return 'Ya existe un registro con esos datos.'
    case '23503':
      return /delete|update or delete/i.test(msg)
        ? 'No se puede eliminar porque tiene información asociada (por ejemplo, reservas). Podés desactivarlo.'
        : 'Uno de los datos relacionados no existe o no pertenece a tu organización.'
    case '23502':
      return 'Falta completar un dato obligatorio.'
    case '23514':
      return esEspanol(msg) ? msg : 'Alguno de los datos no es válido. Revisá el formulario.'
    case '22P02':
    case '22007':
    case '22008':
      return 'Hay un dato con formato inválido.'
    case '42501':
      return esEspanol(msg) ? msg : 'No tenés permiso para realizar esta acción.'
    case 'PGRST116':
      return 'No se encontró el registro o no tenés acceso.'
    case 'P0001':
    case 'P0002':
    case '22023':
    case '28000':
      return msg
  }
  if (e.status === 401) return 'Tu sesión venció. Volvé a ingresar.'
  if (e.status === 403) return 'No tenés permiso para realizar esta acción.'
  return esEspanol(msg) ? msg : 'Ocurrió un error inesperado. Si persiste, contactá a soporte.'
}

export function esLimitePlan(error: unknown): boolean {
  return (error as ErrorLike | null)?.hint === 'LIMITE_PLAN'
}
