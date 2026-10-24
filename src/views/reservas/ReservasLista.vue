<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardList, Download, Search } from 'lucide-vue-next'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import type { EstadoReserva, EstadoContrato } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { desdeLocal, fmtFecha, fmtHora, fmtMoneda, fmtNumero, hoyISO, sumarDiasISO } from '@/lib/formato'
import { ESTADOS_CONTRATO, ESTADOS_RESERVA, ORDEN_ESTADOS } from '@/lib/catalogos'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'

interface Fila {
  id: string; numero: number; titulo: string; estado: EstadoReserva; contrato_estado: EstadoContrato; inicio: string; fin: string
  invitados: number | null; precio_total: number; tipo_evento: string
  clientes: { id: string; nombre: string } | null
  reserva_espacios: Array<{ espacios: { nombre: string } | null }>
}
const POR_PAGINA = 50
const org = useOrganizacion()
const acciones = useAcciones()
const route = useRoute()
const router = useRouter()

const q = route.query
const filtros = reactive({
  texto: typeof q.q === 'string' ? q.q : '',
  estado: typeof q.estado === 'string' ? q.estado : 'proximas',
  contrato: typeof q.contrato === 'string' ? q.contrato : '',
  desde: typeof q.desde === 'string' ? q.desde : '',
  hasta: typeof q.hasta === 'string' ? q.hasta : '',
  sucursal: typeof q.sucursal === 'string' ? q.sucursal : '',
})
const filas = ref<Fila[]>([])
const saldos = ref(new Map<string, { saldo: number; vencido: number }>())
const total = ref(0)
const pagina = ref(0)
const cargando = ref(true)
const error = ref('')

type FilaApi = Fila & { saldo: number | null; vencido: number | null }
// Los filtros se resuelven en la base (sp_reservas_listar), igual para la lista y la exportación.
function consulta(limite: number, desplazamiento = 0) {
  return api.get<{ total: number; filas: FilaApi[] }>(rutaOrg(org.id, 'reservas'), {
    estado: filtros.estado, contrato: filtros.contrato || undefined,
    desde: filtros.desde ? desdeLocal(filtros.desde, '00:00', org.zona) : undefined,
    hasta: filtros.hasta ? desdeLocal(sumarDiasISO(filtros.hasta, 1), '00:00', org.zona) : undefined,
    sucursal: filtros.sucursal || undefined, texto: filtros.texto.trim() || undefined, limite, desplazamiento,
  })
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const r = await consulta(POR_PAGINA, pagina.value * POR_PAGINA)
    filas.value = r.filas
    total.value = r.total
    saldos.value = org.puede('pagos.ver')
      ? new Map(r.filas.map((x) => [x.id, { saldo: Number(x.saldo ?? 0), vencido: Number(x.vencido ?? 0) }]))
      : new Map()
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}

let t: ReturnType<typeof setTimeout> | undefined
watch(() => ({ ...filtros }), (f) => {
  const query: Record<string, string> = {}
  if (f.texto) query.q = f.texto
  for (const k of ['estado', 'contrato', 'desde', 'hasta', 'sucursal'] as const) if (f[k]) query[k] = f[k]
  void router.replace({ query })
  pagina.value = 0
  clearTimeout(t)
  t = setTimeout(cargar, 250)
})
watch(pagina, cargar)
watch(() => acciones.version, cargar)
onMounted(cargar)

