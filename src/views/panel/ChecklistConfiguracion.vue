<script setup lang="ts">
// Checklist de configuración inicial. Cada paso se deriva de datos reales.
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronDown, CircleCheck, Circle, Sparkles, X } from 'lucide-vue-next'
import { api, rutaOrg } from '@/lib/api'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Estado = Record<'datos_organizacion' | 'sucursal' | 'espacio' | 'horarios' | 'equipo' | 'cliente' | 'reserva' | 'datos_ejemplo', boolean>

const org = useOrganizacion()
const acciones = useAcciones()
const { confirmar } = useConfirmar()
const { exito, error } = useNotificaciones()
const estado = ref<Estado | null>(null)
const clave = computed(() => `festy.checklist-oculto.${org.id}`)
const oculto = ref(false)

async function cargar() {
  estado.value = await api.get<Estado>(rutaOrg(org.id, 'checklist')).catch(() => estado.value)
}
onMounted(() => {
  try { oculto.value = localStorage.getItem(clave.value) === '1' } catch { /* sin almacenamiento */ }
  void cargar()
})
watch(() => acciones.version, cargar)

const pasos = computed(() => estado.value ? [
  { hecho: estado.value.datos_organizacion, texto: 'Completá los datos de tu organización', a: '/configuracion/organizacion', visible: org.puede('organizacion.editar') },
  { hecho: estado.value.sucursal && estado.value.espacio, texto: 'Cargá tu sede y tus espacios', a: '/configuracion/sedes', visible: org.puede('sedes.gestionar') },
  { hecho: estado.value.horarios, texto: 'Definí horarios de atención', a: '/configuracion/sedes', visible: org.puede('sedes.gestionar') },
  { hecho: estado.value.equipo, texto: 'Invitá a tu equipo', a: '/configuracion/usuarios', visible: org.puede('usuarios.gestionar') },
  { hecho: estado.value.cliente, texto: 'Cargá o importá tus clientes', a: '/clientes', visible: org.puede('clientes.gestionar') },
  { hecho: estado.value.reserva, texto: 'Registrá tu primera reserva real', a: '', visible: org.puede('reservas.crear') },
].filter((p) => p.visible) : [])
const completos = computed(() => pasos.value.filter((p) => p.hecho).length)
const abiertoManual = ref<boolean | null>(null)
const abiertoPasos = computed({ get: () => abiertoManual.value ?? completos.value <= 2, set: (v) => { abiertoManual.value = v } })
const visible = computed(() => !oculto.value && pasos.value.length > 0 && completos.value < pasos.value.length)

function ocultar() {
  oculto.value = true
  try { localStorage.setItem(clave.value, '1') } catch { /* sin almacenamiento */ }
}
async function borrarEjemplos() {
  const ok = await confirmar({
    titulo: 'Borrar datos de ejemplo',
    mensaje: 'Se eliminan las reservas, clientes, cobros, gastos, tareas y espacios marcados como ejemplo. Tus datos reales no se tocan.',
    confirmar: 'Borrar ejemplos', peligro: true,
  })
  if (!ok) return
  try {
    await api.delete(rutaOrg(org.id, 'ejemplos'))
    await org.cargarSedes()
    acciones.cambiosGuardados()
    exito('Datos de ejemplo eliminados.')
  } catch (e) {
    error(e)
  }
}
</script>

<template>
  <div v-if="estado?.datos_ejemplo" class="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
    <Sparkles class="size-4 shrink-0" />
    <span class="flex-1">Estás viendo <strong>datos de ejemplo</strong>.</span>
    <button v-if="org.puede('sedes.gestionar')" class="btn-secundario btn-chico" @click="borrarEjemplos">Borrar ejemplos</button>
  </div>

  <section v-if="visible" class="tarjeta px-4 py-3" aria-label="Configuración inicial">
    <div class="flex items-center gap-3">
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" :aria-expanded="abiertoPasos" @click="abiertoPasos = !abiertoPasos">
        <span class="text-sm font-semibold">Terminá de configurar tu cuenta</span>
        <span class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
          <span class="block h-full rounded-full bg-marca-500" :style="{ width: `${(completos / pasos.length) * 100}%` }" />
        </span>
        <span class="text-xs text-slate-500">{{ completos }} de {{ pasos.length }}</span>
        <ChevronDown :class="['ml-auto size-4 text-slate-400 transition', abiertoPasos && 'rotate-180']" />
      </button>
      <button class="btn-fantasma p-1" aria-label="Ocultar" title="Ocultar" @click="ocultar"><X class="size-4" /></button>
    </div>
    <ul v-if="abiertoPasos" class="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="p in pasos" :key="p.texto">
        <component :is="p.a ? 'RouterLink' : 'button'" :to="p.a || undefined" type="button"
                   :class="['flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', p.hecho ? 'text-slate-400 line-through' : 'text-slate-700 hover:bg-slate-50']"
                   @click="!p.a && acciones.nuevaReserva()">
          <CircleCheck v-if="p.hecho" class="size-4 shrink-0 text-emerald-500" />
          <Circle v-else class="size-4 shrink-0 text-slate-300" />
          {{ p.texto }}
        </component>
      </li>
    </ul>
  </section>
</template>
