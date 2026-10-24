<script setup lang="ts">
// Página pública del salón (sin sesión): presentación, espacios, días libres y pedido de fecha.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CalendarCheck, ChevronLeft, ChevronRight, MapPin, MessageCircle, Phone, Users } from 'lucide-vue-next'
import Campo from '@/components/ui/Campo.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import Cargando from '@/components/ui/Cargando.vue'
import { api, ErrorApi } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtDiaLargo, hoyISO, sumarDiasISO } from '@/lib/formato'
import { TIPOS_EVENTO } from '@/lib/catalogos'

interface Espacio { id: string; nombre: string; tipo: string; descripcion: string | null; capacidad_maxima: number; capacidad_minima: number | null; sucursal_id: string; color: string }
interface Sede { id: string; nombre: string; direccion: string | null; localidad: string | null; provincia: string | null }
interface Salon {
  nombre: string; descripcion: string | null; logo: string | null; color_marca: string; whatsapp: string | null; telefono: string | null
  email: string | null; direccion: string | null; zona_horaria: string; sedes: Sede[]; espacios: Espacio[]
}

const route = useRoute()
const slug = String(route.params.slug)
const salon = ref<Salon | null>(null)
const noExiste = ref(false)
const errorCarga = ref('')

onMounted(async () => {
  try {
    salon.value = await api.get<Salon>(`/publico/${encodeURIComponent(slug)}`)
    document.title = `${salon.value.nombre} · Pedí tu fecha`
    pedido.espacio_id = salon.value.espacios[0]?.id ?? ''
    mes.value = hoyISO(salon.value.zona_horaria).slice(0, 7)
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 404) noExiste.value = true
    else errorCarga.value = traducirError(e)
  }
})

const color = computed(() => salon.value?.color_marca ?? '#7c3aed')
const hoy = computed(() => (salon.value ? hoyISO(salon.value.zona_horaria) : ''))

// --- Calendario de disponibilidad ------------------------------------------------
const mes = ref('')  // 'yyyy-MM'
const ocupados = ref(new Set<string>())  // `${fecha}|${espacio}`
const cargandoMes = ref(false)
const diasDelMes = computed(() => {
  if (!mes.value) return []
  const [a, m] = mes.value.split('-').map(Number) as [number, number]
  const primero = `${mes.value}-01`
  const cantidad = new Date(a, m, 0).getDate()
  const blancos = (new Date(a, m - 1, 1).getDay() + 6) % 7  // semana desde el lunes
  return [...Array(blancos).fill(null), ...Array.from({ length: cantidad }, (_, i) => sumarDiasISO(primero, i))] as Array<string | null>
})
const nombreMes = computed(() => {
  if (!mes.value) return ''
  const [a, m] = mes.value.split('-').map(Number) as [number, number]
  const t = new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
})
async function cargarMes() {
  if (!mes.value) return
  cargandoMes.value = true
  const desde = `${mes.value}-01`
  const hasta = sumarDiasISO(desde, new Date(Number(mes.value.slice(0, 4)), Number(mes.value.slice(5, 7)), 0).getDate() - 1)
  try {
    const dias = await api.get<Array<{ fecha: string; espacio_id: string }>>(`/publico/${encodeURIComponent(slug)}/ocupacion`, { desde, hasta })
    ocupados.value = new Set(dias.map((d) => `${d.fecha}|${d.espacio_id}`))
  } catch { ocupados.value = new Set() } finally { cargandoMes.value = false }
}
watch(mes, cargarMes)
function moverMes(delta: number) {
  const [a, m] = mes.value.split('-').map(Number) as [number, number]
  const d = new Date(a, m - 1 + delta, 1)
  const nuevo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (nuevo < hoy.value.slice(0, 7)) return
  mes.value = nuevo
}
const estadoDia = (dia: string) => (dia < hoy.value ? 'pasado' : ocupados.value.has(`${dia}|${pedido.espacio_id}`) ? 'ocupado' : 'libre')

// --- Pedido --------------------------------------------------------------------------
const pedido = reactive({ espacio_id: '', fecha: '', nombre: '', telefono: '', email: '', tipo_evento: 'cumpleanos', invitados: null as number | null,
  hora_inicio: '21:00', hora_fin: '04:00', mensaje: '', sitio_web: '' })
const enviando = ref(false)
const errorPedido = ref('')
const enviado = ref(false)
const espacioElegido = computed(() => salon.value?.espacios.find((e) => e.id === pedido.espacio_id) ?? null)
watch(() => pedido.espacio_id, () => { if (pedido.fecha && estadoDia(pedido.fecha) !== 'libre') pedido.fecha = '' })