const exportando = ref(false)
async function exportar() {
  exportando.value = true
  try {
    const todas = (await consulta(5000)).filas
    const filtrosTexto = [
      filtros.estado === 'proximas' ? 'Próximos (activos)' : filtros.estado ? ESTADOS_RESERVA[filtros.estado as EstadoReserva].etiqueta : 'Todos los estados',
      filtros.contrato === 'pendiente' ? 'contrato sin firmar' : filtros.contrato === 'firmado' ? 'contrato firmado' : '',
      filtros.desde ? `desde ${fmtFecha(filtros.desde, org.zona)}` : '', filtros.hasta ? `hasta ${fmtFecha(filtros.hasta, org.zona)}` : '',
      filtros.sucursal ? org.sucursales.find((x) => x.id === filtros.sucursal)?.nombre ?? '' : '',
      filtros.texto ? `búsqueda "${filtros.texto}"` : '',
    ].filter(Boolean).join(' · ')
    const totalPrecio = todas.filter((r) => r.estado !== 'cancelada').reduce((t, r) => t + Number(r.precio_total), 0)
    const totalInvitados = todas.filter((r) => r.estado !== 'cancelada').reduce((t, r) => t + (r.invitados ?? 0), 0)
    await exportarPDF(nombreArchivo('eventos', org.actual?.nombre ?? '', hoyISO(org.zona)), {
      titulo: 'Eventos', subtitulo: filtrosTexto, organizacion: org.actual?.nombre ?? '', zona: org.zona, horizontal: true,
      resumen: [['Eventos', String(todas.length)], ['Invitados (sin cancelados)', fmtNumero(totalInvitados)], ['Facturación (sin cancelados)', fmtMoneda(totalPrecio)]],
      secciones: [{
        columnas: [
          { clave: 'numero', titulo: '#', ancho: 5, alinear: 'right' }, { clave: 'fecha', titulo: 'Fecha', ancho: 11 },
          { clave: 'horario', titulo: 'Horario', ancho: 13 }, { clave: 'titulo', titulo: 'Evento', ancho: 23 },
          { clave: 'cliente', titulo: 'Cliente', ancho: 16 }, { clave: 'espacios', titulo: 'Espacios', ancho: 14 },
          { clave: 'invitados', titulo: 'Invit.', ancho: 6, alinear: 'right' }, { clave: 'estado', titulo: 'Estado', ancho: 12 },
          { clave: 'contrato', titulo: 'Contrato', ancho: 10 }, { clave: 'total', titulo: 'Total', ancho: 13, alinear: 'right' },
        ],
        filas: todas.map((r) => ({
          numero: r.numero, fecha: fmtFecha(r.inicio, org.zona), horario: `${fmtHora(r.inicio, org.zona)} a ${fmtHora(r.fin, org.zona)}`,
          titulo: r.titulo, cliente: r.clientes?.nombre ?? '', espacios: r.reserva_espacios.map((e) => e.espacios?.nombre).join(', '),
          invitados: r.invitados ?? '', estado: ESTADOS_RESERVA[r.estado].etiqueta, contrato: ESTADOS_CONTRATO[r.contrato_estado],
          total: fmtMoneda(r.precio_total),
        })),
        pie: { titulo: 'Total (sin cancelados)', invitados: fmtNumero(totalInvitados), total: fmtMoneda(totalPrecio) },
      }],
    })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    exportando.value = false
  }
}
const paginas = computed(() => Math.ceil(total.value / POR_PAGINA))
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="titulo-pagina">Eventos</h1>
        <p class="subtitulo">{{ total }} resultado{{ total === 1 ? '' : 's' }}</p>
      </div>
      <button v-if="org.puede('datos.exportar') && org.tieneFuncion('exportacion')" class="btn-secundario" :disabled="exportando || !total" @click="exportar">
        <Download class="size-4" /> {{ exportando ? 'Generando…' : 'Exportar PDF' }}
      </button>
    </div>

    <div class="tarjeta flex flex-wrap items-end gap-2 p-3">
      <div class="relative min-w-48 flex-1">
        <Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <input v-model="filtros.texto" class="entrada pl-9" placeholder="Título o #número" aria-label="Buscar reservas" />
      </div>
      <select v-model="filtros.estado" class="entrada w-auto" aria-label="Estado">
        <option value="proximas">Próximas (activas)</option>
        <option value="">Todas</option>
        <option v-for="e in ORDEN_ESTADOS" :key="e" :value="e">{{ ESTADOS_RESERVA[e].etiqueta }}</option>
      </select>
      <select v-model="filtros.contrato" class="entrada w-auto" aria-label="Contrato">
        <option value="">Contrato: todos</option>
        <option value="pendiente">Sin firmar (vigentes)</option>
        <option value="firmado">Firmado</option>
      </select>
      <select v-if="org.sucursales.length > 1" v-model="filtros.sucursal" class="entrada w-auto" aria-label="Sede">
        <option value="">Todas las sedes</option>
        <option v-for="s in org.sucursales" :key="s.id" :value="s.id">{{ s.nombre }}</option>
      </select>
      <div class="w-36"><CampoFecha v-model="filtros.desde" aria-label="Desde" /></div>
      <div class="w-36"><CampoFecha v-model="filtros.hasta" aria-label="Hasta" /></div>
    </div>

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>

    <div class="tarjeta overflow-hidden">
      <Cargando v-if="cargando && !filas.length" />
      <EstadoVacio v-else-if="!filas.length" :icono="ClipboardList" titulo="No hay reservas con estos filtros"
                   descripcion="Probá cambiar los filtros o cargá una nueva reserva.">
        <button v-if="org.puede('reservas.crear')" class="btn-primario" @click="acciones.nuevaReserva()">Nueva reserva</button>
      </EstadoVacio>
      <template v-else>
        <!-- Tabla en pantallas medianas y grandes -->
        <div class="hidden overflow-x-auto md:block">
          <table class="tabla">
            <thead class="bg-slate-50"><tr>
              <th>#</th><th>Fecha</th><th>Evento</th><th>Espacios</th><th>Estado</th><th>Contrato</th>
              <th class="text-right">Total</th><th v-if="org.puede('pagos.ver')" class="text-right">Saldo</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in filas" :key="r.id" class="cursor-pointer" @click="router.push({ name: 'reserva', params: { id: r.id } })">
                <td class="text-slate-500 tabular-nums">{{ r.numero }}</td>
                <td class="whitespace-nowrap">{{ fmtFecha(r.inicio, org.zona) }}<span class="block text-xs text-slate-500">{{ fmtHora(r.inicio, org.zona) }} a {{ fmtHora(r.fin, org.zona) }}</span></td>
                <td><RouterLink :to="{ name: 'reserva', params: { id: r.id } }" class="font-medium hover:underline" @click.stop>{{ r.titulo }}</RouterLink>
                  <span class="block text-xs text-slate-500">{{ r.clientes?.nombre }}<template v-if="r.invitados"> · {{ r.invitados }} inv.</template></span></td>
                <td class="text-slate-600">{{ r.reserva_espacios.map((e) => e.espacios?.nombre).join(', ') || '—' }}</td>
                <td><InsigniaEstado :estado="r.estado" /></td>
                <td class="text-xs text-slate-600">{{ ESTADOS_CONTRATO[r.contrato_estado] }}</td>
                <td class="text-right tabular-nums">{{ fmtMoneda(r.precio_total, true) }}</td>
                <td v-if="org.puede('pagos.ver')" :class="['text-right tabular-nums', (saldos.get(r.id)?.vencido ?? 0) > 0 && 'font-medium text-rose-600']">
                  {{ fmtMoneda(saldos.get(r.id)?.saldo ?? null, true) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Tarjetas en celular -->
        <ul class="divide-y divide-slate-100 md:hidden">
          <li v-for="r in filas" :key="r.id">
            <RouterLink :to="{ name: 'reserva', params: { id: r.id } }" class="block px-4 py-3">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium">#{{ r.numero }} {{ r.titulo }}</p><InsigniaEstado :estado="r.estado" />
              </div>
              <p class="mt-0.5 text-xs text-slate-500">{{ fmtFecha(r.inicio, org.zona) }} {{ fmtHora(r.inicio, org.zona) }} · {{ r.clientes?.nombre }}</p>
            </RouterLink>
          </li>
        </ul>
        <div v-if="paginas > 1" class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-sm">
          <button class="btn-fantasma btn-chico" :disabled="pagina === 0" @click="pagina--">Anterior</button>
          <span class="text-slate-500">Página {{ pagina + 1 }} de {{ paginas }}</span>
          <button class="btn-fantasma btn-chico" :disabled="pagina + 1 >= paginas" @click="pagina++">Siguiente</button>
        </div>
      </template>
    </div>
  </div>
</template>
