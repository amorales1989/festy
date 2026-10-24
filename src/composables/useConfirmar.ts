import { ref } from 'vue'

export interface OpcionesConfirmacion {
  titulo: string
  mensaje: string
  confirmar?: string
  peligro?: boolean
  /** Si se indica, hay que escribir este texto para habilitar el botón. */
  textoRequerido?: string
  /** Si se indica, se pide un texto libre obligatorio (p. ej. un motivo). */
  etiquetaTexto?: string
}

const pendiente = ref<(OpcionesConfirmacion & { resolver: (r: string | null) => void }) | null>(null)

export function useConfirmar() {
  /** Pide confirmación. Resuelve true/false. */
  function confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
    return new Promise((resolver) => {
      pendiente.value = { ...opciones, etiquetaTexto: undefined, resolver: (r) => resolver(r !== null) }
    })
  }
  /** Pide un texto obligatorio (motivo). Resuelve el texto o null si se cancela. */
  function pedirTexto(opciones: OpcionesConfirmacion & { etiquetaTexto: string }): Promise<string | null> {
    return new Promise((resolver) => {
      pendiente.value = { ...opciones, resolver }
    })
  }
  function responder(r: string | null) {
    pendiente.value?.resolver(r)
    pendiente.value = null
  }
  return { pendiente, confirmar, pedirTexto, responder }
}
