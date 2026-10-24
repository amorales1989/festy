<script setup lang="ts">
// Rentabilidad: cuánto deja cada evento (total − costos de proveedores − gastos del evento).
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Download, TrendingUp } from 'lucide-vue-next'
import PestanasFinanzas from '@/components/finanzas/PestanasFinanzas.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import Cargando from '@/components/ui/Cargando.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useOrganizacion } from '@/stores/organizacion'

interface Evento { id: string; numero: number; titulo: string; inicio: string; cliente: string | null; precio_total: number; costos: number; cobrado: number; ganancia: number; margen: number | null }
interface Datos { eventos: Evento[]; totales: { facturado: number; costos: number; ganancia: number; cobrado: number; margen: number | null } }

const org = useOrganizacion()
const hoy = hoyISO(org.zona)
const filtro = reactive({ desde: `${hoy.slice(0, 7)}-01`, hasta: sumarDiasISO(`${hoy.slice(0, 7)}-01`, 120) })
const datos = ref<Datos | null>(null)
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    datos.value = await api.get<Datos>(rutaOrg(org.id, 'rentabilidad'), { desde: filtro.desde, hasta: filtro.hasta })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => ({ ...filtro }), cargar)
onMounted(cargar)
const sinCostos = computed(() => (datos.value?.eventos ?? []).filter((e) => Number(e.costos) === 0).length)
const margen = (m: number | null) => (m === null ? '—' : `${Number(m).toLocaleString('es-AR')} %`)

async function exportar() {
  if (!datos.value) return
  const z = org.zona, t = datos.value.totales
  await exportarPDF(nombreArchivo('rentabilidad', org.actual?.nombre ?? '', hoy), {
    titulo: 'Rentabilidad por evento', subtitulo: `Eventos del ${fmtFecha(filtro.desde, z)} al ${fmtFecha(filtro.hasta, z)}`,
    organizacion: org.actual?.nombre ?? '', zona: z, horizontal: true,
    resumen: [['Facturado', fmtMoneda(t.facturado)], ['Costos', fmtMoneda(t.costos)], ['Ganancia', fmtMoneda(t.ganancia)], ['Margen', margen(t.margen)]],
    secciones: [{
      columnas: [{ clave: 'fecha', titulo: 'Fecha', ancho: 10 }, { clave: 'evento', titulo: 'Evento', ancho: 30 }, { clave: 'cliente', titulo: 'Cliente', ancho: 16 },
        { clave: 'total', titulo: 'Total', ancho: 11, alinear: 'right' }, { clave: 'costos', titulo: 'Costos', ancho: 11, alinear: 'right' },
        { clave: 'ganancia', titulo: 'Ganancia', ancho: 11, alinear: 'right' }, { clave: 'margen', titulo: 'Margen', ancho: 8, alinear: 'right' }],
      filas: datos.value.eventos.map((e) => ({ fecha: fmtFecha(e.inicio, z), evento: `#${e.numero} ${e.titulo}`, cliente: e.cliente ?? '',
        total: fmtMoneda(e.precio_total), costos: fmtMoneda(e.costos), ganancia: fmtMoneda(e.ganancia), margen: margen(e.margen) })),
      pie: { evento: 'Total', total: fmtMoneda(t.facturado), costos: fmtMoneda(t.costos), ganancia: fmtMoneda(t.ganancia), margen: margen(t.margen) },
    }],
  })
}
</script>

<template>
  <div class="space-y-4">
    <PestanasFinanzas />
    <div class="flex flex-wrap items-end gap-2">
      <div class="w-36"><CampoFecha v-model="filtro.desde" /></div>
      <div class="w-36"><CampoFecha v-model="filtro.hasta" /></div>
      <button v-if="org.puede('datos.exportar')" class="btn-secundario ml-auto" :disabled="!datos?.eventos.length" @click="exportar"><Download class="size-4" /> PDF</button>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <Cargando v-if="cargando && !datos" />
    <template v-else-if="datos">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="tarjeta p-4"><p class="text-sm text-slate-500">Facturado</p><p class="text-xl font-semibold tabular-nums">{{ fmtMoneda(datos.totales.facturado) }}</p></div>
        <div class="tarjeta p-4"><p class="text-sm text-slate-500">Costos</p><p class="text-xl font-semibold tabular-nums text-rose-700">{{ fmtMoneda(datos.totales.costos) }}</p></div>
        <div class="tarjeta p-4"><p class="text-sm text-slate-500">Ganancia</p><p class="text-xl font-semibold tabular-nums text-emerald-700">{{ fmtMoneda(datos.totales.ganancia) }}</p></div>
        <div class="tarjeta p-4"><p class="text-sm text-slate-500">Margen</p><p class="text-xl font-semibold tabular-nums">{{ margen(datos.totales.margen) }}</p></div>
      </div>
      <p v-if="sinCostos" class="text-sm text-slate-600">{{ sinCostos === 1 ? 'Un evento no tiene' : `${sinCostos} eventos no tienen` }} costos cargados: su ganancia aparece igual al total.</p>
      <div class="tarjeta overflow-x-auto">
        <EstadoVacio v-if="!datos.eventos.length" :icono="TrendingUp" titulo="No hay eventos en el período" descripcion="Se cuentan los eventos retenidos, señados, confirmados y finalizados, por fecha del evento." />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Evento</th><th class="text-right">Total</th><th class="hidden text-right sm:table-cell">Costos</th><th class="text-right">Ganancia</th><th class="hidden text-right md:table-cell">Margen</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="e in datos.eventos" :key="e.id">
              <td><RouterLink :to="{ name: 'reserva', params: { id: e.id } }" class="enlace">#{{ e.numero }} {{ e.titulo }}</RouterLink>
                <span class="block text-xs text-slate-500">{{ fmtFecha(e.inicio, org.zona) }}<template v-if="e.cliente"> · {{ e.cliente }}</template></span></td>
              <td class="text-right tabular-nums">{{ fmtMoneda(e.precio_total) }}</td>
              <td class="hidden text-right tabular-nums sm:table-cell">{{ fmtMoneda(e.costos) }}</td>
              <td :class="['text-right font-semibold tabular-nums', Number(e.ganancia) < 0 ? 'text-rose-700' : 'text-emerald-700']">{{ fmtMoneda(e.ganancia) }}</td>
              <td class="hidden text-right tabular-nums md:table-cell">{{ margen(e.margen) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
