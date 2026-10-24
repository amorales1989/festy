<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarCheck, Search, User } from 'lucide-vue-next'
import { api, rutaOrg } from '@/lib/api'
import { fmtFecha } from '@/lib/formato'
import { ESTADOS_RESERVA } from '@/lib/catalogos'
import type { EstadoReserva } from '@/lib/supabase'
import { useOrganizacion } from '@/stores/organizacion'

interface Resultado { tipo: 'cliente' | 'reserva'; id: string; titulo: string; detalle: string | null; inicio?: string }

const org = useOrganizacion()
const router = useRouter()
const abierto = ref(false)
const q = ref('')
const resultados = ref<Resultado[]>([])
const activo = ref(0)
const buscando = ref(false)
const entrada = ref<HTMLInputElement | null>(null)
let temporizador: ReturnType<typeof setTimeout> | undefined
let consulta = 0

const atajo = computed(() => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'))

function abrir() {
  abierto.value = true
  void nextTick(() => entrada.value?.focus())
}
function cerrar() {
  abierto.value = false
  q.value = ''
  resultados.value = []
}
function alTeclaGlobal(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    abrir()
  }
}
onMounted(() => document.addEventListener('keydown', alTeclaGlobal))
onBeforeUnmount(() => document.removeEventListener('keydown', alTeclaGlobal))

watch(q, (v) => {
  clearTimeout(temporizador)
  if (v.trim().length < 2) {
    resultados.value = []
    return
  }
  temporizador = setTimeout(async () => {
    const n = ++consulta
    buscando.value = true
    const data = await api.get<Resultado[]>(rutaOrg(org.id, 'buscar'), { q: v }).catch(() => [])
    if (n !== consulta) return
    buscando.value = false
    resultados.value = data
    activo.value = 0
  }, 220)
})

function ir(r: Resultado | undefined) {
  if (!r) return
  void router.push(r.tipo === 'cliente' ? { name: 'cliente', params: { id: r.id } } : { name: 'reserva', params: { id: r.id } })
  cerrar()
}
function alTeclear(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); activo.value = Math.min(activo.value + 1, resultados.value.length - 1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); activo.value = Math.max(activo.value - 1, 0) }
  if (e.key === 'Enter') ir(resultados.value[activo.value])
  if (e.key === 'Escape') cerrar()
}
</script>

<template>
  <button type="button" class="flex w-full max-w-md items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-200/70"
          aria-label="Buscar clientes y reservas" @click="abrir">
    <Search class="size-4 shrink-0" />
    <span class="flex-1 truncate">Buscar clientes, reservas o #número…</span>
    <kbd class="hidden rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200 sm:inline">{{ atajo }}</kbd>
  </button>

  <Teleport to="body">
    <div v-if="abierto" class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" @mousedown.self="cerrar">
      <div class="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <div class="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search class="size-5 text-slate-400" />
          <input ref="entrada" v-model="q" class="w-full border-0 py-4 text-base outline-none placeholder:text-slate-400"
                 placeholder="Nombre, teléfono, email o número de reserva" role="combobox" aria-expanded="true"
                 aria-controls="resultados-busqueda" @keydown="alTeclear" />
        </div>
        <ul id="resultados-busqueda" role="listbox" class="max-h-[50vh] overflow-y-auto p-2">
          <li v-if="q.trim().length >= 2 && !buscando && !resultados.length" class="px-3 py-6 text-center text-sm text-slate-500">
            No encontramos resultados para “{{ q }}”.
          </li>
          <li v-if="q.trim().length < 2" class="px-3 py-6 text-center text-sm text-slate-400">Escribí al menos 2 letras.</li>
          <li v-for="(r, i) in resultados" :key="r.tipo + r.id" role="option" :aria-selected="i === activo">
            <button type="button" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === activo ? 'bg-marca-50' : 'hover:bg-slate-50']"
                    @mouseenter="activo = i" @click="ir(r)">
              <component :is="r.tipo === 'cliente' ? User : CalendarCheck" class="size-4 shrink-0 text-slate-400" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-900">{{ r.titulo }}</span>
                <span class="block truncate text-xs text-slate-500">
                  <template v-if="r.tipo === 'reserva'">
                    {{ ESTADOS_RESERVA[r.detalle as EstadoReserva]?.etiqueta }} · {{ fmtFecha(r.inicio, org.zona) }}
                  </template>
                  <template v-else>{{ r.detalle || 'Cliente' }}</template>
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>
