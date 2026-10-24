<script setup lang="ts">
// Administración de Festy: alta de empresas cliente y listado de todas.
// Solo para los administradores de la plataforma (lo verifica el servidor).
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, Building2, CircleAlert, CircleCheck, Clock, Copy, History, KeyRound, LogOut, Plus, RefreshCw, Trash2, Wallet } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import Cargando from '@/components/ui/Cargando.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import { api } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtFechaHora, fmtMoneda, hoyISO, ZONA_POR_DEFECTO } from '@/lib/formato'
import { MEDIOS_PAGO, ZONAS_HORARIAS } from '@/lib/catalogos'
import { useConfirmar } from '@/composables/useConfirmar'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Empresa {
  id: string; nombre: string; estado: string; creado_at: string; usuarios: number; eventos: number; ultimo_evento_cargado: string | null; pagina: string | null
  duenio: { nombre: string | null; email: string; ultimo_ingreso: string | null } | null
  precio: number; precio_tarifa: number; precio_especial: number | null; sedes: number; pagado_hasta: string | null
  ultimo_pago: { id: string; fecha: string; monto: number; medio: string; meses: number } | null
}
interface PagoSuscripcion { id: string; fecha: string; monto: number; medio: string; meses: number; cubre_desde: string; cubre_hasta: string; notas: string | null; registrado_por: string | null }

const org = useOrganizacion()
const sesion = useSesion()
const { exito } = useNotificaciones()
const empresas = ref<Empresa[]>([])
const cargando = ref(true)
const error = ref('')
const filtro = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try { empresas.value = await api.get<Empresa[]>('/plataforma/empresas') } catch (e) { error.value = traducirError(e) } finally { cargando.value = false }
}
onMounted(cargar)
const visibles = computed(() => {
  const t = filtro.value.trim().toLowerCase()
  return t ? empresas.value.filter((e) => `${e.nombre} ${e.duenio?.email ?? ''} ${e.duenio?.nombre ?? ''}`.toLowerCase().includes(t)) : empresas.value
})

// --- Alta de empresa ----------------------------------------------------------------
const claveSugerida = () => {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint32Array(10))
  return 'Festy-' + Array.from(r, (n) => letras[n % letras.length]).join('')
}
const abierto = ref(false)
const f = reactive({ empresa: '', zona_horaria: ZONA_POR_DEFECTO, nombre: '', email: '', clave: '' })
const errorForm = ref('')
const guardando = ref(false)
const resultado = ref<{ empresa: string; email: string; clave: string | null } | null>(null)
function abrir() {
  Object.assign(f, { empresa: '', zona_horaria: ZONA_POR_DEFECTO, nombre: '', email: '', clave: claveSugerida() })
  errorForm.value = ''
  resultado.value = null
  abierto.value = true
}
async function crear() {
  errorForm.value = ''
  if (f.empresa.trim().length < 2) { errorForm.value = 'Ingresá el nombre de la empresa.'; return }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { errorForm.value = 'Ingresá un email válido para el dueño.'; return }
  if (f.clave.length < 8) { errorForm.value = 'La contraseña inicial debe tener al menos 8 caracteres.'; return }
  guardando.value = true
  try {
    const r = await api.post<{ cuenta_nueva: boolean }>('/plataforma/empresas', { ...f, email: f.email.trim().toLowerCase() })
    resultado.value = { empresa: f.empresa.trim(), email: f.email.trim().toLowerCase(), clave: r.cuenta_nueva ? f.clave : null }
    void cargar()
  } catch (e) {
    errorForm.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}
const textoAcceso = computed(() => resultado.value
  ? `¡Hola! Ya está lista tu cuenta de Festy para ${resultado.value.empresa}.\nIngresá en ${location.origin}/ingresar\nUsuario: ${resultado.value.email}`
    + (resultado.value.clave ? `\nContraseña: ${resultado.value.clave}\nAl entrar, cambiala con el ícono de la llave (abajo a la izquierda).` : '\nUsá la contraseña que ya tenés.')
  : '')
async function copiar() {
  try { await navigator.clipboard.writeText(textoAcceso.value); exito('Datos de acceso copiados.') } catch { /* el navegador no permite copiar */ }
}
// --- Cobro de la suscripción -------------------------------------------------------
const { confirmar } = useConfirmar()
const { error: notificarError } = useNotificaciones()
const hoy = hoyISO(ZONA_POR_DEFECTO)
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 864e5)
/** Suma meses a una fecha 'yyyy-MM-dd' (como el SQL: el 31 pasa al último día del mes). */
function sumarMeses(iso: string, meses: number) {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number]
  const fin = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate()
  const f = new Date(Date.UTC(a, m - 1 + meses, Math.min(d, fin)))
  return f.toISOString().slice(0, 10)
}
type EstadoPago = { tono: 'ok' | 'aviso' | 'mal' | 'nada'; texto: string }
function estadoPago(e: Empresa): EstadoPago {
  if (!e.pagado_hasta) return { tono: 'nada', texto: 'Sin pagos' }
  const d = diasEntre(hoy, e.pagado_hasta)
  if (d < 0) return { tono: 'mal', texto: `Vencido hace ${-d} ${-d === 1 ? 'día' : 'días'}` }
  if (d <= 5) return { tono: 'aviso', texto: `Vence el ${fmtFecha(e.pagado_hasta, ZONA_POR_DEFECTO)}` }
  return { tono: 'ok', texto: `Al día hasta ${fmtFecha(e.pagado_hasta, ZONA_POR_DEFECTO)}` }
}
const TONO_PAGO = { ok: 'bg-emerald-50 text-emerald-800', aviso: 'bg-amber-50 text-amber-800', mal: 'bg-rose-50 text-rose-800', nada: 'bg-slate-100 text-slate-600' }
const ICONO_PAGO = { ok: CircleCheck, aviso: Clock, mal: CircleAlert, nada: CircleAlert }
const resumenCobro = computed(() => {
  const r = { al_dia: 0, vencidas: 0, sin_pagos: 0, mensual: 0 }
  for (const e of empresas.value) {
    const t = estadoPago(e).tono
    if (t === 'mal') r.vencidas++
    else if (t === 'nada') r.sin_pagos++
    else r.al_dia++
    r.mensual += Number(e.precio ?? 0)
  }
  return r
})

