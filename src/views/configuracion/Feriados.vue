<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtDiaLargo, fmtFecha, hoyISO } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { exito, error: notificarError } = useNotificaciones()
const feriados = ref<Fila<'feriados'>[]>([])
const anio = ref(Number(hoyISO(org.zona).slice(0, 4)))
const nuevo = ref({ fecha: '', nombre: '' })
const puede = computed(() => org.puede('sedes.gestionar'))

async function cargar() {
  try {
    feriados.value = await api.get<Fila<'feriados'>[]>(rutaOrg(org.id, 'feriados'), { desde: `${anio.value}-01-01`, hasta: `${anio.value}-12-31` })
  } catch (e) { notificarError(e) }
}
onMounted(cargar)
async function agregar() {
  if (!nuevo.value.fecha || nuevo.value.nombre.trim().length < 2) { notificarError('Completá fecha y nombre.'); return }
  try {
    await api.post(rutaOrg(org.id, 'feriados'), { fecha: nuevo.value.fecha, nombre: nuevo.value.nombre.trim() })
    nuevo.value = { fecha: '', nombre: '' }
    exito('Feriado agregado.')
    void cargar()
  } catch (e) { notificarError(traducirError(e)) }
}
async function borrar(f: Fila<'feriados'>) {
  try {
    await eliminarRegistro('feriados', f.id)
    void cargar()
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
      Los feriados se muestran en el calendario y generan un aviso al reservar, pero <strong>no bloquean</strong> la fecha.
      Si no abrís un feriado, creá un bloqueo desde el calendario. Se precargan los feriados nacionales inamovibles; los trasladables
      y días no laborables dependen del decreto anual: agregalos acá.
    </div>
    <div class="flex items-center gap-2">
      <button class="btn-fantasma btn-chico" @click="anio--; cargar()">‹ {{ anio - 1 }}</button>
      <span class="font-semibold">{{ anio }}</span>
      <button class="btn-fantasma btn-chico" @click="anio++; cargar()">{{ anio + 1 }} ›</button>
    </div>
    <form v-if="puede" class="flex flex-wrap gap-2" @submit.prevent="agregar">
      <div class="w-40"><CampoFecha v-model="nuevo.fecha" /></div>
      <input v-model="nuevo.nombre" class="entrada min-w-48 flex-1" placeholder="Nombre (ej.: Día del Respeto a la Diversidad Cultural)" aria-label="Nombre del feriado" />
      <button class="btn-primario">Agregar</button>
    </form>
    <ul class="tarjeta divide-y divide-slate-100">
      <li v-for="f in feriados" :key="f.id" class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
        <span><span class="font-medium">{{ fmtFecha(f.fecha, org.zona) }}</span> <span class="text-slate-500 first-letter:uppercase">· {{ fmtDiaLargo(f.fecha).split(' ')[0] }}</span> — {{ f.nombre }}</span>
        <span v-if="!f.organizacion_id" class="text-xs text-slate-400">Nacional</span>
        <button v-else-if="puede" class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar feriado" @click="borrar(f)"><Trash2 class="size-4" /></button>
      </li>
      <li v-if="!feriados.length" class="px-4 py-6 text-center text-sm text-slate-500">No hay feriados cargados para {{ anio }}.</li>
    </ul>
  </div>
</template>
