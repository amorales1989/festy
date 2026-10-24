<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, Plus, Search } from 'lucide-vue-next'
import PestanasVentas from './PestanasVentas.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO } from '@/lib/formato'
import { ESTADOS_PRESUPUESTO } from '@/lib/catalogos'
import { numeroDoc } from '@/lib/documentos'
import { useOrganizacion } from '@/stores/organizacion'

interface Fila { id: string; numero: number; titulo: string; estado: string; total: number; valido_hasta: string; fecha_evento: string | null; creado_at: string; clientes: { nombre: string } | null }
const org = useOrganizacion()
const router = useRouter()
const filas = ref<Fila[]>([])
const estado = ref('abiertos')
const texto = ref('')
const cargando = ref(true)
const error = ref('')
const hoy = computed(() => hoyISO(org.zona))

async function cargar() {
  cargando.value = true
  try {
    filas.value = await api.get<Fila[]>(rutaOrg(org.id, 'presupuestos'), { estado: estado.value, texto: texto.value.trim() || undefined })
  } catch (e) { error.value = traducirError(e) } finally { cargando.value = false }
}
let tt: ReturnType<typeof setTimeout> | undefined
watch([estado, texto], () => { clearTimeout(tt); tt = setTimeout(cargar, 250) })
onMounted(cargar)
const totalAbierto = computed(() => filas.value.filter((f) => f.estado === 'enviado').reduce((s, f) => s + Number(f.total), 0))
</script>

<template>
  <div class="space-y-4">
    <PestanasVentas />
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
        <Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <input v-model="texto" class="entrada pl-9" placeholder="Buscar por evento o número" aria-label="Buscar presupuestos" />
      </div>
      <select v-model="estado" class="entrada w-auto" aria-label="Estado">
        <option value="abiertos">Abiertos (borrador y enviados)</option>
        <option value="">Todos</option>
        <option v-for="(e, k) in ESTADOS_PRESUPUESTO" :key="k" :value="k">{{ e.etiqueta }}</option>
      </select>
      <button v-if="org.puede('presupuestos.gestionar')" class="btn-primario" @click="router.push({ name: 'presupuesto-nuevo' })"><Plus class="size-4" /> Nuevo presupuesto</button>
    </div>
    <p v-if="totalAbierto" class="text-sm text-slate-600">Enviados esperando respuesta: <strong>{{ fmtMoneda(totalAbierto, true) }}</strong></p>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-hidden">
      <Cargando v-if="cargando && !filas.length" />
      <EstadoVacio v-else-if="!filas.length" :icono="FileText" titulo="No hay presupuestos" descripcion="Armá uno con los servicios de tu catálogo y mandalo por WhatsApp.">
        <button v-if="org.puede('presupuestos.gestionar')" class="btn-primario" @click="router.push({ name: 'presupuesto-nuevo' })">Hacer un presupuesto</button>
      </EstadoVacio>
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="p in filas" :key="p.id">
          <RouterLink :to="{ name: 'presupuesto', params: { id: p.id } }" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <span class="w-14 shrink-0 text-xs tabular-nums text-slate-500">N° {{ numeroDoc(p.numero, 4) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ p.titulo }}</span>
              <span class="block truncate text-xs text-slate-500">{{ p.clientes?.nombre }}<template v-if="p.fecha_evento"> · evento {{ fmtFecha(p.fecha_evento, org.zona) }}</template>
                <template v-if="['borrador', 'enviado'].includes(p.estado)"> · <span :class="p.valido_hasta < hoy ? 'text-rose-600' : ''">válido hasta {{ fmtFecha(p.valido_hasta, org.zona) }}</span></template></span>
            </span>
            <span class="hidden text-sm font-semibold tabular-nums sm:block">{{ fmtMoneda(p.total, true) }}</span>
            <span :class="['rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_PRESUPUESTO[p.estado]?.clase]">{{ ESTADOS_PRESUPUESTO[p.estado]?.etiqueta }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