// Registrar pago
const pagoAbierto = ref(false)
const empresaPago = ref<Empresa | null>(null)
const fp = reactive({ fecha: hoy, meses: 1, monto: null as number | null, medio: 'transferencia', notas: '' })
const errorPago = ref('')
const montoTocado = ref(false)
function abrirPago(e: Empresa) {
  empresaPago.value = e
  Object.assign(fp, { fecha: hoy, meses: 1, monto: Number(e.precio), medio: e.ultimo_pago?.medio ?? 'transferencia', notas: '' })
  montoTocado.value = false
  errorPago.value = ''
  pagoAbierto.value = true
}
function cambiarMeses() {
  if (!montoTocado.value && empresaPago.value) fp.monto = Number(empresaPago.value.precio) * fp.meses
}
const cubreDesde = computed(() => {
  const h = empresaPago.value?.pagado_hasta
  return h && h >= fp.fecha ? h : fp.fecha
})
const cubreHasta = computed(() => (fp.fecha ? sumarMeses(cubreDesde.value, fp.meses) : ''))
async function registrarPago() {
  errorPago.value = ''
  if (!fp.fecha) { errorPago.value = 'Indicá la fecha del pago.'; return }
  if (!fp.monto || fp.monto <= 0) { errorPago.value = 'Ingresá el monto.'; return }
  try {
    await api.post(`/plataforma/empresas/${empresaPago.value!.id}/pagos`, { ...fp })
    exito(`Pago registrado. ${empresaPago.value!.nombre} queda al día hasta el ${fmtFecha(cubreHasta.value, ZONA_POR_DEFECTO)}.`)
    pagoAbierto.value = false
    await cargar()
    if (historialAbierto.value && empresaHist.value) void cargarHistorial()
  } catch (e) { errorPago.value = traducirError(e) }
}

