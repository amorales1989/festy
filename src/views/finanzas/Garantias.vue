<script setup lang="ts">
// Depósitos de garantía: plata de los clientes en custodia. No es ingreso del salón.
import { computed, onMounted, ref } from 'vue'
import { Download, ShieldCheck } from 'lucide-vue-next'
import PestanasPlata from '@/components/finanzas/PestanasPlata.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO } from '@/lib/formato'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useOrganizacion } from '@/stores/organizacion'

interface Fila { id: string; monto: number; estado: string; cobro_fecha: string | null; devolucion_monto: number | null; devolucion_fecha: string | null;
  motivo_retencion: string | null; reservas: { id: string; numero: number; titulo: string; inicio: string; fin: string; clientes: { nombre: string } | null } | null }
type Vista = 'devolver' | 'custodia' | 'cobrar' | 'cerradas'
const org = useOrganizacion()
const filas = ref<Fila[]>([])
const vista = ref<Vista>('devolver')
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    filas.value = await api.get<Fila[]>(rutaOrg(org.id, 'garantias'))
    if (!grupos.value.devolver.length) vista.value = grupos.value.cobrar.length ? 'cobrar' : 'custodia'
  } catch (e) { error.value = traducirError(e) } finally { cargando.value = false }
})
const ahora = () => new Date().toISOString()
const grupos = computed(() => ({
  devolver: filas.value.filter((g) => g.estado === 'cobrada' && (g.reservas?.fin ?? '') < ahora()),
  custodia: filas.value.filter((g) => g.estado === 'cobrada'),
  cobrar: filas.value.filter((g) => g.estado === 'pendiente'),
  cerradas: filas.value.filter((g) => g.estado === 'devuelta' || g.estado === 'retenida'),
}))
const enCustodia = computed(() => grupos.value.custodia.reduce((t, g) => t + Number(g.monto), 0))
const retenido = computed(() => grupos.value.cerradas.reduce((t, g) => t + Number(g.monto) - Number(g.devolucion_monto ?? 0), 0))
const TITULOS: Record<Vista, string> = { devolver: 'Para devolver', custodia: 'En custodia', cobrar: 'Falta cobrar', cerradas: 'Cerradas' }
const ESTADOS: Record<string, string> = { pendiente: 'Falta cobrarla', cobrada: 'En custodia', devuelta: 'Devuelta', retenida: 'Con retención' }

async function exportar() {
  try {
    await exportarPDF(nombreArchivo('garantias', org.actual?.nombre ?? '', hoyISO(org.zona)), {
      titulo: 'Depósitos de garantía', subtitulo: TITULOS[vista.value], organizacion: org.actual?.nombre ?? '', zona: org.zona,
      resumen: [['En custodia', fmtMoneda(enCustodia.value)], ['Para devolver', String(grupos.value.devolver.length)], ['Retenido por daños', fmtMoneda(retenido.value)]],
      secciones: [{
        columnas: [{ clave: 'evento', titulo: 'Evento', ancho: 34 }, { clave: 'cliente', titulo: 'Cliente', ancho: 20 }, { clave: 'fecha', titulo: 'Fecha evento', ancho: 12 },
          { clave: 'estado', titulo: 'Estado', ancho: 14 }, { clave: 'monto', titulo: 'Garantía', ancho: 14, alinear: 'right' }, { clave: 'devuelto', titulo: 'Devuelto', ancho: 14, alinear: 'right' }],
        filas: grupos.value[vista.value].map((g) => ({ evento: `#${g.reservas?.numero} ${g.reservas?.titulo}`, cliente: g.reservas?.clientes?.nombre,
          fecha: fmtFecha(g.reservas?.inicio, org.zona), estado: ESTADOS[g.estado], monto: fmtMoneda(g.monto),
          devuelto: g.devolucion_monto === null ? '' : fmtMoneda(g.devolucion_monto) })),
        vacio: 'Sin garantías en esta lista.',
      }],
    })
  } catch (e) { error.value = traducirError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <PestanasPlata />
    <p class="text-sm text-slate-600">Los depósitos de garantía son plata del cliente en custodia: no se cuentan como ingresos. Se devuelven después del evento, completos o con una retención por daños.</p>
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="tarjeta p-4"><p class="text-xs text-slate-500">En custodia</p><p class="text-xl font-semibold tabular-nums">{{ fmtMoneda(enCustodia, true) }}</p></div>
      <div :class="['tarjeta p-4', grupos.devolver.length && 'bg-amber-50 ring-amber-200']"><p class="text-xs text-slate-500">Para devolver</p>
        <p class="text-xl font-semibold tabular-nums">{{ grupos.devolver.length }}</p></div>
      <div class="tarjeta p-4"><p class="text-xs text-slate-500">Retenido por daños</p><p class="text-xl font-semibold tabular-nums">{{ fmtMoneda(retenido, true) }}</p></div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap rounded-lg bg-slate-100 p-0.5" role="tablist">
        <button v-for="(t, k) in TITULOS" :key="k" role="tab" :aria-selected="vista === k" :class="['rounded-md px-3 py-1.5 text-sm font-medium', vista === k ? 'bg-white shadow-sm' : 'text-slate-600']"
                @click="vista = k">{{ t }} <span class="text-xs text-slate-400">{{ grupos[k].length }}</span></button>
      </div>
      <button v-if="org.puede('datos.exportar') && org.tieneFuncion('exportacion')" class="btn-secundario ml-auto" @click="exportar"><Download class="size-4" /> Exportar PDF</button>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-hidden">
      <Cargando v-if="cargando" />
      <EstadoVacio v-else-if="!grupos[vista].length" :icono="ShieldCheck" :titulo="`Nada en “${TITULOS[vista]}”`"
                   descripcion="La garantía se pide desde el presupuesto o desde la ficha de cada evento." />
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="g in grupos[vista]" :key="g.id">
          <RouterLink :to="{ name: 'reserva', params: { id: g.reservas?.id } }" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">#{{ g.reservas?.numero }} {{ g.reservas?.titulo }}</span>
              <span class="block truncate text-xs text-slate-500">{{ g.reservas?.clientes?.nombre }} · evento {{ fmtFecha(g.reservas?.inicio, org.zona) }}
                <template v-if="g.estado === 'retenida'"> · retenido {{ fmtMoneda(Number(g.monto) - Number(g.devolucion_monto)) }}: {{ g.motivo_retencion }}</template></span>
            </span>
            <span class="text-right text-sm font-semibold tabular-nums">{{ fmtMoneda(g.monto, true) }}<span class="block text-xs font-normal text-slate-500">{{ ESTADOS[g.estado] }}</span></span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