async function enviar() {
  errorPedido.value = ''
  if (!pedido.fecha) { errorPedido.value = 'Elegí una fecha libre en el calendario.'; return }
  if (pedido.nombre.trim().length < 2) { errorPedido.value = 'Ingresá tu nombre.'; return }
  if (pedido.telefono.replace(/\D/g, '').length < 8) { errorPedido.value = 'Ingresá un teléfono con código de área.'; return }
  enviando.value = true
  try {
    await api.post(`/publico/${encodeURIComponent(slug)}/pedidos`, { ...pedido })
    enviado.value = true
  } catch (e) {
    errorPedido.value = traducirError(e)
  } finally {
    enviando.value = false
  }
}
const enlaceWhatsApp = computed(() => {
  if (!salon.value?.whatsapp) return null
  const texto = `Hola ${salon.value.nombre}! Soy ${pedido.nombre.trim()}. Les dejé un pedido en su página para el ${pedido.fecha ? fmtDiaLargo(pedido.fecha) : ''}`
    + ` (${espacioElegido.value?.nombre ?? ''}, ${TIPOS_EVENTO[pedido.tipo_evento] ?? 'evento'}${pedido.invitados ? `, ${pedido.invitados} invitados` : ''}).`
  return `https://wa.me/${salon.value.whatsapp}?text=${encodeURIComponent(texto)}`
})
const direccion = (s: Sede) => [s.direccion, s.localidad, s.provincia].filter(Boolean).join(', ')
</script>