// Historial y precio
const historialAbierto = ref(false)
const empresaHist = ref<Empresa | null>(null)
const pagos = ref<PagoSuscripcion[]>([])
const precio = ref<number | null>(null)
async function cargarHistorial() {
  pagos.value = await api.get<PagoSuscripcion[]>(`/plataforma/empresas/${empresaHist.value!.id}/pagos`).catch(() => [])
}
function abrirHistorial(e: Empresa) {
  empresaHist.value = e
  precio.value = e.precio_especial !== null ? Number(e.precio_especial) : null
  pagos.value = []
  historialAbierto.value = true
  void cargarHistorial()
}
async function guardarPrecio() {
  try {
    await api.put(`/plataforma/empresas/${empresaHist.value!.id}/precio`, { precio: precio.value })
    exito(precio.value === null ? 'Vuelve a cobrarse según la tarifa.' : 'Precio especial guardado.')
    await cargar()
    empresaHist.value = empresas.value.find((x) => x.id === empresaHist.value!.id) ?? empresaHist.value
  } catch (e) { notificarError(e) }
}
async function borrarPago(p: PagoSuscripcion) {
  if (!(await confirmar({ titulo: 'Borrar pago', mensaje: `¿Borrar el pago de ${fmtMoneda(p.monto)} del ${fmtFecha(p.fecha, ZONA_POR_DEFECTO)}? Se recalcula hasta cuándo está pagada.`, confirmar: 'Borrar', peligro: true }))) return
  try {
    await api.delete(`/plataforma/pagos/${p.id}`)
    await Promise.all([cargarHistorial(), cargar()])
  } catch (e) { notificarError(e) }
}
const ESTADOS: Record<string, string> = { activa: 'Activa', suspendida: 'Suspendida', baja_solicitada: 'Baja solicitada' }
</script>

