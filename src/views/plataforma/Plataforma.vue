<script setup lang="ts">
// Administración de Festy: alta de empresas cliente y listado de todas.
// Solo para los administradores de la plataforma (lo verifica el servidor).
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, Building2, Copy, KeyRound, LogOut, Plus, RefreshCw } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import Cargando from '@/components/ui/Cargando.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import { api } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtFechaHora, ZONA_POR_DEFECTO } from '@/lib/formato'
import { ZONAS_HORARIAS } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Empresa {
  id: string; nombre: string; estado: string; creado_at: string; usuarios: number; eventos: number; ultimo_evento_cargado: string | null; pagina: string | null
  duenio: { nombre: string | null; email: string; ultimo_ingreso: string | null } | null
}

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
      <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
      <div class="tarjeta overflow-x-auto">
        <Cargando v-if="cargando && !empresas.length" />
        <EstadoVacio v-else-if="!visibles.length" :icono="Building2" titulo="No hay empresas" descripcion="Dá de alta la primera con «Nueva empresa»." />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Empresa</th><th>Dueño</th><th class="hidden md:table-cell">Alta</th><th class="hidden lg:table-cell">Último ingreso</th>
            <th class="text-right">Usuarios</th><th class="text-right">Eventos</th><th class="hidden sm:table-cell">Estado</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="e in visibles" :key="e.id">
              <td><span class="font-medium">{{ e.nombre }}</span>
                <a v-if="e.pagina" :href="`/s/${e.pagina}`" target="_blank" rel="noopener" class="block text-xs text-marca-700 hover:underline">/s/{{ e.pagina }}</a></td>
              <td><span>{{ e.duenio?.nombre || '—' }}</span><span class="block text-xs text-slate-500">{{ e.duenio?.email }}</span></td>
              <td class="hidden whitespace-nowrap md:table-cell">{{ fmtFecha(e.creado_at, ZONA_POR_DEFECTO) }}</td>
              <td class="hidden whitespace-nowrap lg:table-cell">{{ e.duenio?.ultimo_ingreso ? fmtFechaHora(e.duenio.ultimo_ingreso, ZONA_POR_DEFECTO) : 'Nunca' }}</td>
              <td class="text-right tabular-nums">{{ e.usuarios }}</td>
              <td class="text-right tabular-nums">{{ e.eventos }}</td>
              <td class="hidden sm:table-cell">{{ ESTADOS[e.estado] ?? e.estado }}</td>
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
        <p class="text-xs text-slate-500">La contraseña no se vuelve a mostrar. Al entrar, el dueño carga sus sedes y espacios guiado por el inicio.</p>
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
  </div>
</template>
