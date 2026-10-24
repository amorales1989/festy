<script setup lang="ts">
// Buscar un cliente existente o crearlo en el momento (nombre + teléfono).
import { reactive, ref, watch } from 'vue'
import { Search, UserPlus } from 'lucide-vue-next'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { useOrganizacion } from '@/stores/organizacion'
import type { ClienteElegido } from './tipos'

const props = defineProps<{ id?: string; invalido?: boolean; deshabilitado?: boolean }>()
const modelo = defineModel<ClienteElegido | null>({ default: null })
const org = useOrganizacion()
const q = ref(modelo.value?.nombre ?? '')
const sugerencias = ref<ClienteElegido[]>([])
const nuevo = reactive({ activo: false, nombre: '', telefono: '', email: '', error: '', guardando: false })
let t: ReturnType<typeof setTimeout> | undefined

watch(modelo, (c) => { if (c) q.value = c.nombre })
watch(q, (v) => {
  clearTimeout(t)
  if (modelo.value || v.trim().length < 2) { sugerencias.value = []; return }
  t = setTimeout(async () => {
    sugerencias.value = await api.get<ClienteElegido[]>(rutaOrg(org.id, 'clientes/buscar'), { q: v, limite: 6 }).catch(() => [])
  }, 200)
})

function elegir(c: ClienteElegido) {
  modelo.value = c
  sugerencias.value = []
}
function cambiar() {
  modelo.value = null
  q.value = ''
}
function empezarNuevo() {
  Object.assign(nuevo, { activo: true, nombre: q.value.trim(), telefono: '', email: '', error: '' })
  sugerencias.value = []
}
async function crear() {
  nuevo.error = ''
  if (nuevo.nombre.trim().length < 2) { nuevo.error = 'Ingresá el nombre.'; return }
  if (nuevo.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevo.email.trim())) { nuevo.error = 'El email no es válido.'; return }
  nuevo.guardando = true
  try {
    const c = await api.post<ClienteElegido>(rutaOrg(org.id, 'clientes'), {
      nombre: nuevo.nombre.trim(), telefono: nuevo.telefono.trim() || null, email: nuevo.email.trim().toLowerCase() || null,
    })
    nuevo.activo = false
    elegir(c)
  } catch (e) {
    nuevo.error = traducirError(e)
  } finally {
    nuevo.guardando = false
  }
}
void props
</script>

<template>
  <div>
    <div v-if="!nuevo.activo" class="relative">
      <Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
      <input :id="id" v-model="q" :class="['entrada pl-9', invalido && 'entrada-error']" placeholder="Nombre o teléfono del cliente" autocomplete="off"
             aria-label="Cliente" :readonly="!!modelo" :disabled="deshabilitado" />
      <button v-if="modelo && !deshabilitado" type="button" class="absolute right-2 top-1.5 btn-fantasma btn-chico" @click="cambiar">Cambiar</button>
      <ul v-if="!modelo && (sugerencias.length || q.trim().length >= 2)" class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
        <li v-for="c in sugerencias" :key="c.id">
          <button type="button" class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" @click="elegir(c)">
            <span class="font-medium">{{ c.nombre }}</span>
            <span class="ml-2 text-xs text-slate-500">{{ [c.telefono, c.email].filter(Boolean).join(' · ') }}</span>
          </button>
        </li>
        <li v-if="org.puede('clientes.gestionar')">
          <button type="button" class="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-marca-700 hover:bg-marca-50" @click="empezarNuevo">
            <UserPlus class="size-4" /> Es un cliente nuevo: “{{ q.trim() }}”
          </button>
        </li>
      </ul>
    </div>
    <div v-else class="grid gap-2 rounded-lg bg-marca-50/60 p-3 sm:grid-cols-2">
      <input v-model="nuevo.nombre" class="entrada" placeholder="Nombre y apellido" aria-label="Nombre del cliente" />
      <input v-model="nuevo.telefono" class="entrada" placeholder="WhatsApp / teléfono" type="tel" aria-label="Teléfono del cliente" />
      <input v-model="nuevo.email" class="entrada sm:col-span-2" placeholder="Email (opcional)" type="email" aria-label="Email del cliente" />
      <p v-if="nuevo.error" class="text-xs text-rose-600 sm:col-span-2" role="alert">{{ nuevo.error }}</p>
      <div class="flex gap-2 sm:col-span-2">
        <button type="button" class="btn-primario btn-chico" :disabled="nuevo.guardando" @click="crear">Guardar cliente</button>
        <button type="button" class="btn-fantasma btn-chico" @click="nuevo.activo = false">Cancelar</button>
      </div>
    </div>
  </div>
</template>