<template>
  <div class="min-h-dvh bg-slate-50 pb-[var(--ins-bottom)]">
    <header class="border-b border-slate-200 bg-white">
      <div class="flex flex-wrap items-center gap-3 px-4 pt-[calc(1rem+var(--ins-top))] pb-4 sm:px-6 lg:px-8">
        <img src="/favicon.svg" alt="" class="size-8" />
        <div class="mr-auto">
          <h1 class="text-lg font-semibold">Administración de Festy</h1>
          <p class="text-xs text-slate-500">Alta de empresas cliente · {{ sesion.usuario?.email }}</p>
        </div>
        <RouterLink v-if="org.actual" to="/" class="btn-secundario"><ArrowLeft class="size-4" /> Volver a la app</RouterLink>
        <RouterLink to="/nueva-clave" class="btn-fantasma"><KeyRound class="size-4" /> Cambiar contraseña</RouterLink>
        <button class="btn-fantasma" @click="sesion.salir().then(() => $router.replace('/ingresar'))"><LogOut class="size-4" /> Salir</button>
      </div>
    </header>

    <main class="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="filtro" class="entrada w-full sm:w-80" placeholder="Buscar por empresa, dueño o email" aria-label="Buscar empresa" />
        <span class="text-sm text-slate-500">{{ empresas.length }} {{ empresas.length === 1 ? 'empresa' : 'empresas' }}</span>
        <button class="btn-fantasma ml-auto" aria-label="Actualizar" @click="cargar"><RefreshCw class="size-4" /></button>
        <button class="btn-primario" @click="abrir"><Plus class="size-4" /> Nueva empresa</button>
      </div>
      <p v-if="empresas.length" class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>Ingreso mensual esperado: <strong class="tabular-nums text-slate-900">{{ fmtMoneda(resumenCobro.mensual) }}</strong></span>
        <span class="text-emerald-700">{{ resumenCobro.al_dia }} al día</span>
        <span :class="resumenCobro.vencidas ? 'font-semibold text-rose-700' : 'text-slate-500'">{{ resumenCobro.vencidas }} {{ resumenCobro.vencidas === 1 ? 'vencida' : 'vencidas' }}</span>
        <span class="text-slate-500">{{ resumenCobro.sin_pagos }} sin pagos</span>
      </p>
      <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
      <div class="tarjeta overflow-x-auto">
        <Cargando v-if="cargando && !empresas.length" />
        <EstadoVacio v-else-if="!visibles.length" :icono="Building2" titulo="No hay empresas" descripcion="Dá de alta la primera con «Nueva empresa»." />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Empresa</th><th class="text-right">Precio / mes</th><th>Último pago</th><th>Pago</th>
            <th class="hidden xl:table-cell">Último ingreso</th><th class="hidden text-right lg:table-cell">Eventos</th><th class="hidden 2xl:table-cell">Alta</th><th /></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="e in visibles" :key="e.id">
              <td class="min-w-48"><span class="font-medium">{{ e.nombre }}</span>
                <span class="block text-xs text-slate-500">{{ e.duenio?.nombre || '—' }} · {{ e.duenio?.email }}</span>
                <a v-if="e.pagina" :href="`/s/${e.pagina}`" target="_blank" rel="noopener" class="text-xs text-marca-700 hover:underline">/s/{{ e.pagina }}</a>
                <span v-if="e.estado !== 'activa'" class="ml-1 text-xs text-rose-700">{{ ESTADOS[e.estado] ?? e.estado }}</span></td>
              <td class="whitespace-nowrap text-right"><span class="tabular-nums">{{ fmtMoneda(e.precio, true) }}</span>
                <span class="block text-xs text-slate-500">{{ e.precio_especial !== null ? 'precio especial' : `tarifa · ${Math.max(e.sedes, 1)} ${e.sedes > 1 ? 'salones' : 'salón'}` }}</span></td>
              <td class="whitespace-nowrap"><template v-if="e.ultimo_pago">{{ fmtFecha(e.ultimo_pago.fecha, ZONA_POR_DEFECTO) }}
                <span class="block text-xs text-slate-500">{{ fmtMoneda(e.ultimo_pago.monto, true) }} · {{ MEDIOS_PAGO[e.ultimo_pago.medio] ?? e.ultimo_pago.medio }}{{ e.ultimo_pago.meses > 1 ? ` · ${e.ultimo_pago.meses} meses` : '' }}</span></template>
                <span v-else class="text-slate-400">—</span></td>
              <td class="whitespace-nowrap"><span :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', TONO_PAGO[estadoPago(e).tono]]">
                <component :is="ICONO_PAGO[estadoPago(e).tono]" class="size-3.5" aria-hidden="true" />{{ estadoPago(e).texto }}</span></td>
              <td class="hidden whitespace-nowrap xl:table-cell">{{ e.duenio?.ultimo_ingreso ? fmtFechaHora(e.duenio.ultimo_ingreso, ZONA_POR_DEFECTO) : 'Nunca' }}</td>
              <td class="hidden text-right tabular-nums lg:table-cell">{{ e.eventos }}</td>
              <td class="hidden whitespace-nowrap 2xl:table-cell">{{ fmtFecha(e.creado_at, ZONA_POR_DEFECTO) }}</td>
              <td class="whitespace-nowrap text-right">
                <button class="btn-secundario btn-chico" @click="abrirPago(e)"><Wallet class="size-4" /> Registrar pago</button>
                <button class="btn-fantasma btn-chico" :aria-label="`Pagos y precio de ${e.nombre}`" @click="abrirHistorial(e)"><History class="size-4" /> Pagos</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <Modal v-model="abierto" :titulo="resultado ? 'Empresa creada' : 'Nueva empresa'">
      <form v-if="!resultado" id="form-empresa" class="grid gap-3 sm:grid-cols-2" @submit.prevent="crear">
        <Campo etiqueta="Nombre de la empresa o salón" para="pl-empresa" requerido class="sm:col-span-2"><input id="pl-empresa" v-model="f.empresa" class="entrada" /></Campo>
        <Campo etiqueta="Nombre del dueño" para="pl-nombre"><input id="pl-nombre" v-model="f.nombre" class="entrada" /></Campo>
        <Campo etiqueta="Email del dueño (su usuario)" para="pl-email" requerido><input id="pl-email" v-model="f.email" type="email" class="entrada" /></Campo>
        <Campo etiqueta="Contraseña inicial" para="pl-clave" ayuda="Pasásela al dueño; la puede cambiar al entrar. Si el email ya tiene cuenta, se mantiene la suya.">
          <div class="flex gap-2"><input id="pl-clave" v-model="f.clave" class="entrada font-mono" autocomplete="off" />
            <button type="button" class="btn-secundario px-2" aria-label="Generar otra" @click="f.clave = claveSugerida()"><KeyRound class="size-4" /></button></div>
        </Campo>
        <Campo etiqueta="Zona horaria" para="pl-zona"><select id="pl-zona" v-model="f.zona_horaria" class="entrada">
          <option v-for="z in ZONAS_HORARIAS" :key="z" :value="z">{{ z.replace("America/Argentina/", "").replace("_", " ") }}</option></select></Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}</p>
      </form>
      <div v-else class="space-y-3 text-sm">
        <p class="text-slate-700">Listo. Enviale estos datos al dueño (por WhatsApp o email):</p>
        <pre class="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-slate-800">{{ textoAcceso }}</pre>
        <p class="text-xs text-slate-500">La contraseña no se vuelve a mostrar. Al entrar, el dueño carga su salón (nombre, dirección y capacidad) y ya puede reservar.</p>
      </div>
      <template #pie>
        <template v-if="!resultado">
          <button class="btn-secundario" @click="abierto = false">Cancelar</button>
          <button type="submit" form="form-empresa" class="btn-primario" :disabled="guardando">{{ guardando ? 'Creando…' : 'Crear empresa' }}</button>
        </template>
        <template v-else>
          <button class="btn-secundario" @click="copiar"><Copy class="size-4" /> Copiar datos</button>
          <button class="btn-primario" @click="abierto = false">Listo</button>
        </template>
      </template>
    </Modal>

    <Modal v-model="pagoAbierto" titulo="Registrar pago" ancho="sm" :descripcion="empresaPago ? `${empresaPago.nombre} · ${fmtMoneda(empresaPago.precio, true)} por mes` : ''">
      <form id="form-pago-susc" class="space-y-3" @submit.prevent="registrarPago">
        <div class="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha del pago" para="ps-fecha"><CampoFecha id="ps-fecha" v-model="fp.fecha" /></Campo>
          <Campo etiqueta="Meses que paga" para="ps-meses"><select id="ps-meses" v-model.number="fp.meses" class="entrada" @change="cambiarMeses">
            <option v-for="m in [1, 2, 3, 4, 6, 12]" :key="m" :value="m">{{ m }} {{ m === 1 ? 'mes' : 'meses' }}</option></select></Campo>
        </div>
        <Campo etiqueta="Monto" para="ps-monto"><CampoMoneda id="ps-monto" v-model="fp.monto" @update:model-value="montoTocado = true" /></Campo>
        <Campo etiqueta="Medio" para="ps-medio"><select id="ps-medio" v-model="fp.medio" class="entrada">
          <option v-for="(m, k) in MEDIOS_PAGO" :key="k" :value="k">{{ m }}</option></select></Campo>
        <Campo etiqueta="Nota (opcional)" para="ps-notas"><input id="ps-notas" v-model="fp.notas" class="entrada" placeholder="N° de operación, factura…" /></Campo>
        <p v-if="cubreHasta" class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Cubre del {{ fmtFecha(cubreDesde, ZONA_POR_DEFECTO) }} al {{ fmtFecha(cubreHasta, ZONA_POR_DEFECTO) }}.</p>
        <p v-if="errorPago" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorPago }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="pagoAbierto = false">Cancelar</button>
        <button type="submit" form="form-pago-susc" class="btn-primario">Registrar pago</button>
      </template>
    </Modal>

    <Modal v-model="historialAbierto" :titulo="empresaHist ? `Pagos de ${empresaHist.nombre}` : 'Pagos'" ancho="lg">
      <div class="space-y-4">
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="guardarPrecio">
          <Campo etiqueta="Precio especial por mes" para="ps-precio" class="w-56"
                 :ayuda="empresaHist ? `Vacío = tarifa: ${fmtMoneda(empresaHist.precio_tarifa, true)} (${Math.max(empresaHist.sedes, 1)} ${empresaHist.sedes > 1 ? 'salones' : 'salón'})` : ''">
            <CampoMoneda id="ps-precio" v-model="precio" /></Campo>
          <button class="btn-secundario">Guardar</button>
          <button type="button" class="btn-primario ml-auto" @click="empresaHist && abrirPago(empresaHist)"><Wallet class="size-4" /> Registrar pago</button>
        </form>
        <p v-if="!pagos.length" class="py-4 text-center text-sm text-slate-500">Todavía no hay pagos registrados.</p>
        <table v-else class="tabla text-sm">
          <thead class="bg-slate-50"><tr><th>Fecha</th><th class="text-right">Monto</th><th>Cubre</th><th class="hidden sm:table-cell">Medio</th><th /></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in pagos" :key="p.id">
              <td class="whitespace-nowrap">{{ fmtFecha(p.fecha, ZONA_POR_DEFECTO) }}<span v-if="p.notas" class="block text-xs text-slate-500">{{ p.notas }}</span></td>
              <td class="text-right tabular-nums">{{ fmtMoneda(p.monto, true) }}</td>
              <td class="whitespace-nowrap">{{ fmtFecha(p.cubre_desde, ZONA_POR_DEFECTO) }} al {{ fmtFecha(p.cubre_hasta, ZONA_POR_DEFECTO) }}
                <span class="block text-xs text-slate-500">{{ p.meses }} {{ p.meses === 1 ? 'mes' : 'meses' }}</span></td>
              <td class="hidden sm:table-cell">{{ MEDIOS_PAGO[p.medio] ?? p.medio }}</td>
              <td class="text-right"><button class="btn-fantasma p-1.5 text-rose-600" :aria-label="`Borrar pago del ${fmtFecha(p.fecha, ZONA_POR_DEFECTO)}`" @click="borrarPago(p)"><Trash2 class="size-4" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #pie><button class="btn-primario" @click="historialAbierto = false">Listo</button></template>
    </Modal>
  </div>
</template>
