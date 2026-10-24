/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AUTH_URL: string
  readonly VITE_AUTH_KEY: string
  readonly VITE_API_URL?: string
  /** 'true' solo en desarrollo local: muestra «Crear cuenta». En producción las cuentas las crea la administración. */
  readonly VITE_REGISTRO_PUBLICO?: string
  readonly VITE_PUSH_HABILITADO?: string
}
