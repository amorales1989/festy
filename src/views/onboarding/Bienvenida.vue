<script setup lang="ts">
// Incorporación guiada: 1) organización, 2) su salón (lugar + espacio principal), 3) datos de ejemplo.
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Building2, Check, MapPin, Sparkles } from 'lucide-vue-next'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { TIPOS_ESPACIO, ZONAS_HORARIAS } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'

const router = useRouter()
const org = useOrganizacion()
const sesion = useSesion()
const paso = ref(1)
const error = ref('')
const ocupado = ref(false)
const orgId = ref<string | null>(null)

const datosOrg = reactive({ nombre: '', zona: 'America/Argentina/Buenos_Aires' })
const sede = reactive({
  direccion: '', localidad: '', provincia: '',
  espacio: '', tipo: 'salon', capacidad: 150 as number | null,
  horarios: true, desde: '10:00', hasta: '05:00',
})

const pasos = [
  { n: 1, titulo: 'Tu organización', icono: Building2 },
  { n: 2, titulo: 'Tu primer espacio', icono: MapPin },
  { n: 3, titulo: '¡Listo!', icono: Sparkles },
]
const yaTieneOrganizaciones = computed(() => org.organizaciones.length > 0)

async function crearOrganizacion() {
  error.value = ''
  if (datosOrg.nombre.trim().length < 2) {
    error.value = 'Ingresá el nombre de tu salón o empresa.'
    return
  }
  ocupado.value = true
  try {
    orgId.value = (await api.post<{ id: string }>('/organizaciones', { nombre: datosOrg.nombre.trim(), zona_horaria: datosOrg.zona })).id
    sede.espacio ||= 'Salón principal'
    paso.value = 2
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    ocupado.value = false
  }
}

async function crearSede() {
  error.value = ''
  if (!orgId.value) return
  if (sede.espacio.trim().length < 2 || !sede.capacidad || sede.capacidad < 1) {
    error.value = 'Completá el nombre y la capacidad del espacio.'
    return
  }
  ocupado.value = true
  try {
    // El salón (lugar) se llama como la empresa y nace con su espacio principal.
    await api.post(rutaOrg(orgId.value!, 'salones/nuevo'), {
      nombre: datosOrg.nombre.trim(), espacio: sede.espacio.trim(), tipo: sede.tipo, capacidad_maxima: sede.capacidad,
      direccion: sede.direccion || null, localidad: sede.localidad || null, provincia: sede.provincia || null,
      horarios: sede.horarios ? [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia_semana: d, hora_desde: sede.desde, hora_hasta: sede.hasta })) : undefined,
    })
    paso.value = 3
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    ocupado.value = false
  }
}