<template>
  <div class="min-h-dvh bg-slate-50 pb-[var(--ins-bottom)]" :style="{ '--marca-salon': color }">
    <Cargando v-if="!salon && !noExiste && !errorCarga" class="pt-24" />
    <div v-else-if="noExiste" class="mx-auto max-w-md px-4 pt-24 text-center">
      <h1 class="text-xl font-semibold">Esta página no existe o no está publicada</h1>
      <p class="mt-2 text-sm text-slate-600">Revisá el enlace o consultá directamente con el salón.</p>
    </div>
    <p v-else-if="errorCarga" class="mx-auto max-w-md px-4 pt-24 text-center text-sm text-rose-700" role="alert">{{ errorCarga }}</p>
    <template v-else-if="salon">
      <header class="text-white" :style="{ background: color }">
        <div class="mx-auto flex max-w-5xl items-center gap-4 px-4 pt-[calc(2rem+var(--ins-top))] pb-8 sm:px-6">
          <img v-if="salon.logo" :src="salon.logo" alt="" class="h-16 w-auto max-w-[8rem] rounded-lg bg-white object-contain p-1.5" />
          <div>
            <h1 class="text-2xl font-bold sm:text-3xl">{{ salon.nombre }}</h1>
            <p v-if="salon.sedes.length" class="mt-1 flex items-center gap-1 text-sm text-white/90"><MapPin class="size-4" /> {{ direccion(salon.sedes[0]!) || salon.sedes[0]!.nombre }}</p>
          </div>
        </div>
      </header>

      <main class="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-5">
        <section class="space-y-4 lg:col-span-2">
          <p v-if="salon.descripcion" class="whitespace-pre-line text-slate-700">{{ salon.descripcion }}</p>
          <div class="space-y-2">
            <h2 class="font-semibold">Espacios</h2>
            <button v-for="e in salon.espacios" :key="e.id" type="button"
                    :class="['tarjeta block w-full p-3 text-left', pedido.espacio_id === e.id ? 'ring-2' : 'hover:ring-1 hover:ring-slate-300']"
                    :style="pedido.espacio_id === e.id ? { '--tw-ring-color': color } : {}" :aria-pressed="pedido.espacio_id === e.id" @click="pedido.espacio_id = e.id">
              <span class="font-medium">{{ e.nombre }}</span>
              <span class="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><Users class="size-4" /> Hasta {{ e.capacidad_maxima }} personas</span>
              <span v-if="e.descripcion" class="mt-1 block text-sm text-slate-600">{{ e.descripcion }}</span>
            </button>
          </div>
          <div class="space-y-1 text-sm text-slate-600">
            <p v-for="s in salon.sedes" :key="s.id" class="flex items-start gap-1.5"><MapPin class="mt-0.5 size-4 shrink-0" /> {{ s.nombre }}<template v-if="direccion(s)"> · {{ direccion(s) }}</template></p>
            <p v-if="salon.telefono" class="flex items-center gap-1.5"><Phone class="size-4" /> {{ salon.telefono }}</p>
          </div>
        </section>

        <section class="tarjeta space-y-4 p-4 sm:p-5 lg:col-span-3">
          <template v-if="!enviado">
            <h2 class="flex items-center gap-2 text-lg font-semibold"><CalendarCheck class="size-5" :style="{ color }" /> Pedí tu fecha</h2>
            <div>
              <div class="mb-2 flex items-center justify-between">
                <button type="button" class="btn-fantasma p-1.5" aria-label="Mes anterior" :disabled="mes <= hoy.slice(0, 7)" @click="moverMes(-1)"><ChevronLeft class="size-5" /></button>
                <span class="font-medium">{{ nombreMes }}<span v-if="espacioElegido" class="text-sm font-normal text-slate-500"> · {{ espacioElegido.nombre }}</span></span>
                <button type="button" class="btn-fantasma p-1.5" aria-label="Mes siguiente" @click="moverMes(1)"><ChevronRight class="size-5" /></button>
              </div>
              <div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-500" aria-hidden="true">
                <span v-for="d in ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']" :key="d">{{ d }}</span>
              </div>
              <div :class="['mt-1 grid grid-cols-7 gap-1', cargandoMes && 'opacity-60']">
                <template v-for="(dia, i) in diasDelMes" :key="dia ?? `b${i}`">
                  <span v-if="!dia" />
                  <button v-else type="button" :disabled="estadoDia(dia) !== 'libre'"
                          :class="['aspect-square rounded-lg text-sm tabular-nums',
                                   pedido.fecha === dia ? 'font-semibold text-white' : estadoDia(dia) === 'libre' ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                     : estadoDia(dia) === 'ocupado' ? 'bg-slate-100 text-slate-400 line-through' : 'text-slate-300']"
                          :style="pedido.fecha === dia ? { background: color } : {}"
                          :aria-label="`${fmtDiaLargo(dia)}: ${estadoDia(dia) === 'libre' ? 'libre' : estadoDia(dia) === 'ocupado' ? 'ocupado' : 'no disponible'}`"
                          :aria-pressed="pedido.fecha === dia" @click="pedido.fecha = dia">{{ Number(dia.slice(8)) }}</button>
                </template>
              </div>
              <p class="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="size-3 rounded bg-emerald-100" /> Libre</span>
                <span class="flex items-center gap-1"><span class="size-3 rounded bg-slate-200" /> Ocupado</span>
              </p>
            </div>

            <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="enviar">
              <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm sm:col-span-2">
                Fecha elegida: <strong>{{ pedido.fecha ? fmtDiaLargo(pedido.fecha) : 'tocá un día libre del calendario' }}</strong>
              </p>
              <Campo etiqueta="Tu nombre" para="pd-nombre" requerido><input id="pd-nombre" v-model="pedido.nombre" class="entrada" autocomplete="name" /></Campo>
              <Campo etiqueta="Teléfono / WhatsApp" para="pd-tel" requerido><input id="pd-tel" v-model="pedido.telefono" class="entrada" inputmode="tel" autocomplete="tel" /></Campo>
              <Campo etiqueta="Tipo de evento" para="pd-tipo"><select id="pd-tipo" v-model="pedido.tipo_evento" class="entrada">
                <option v-for="(t, k) in TIPOS_EVENTO" :key="k" :value="k">{{ t }}</option></select></Campo>
              <Campo etiqueta="Invitados (aprox.)" para="pd-inv"><input id="pd-inv" v-model.number="pedido.invitados" type="number" min="1" class="entrada" /></Campo>
              <Campo etiqueta="Desde" para="pd-hi"><CampoHora id="pd-hi" v-model="pedido.hora_inicio" /></Campo>
              <Campo etiqueta="Hasta" para="pd-hf"><CampoHora id="pd-hf" v-model="pedido.hora_fin" /></Campo>
              <Campo etiqueta="Email (opcional)" para="pd-email" class="sm:col-span-2"><input id="pd-email" v-model="pedido.email" type="email" class="entrada" autocomplete="email" /></Campo>
              <Campo etiqueta="Contanos tu idea" para="pd-msg" class="sm:col-span-2"><textarea id="pd-msg" v-model="pedido.mensaje" rows="3" maxlength="1000" class="entrada" /></Campo>
              <!-- Campo trampa para bots: oculto para las personas -->
              <input v-model="pedido.sitio_web" type="text" name="sitio_web" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
              <p v-if="errorPedido" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorPedido }}</p>
              <button class="w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60 sm:col-span-2" :style="{ background: color }" :disabled="enviando">
                {{ enviando ? 'Enviando…' : 'Pedir esta fecha' }}</button>
              <p class="text-xs text-slate-500 sm:col-span-2">El salón te va a contactar para confirmar disponibilidad y condiciones. Enviar el pedido no reserva la fecha.</p>
            </form>
          </template>
          <div v-else class="space-y-4 py-6 text-center" role="status">
            <CalendarCheck class="mx-auto size-12" :style="{ color }" />
            <h2 class="text-xl font-semibold">¡Listo, {{ pedido.nombre.trim().split(' ')[0] }}!</h2>
            <p class="text-slate-600">{{ salon.nombre }} recibió tu pedido para el <strong>{{ fmtDiaLargo(pedido.fecha) }}</strong> y te va a contactar.</p>
            <a v-if="enlaceWhatsApp" :href="enlaceWhatsApp" target="_blank" rel="noopener"
               class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700">
              <MessageCircle class="size-5" /> Escribirles por WhatsApp</a>
          </div>
        </section>
      </main>
      <footer class="pb-6 text-center text-xs text-slate-400">Reservas con <a href="/" class="underline">Festy</a></footer>
    </template>
  </div>
</template>
