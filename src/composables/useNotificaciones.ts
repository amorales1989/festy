import { ref } from 'vue'
import { traducirError } from '@/lib/errores'

export interface Notificacion {
  id: number
  tipo: 'exito' | 'error' | 'info'
  texto: string
}

const notificaciones = ref<Notificacion[]>([])
let siguiente = 1

export function useNotificaciones() {
  function agregar(tipo: Notificacion['tipo'], texto: string, ms = tipo === 'error' ? 7000 : 3500) {
    const id = siguiente++
    notificaciones.value.push({ id, tipo, texto })
    setTimeout(() => cerrar(id), ms)
  }
  function cerrar(id: number) {
    notificaciones.value = notificaciones.value.filter((n) => n.id !== id)
  }
  return {
    notificaciones,
    cerrar,
    exito: (texto: string) => agregar('exito', texto),
    info: (texto: string) => agregar('info', texto),
    error: (e: unknown) => agregar('error', traducirError(e)),
  }
}