async function finalizar(conEjemplos: boolean) {
  if (!orgId.value) return
  ocupado.value = true
  error.value = ''
  try {
    if (conEjemplos) await api.post(rutaOrg(orgId.value, 'ejemplos'))
    org.reiniciar()
    await org.cargarOrganizaciones()
    await org.seleccionar(orgId.value)
    await router.replace('/')
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <LayoutAuth :titulo="`¡Hola${sesion.perfil?.nombre ? ', ' + sesion.perfil.nombre.split(' ')[0] : ''}! Configuremos tu cuenta`"
              subtitulo="Son tres pasos y menos de dos minutos. Todo se puede cambiar después.">
    <ol class="mb-6 flex items-center gap-2" aria-label="Pasos">
      <li v-for="p in pasos" :key="p.n" class="flex flex-1 items-center gap-2">
        <span :class="['flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                       paso > p.n ? 'bg-emerald-500 text-white' : paso === p.n ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-500']"
              :aria-current="paso === p.n ? 'step' : undefined">
          <Check v-if="paso > p.n" class="size-4" /><template v-else>{{ p.n }}</template>
        </span>
        <span class="hidden text-xs font-medium text-slate-600 sm:inline">{{ p.titulo }}</span>
      </li>
    </ol>

    <form v-if="paso === 1" class="space-y-4" @submit.prevent="crearOrganizacion">
      <Campo etiqueta="Nombre de tu salón o empresa" para="org" requerido ayuda="Es el nombre que verá tu equipo.">
        <input id="org" v-model="datosOrg.nombre" class="entrada" placeholder="Ej.: Quinta Los Álamos" autofocus />
      </Campo>
      <Campo etiqueta="Zona horaria" para="zona" ayuda="Las fechas y horarios se muestran en esta zona.">
        <select id="zona" v-model="datosOrg.zona" class="entrada">
          <option v-for="z in ZONAS_HORARIAS" :key="z" :value="z">{{ z.replace('America/', '').replace(/_/g, ' ') }}</option>
        </select>
      </Campo>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button class="btn-primario w-full" :disabled="ocupado">{{ ocupado ? 'Creando…' : 'Continuar' }}</button>
      <RouterLink v-if="yaTieneOrganizaciones" to="/" class="btn-fantasma w-full">Volver a mi organización</RouterLink>
    </form>

    <form v-else-if="paso === 2" class="space-y-4" @submit.prevent="crearSede">
      <div class="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del espacio" para="esp" requerido class="sm:col-span-2">
          <input id="esp" v-model="sede.espacio" class="entrada" placeholder="Ej.: Salón principal" />
        </Campo>
        <Campo etiqueta="Tipo" para="tipo">
          <select id="tipo" v-model="sede.tipo" class="entrada">
            <option v-for="(t, k) in TIPOS_ESPACIO" :key="k" :value="k">{{ t }}</option>
          </select>
        </Campo>
        <Campo etiqueta="Capacidad máxima" para="cap" requerido>
          <input id="cap" v-model.number="sede.capacidad" type="number" min="1" class="entrada" />
        </Campo>
        <Campo etiqueta="Dirección" para="dir" class="sm:col-span-2">
          <input id="dir" v-model="sede.direccion" class="entrada" placeholder="Calle y número" />
        </Campo>
        <Campo etiqueta="Localidad" para="loc"><input id="loc" v-model="sede.localidad" class="entrada" /></Campo>
        <Campo etiqueta="Provincia" para="prov"><input id="prov" v-model="sede.provincia" class="entrada" /></Campo>
      </div>
      <fieldset class="rounded-lg bg-slate-50 p-3">
        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input v-model="sede.horarios" type="checkbox" class="rounded border-slate-300 text-marca-600" />
          Horario de atención todos los días
        </label>
        <div v-if="sede.horarios" class="mt-2 flex items-center gap-2 text-sm text-slate-600">
          de <CampoHora v-model="sede.desde" class="w-24" aria-label="Desde" />
          a <CampoHora v-model="sede.hasta" class="w-24" aria-label="Hasta" />
        </div>
        <p class="mt-1 text-xs text-slate-500">Si el cierre es antes que la apertura, se entiende que pasa la medianoche.</p>
      </fieldset>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <div class="flex gap-2">
        <button type="button" class="btn-secundario flex-1" :disabled="ocupado" @click="paso = 3">Lo hago después</button>
        <button class="btn-primario flex-1" :disabled="ocupado">{{ ocupado ? 'Guardando…' : 'Continuar' }}</button>
      </div>
    </form>

    <div v-else class="space-y-4">
      <p class="text-sm text-slate-600">
        ¿Querés ver Festy funcionando con datos de ejemplo? Vas a poder borrarlos con un clic desde
        <strong>Configuración → Datos</strong>, y no cuentan para la configuración real.
      </p>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <div class="grid gap-2">
        <button class="btn-primario" :disabled="ocupado" @click="finalizar(true)"><Sparkles class="size-4" /> Cargar datos de ejemplo</button>
        <button class="btn-secundario" :disabled="ocupado" @click="finalizar(false)">Empezar vacío</button>
      </div>
    </div>
  </LayoutAuth>
</template>
