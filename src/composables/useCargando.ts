import { ref } from 'vue'
import { useNotificaciones } from './useNotificaciones'

/** Ejecuta una acción mostrando estado de carga y traduciendo errores. */
export function useAccion() {
  const ocupado = ref(false)
  const { error: notificarError } = useNotificaciones()
  async function ejecutar<T>(fn: () => Promise<T>, opciones: { silencioso?: boolean } = {}): Promise<T | undefined> {
    if (ocupado.value) return undefined
    ocupado.value = true
    try {
      return await fn()
    } catch (e) {
      if (!opciones.silencioso) notificarError(e)
      else throw e
      return undefined
    } finally {
      ocupado.value = false
    }
  }
  return { ocupado, ejecutar }
}
