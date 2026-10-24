// Acciones globales (p. ej. "Nueva reserva" desde cualquier pantalla) y un
// contador de versión que las vistas observan para refrescar sus datos.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PrecargaReserva {
  fecha?: string
  horaInicio?: string
  horaFin?: string
  espacioId?: string
  clienteId?: string
}

export const useAcciones = defineStore('acciones', () => {
  const reservaAbierta = ref(false)
  const reservaId = ref<string | null>(null)
  const precarga = ref<PrecargaReserva>({})
  const version = ref(0)

  function nuevaReserva(datos: PrecargaReserva = {}) {
    reservaId.value = null
    precarga.value = datos
    reservaAbierta.value = true
  }
  function editarReserva(id: string) {
    reservaId.value = id
    precarga.value = {}
    reservaAbierta.value = true
  }
  const entrevistaAbierta = ref(false)
  const entrevistaId = ref<string | null>(null)
  const precargaEntrevista = ref<{ fecha?: string; hora?: string; clienteId?: string }>({})
  function nuevaEntrevista(datos: { fecha?: string; hora?: string; clienteId?: string } = {}) {
    entrevistaId.value = null
    precargaEntrevista.value = datos
    entrevistaAbierta.value = true
  }
  function verEntrevista(id: string) {
    entrevistaId.value = id
    precargaEntrevista.value = {}
    entrevistaAbierta.value = true
  }
  function cambiosGuardados() {
    version.value++
  }
  return { reservaAbierta, reservaId, precarga, version, nuevaReserva, editarReserva, cambiosGuardados,
    entrevistaAbierta, entrevistaId, precargaEntrevista, nuevaEntrevista, verEntrevista }
})
