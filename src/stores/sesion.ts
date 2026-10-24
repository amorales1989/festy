import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type Fila } from '@/lib/supabase'
import { api } from '@/lib/api'

export const useSesion = defineStore('sesion', () => {
  const sesion = ref<Session | null>(null)
  const perfil = ref<Fila<'perfiles'> | null>(null)
  /** Administra la plataforma (da de alta empresas). Lo decide el servidor. */
  const esAdminPlataforma = ref(false)
  const listo = ref(false)
  let iniciando: Promise<void> | null = null

  const usuario = computed<User | null>(() => sesion.value?.user ?? null)
  const autenticado = computed(() => !!sesion.value)

  async function cargarPerfil() {
    if (!usuario.value) {
      perfil.value = null
      esAdminPlataforma.value = false
      return
    }
    const admin = api.get<{ admin: boolean }>('/plataforma/yo').then((r) => { esAdminPlataforma.value = r.admin }).catch(() => {})
    // Sin conexión no se rompe el arranque: el perfil se reintenta en el próximo evento de sesión.
    perfil.value = await api.get<Fila<'perfiles'> | null>('/perfil').catch(() => perfil.value)
    await admin
  }

  function iniciar() {
    iniciando ??= (async () => {
      const { data } = await supabase.auth.getSession()
      sesion.value = data.session
      // La sesión guardada puede pertenecer a un usuario que ya no existe (cuenta
      // eliminada o recreada): se valida con el servidor y, si fue rechazada, se cierra.
      // Un error de red no cierra la sesión (la app puede abrirse sin conexión).
      if (data.session) {
        const { data: u, error } = await supabase.auth.getUser()
        const rechazada = !!error && (error.status === 401 || error.status === 403 || /not exist|not found/i.test(error.message))
        if (rechazada || (!error && !u.user)) {
          await supabase.auth.signOut({ scope: 'local' })
          sesion.value = null
        }
      }
      await cargarPerfil()
      supabase.auth.onAuthStateChange((evento, nueva) => {
        sesion.value = nueva
        if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') void cargarPerfil()
        if (evento === 'SIGNED_OUT') { perfil.value = null; esAdminPlataforma.value = false }
      })
      listo.value = true
    })()
    return iniciando
  }

  async function salir() {
    await supabase.auth.signOut()
    sesion.value = null
    perfil.value = null
    esAdminPlataforma.value = false
  }

  return { sesion, perfil, esAdminPlataforma, listo, usuario, autenticado, iniciar, cargarPerfil, salir }
})
