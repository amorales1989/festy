<script setup lang="ts">
// Bloqueo de fechas para uno o varios espacios. Se insertan todas las filas en
// una sola sentencia: si alguna choca con una reserva, no se guarda ninguna.
import { computed, reactive, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { desdeLocal, sumarDiasISO } from '@/lib/formato'
import { TIPOS_BLOQUEO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const props = defineProps<{ fecha?: string; sucursalId?: string }>()
const abierto = defineModel<boolean>({ required: true })
const emit = defineEmits<{ guardado: [] }>()
const org = useOrganizacion()
const { exito } = useNotificaciones()

const f = reactive({ sucursal: '', espacios: [] as string[], desde: '', horaDesde: '00:00', hasta: '', horaHasta: '00:00', diaCompleto: true, tipo: 'mantenimiento', motivo: '' })
const error = ref('')
const guardando = ref(false)

watch(abierto, (v) => {
  if (!v) return
  error.value = ''
  f.sucursal = props.sucursalId || org.sucursalesActivas[0]?.id || ''
  f.espacios = org.espaciosActivos.filter((e) => e.sucursal_id === f.sucursal).map((e) => e.id)
  f.desde = props.fecha ?? ''
  f.hasta = props.fecha ?? ''
  f.diaCompleto = true
  f.motivo = ''
  f.tipo = 'mantenimiento'
})
const espacios = computed(() => org.espaciosActivos.filter((e) => e.sucursal_id === f.sucursal))
watch(() => f.sucursal, () => { f.espacios = espacios.value.map((e) => e.id) })

async function guardar() {
  error.value = ''
  if (!f.espacios.length) { error.value = 'Elegí al menos un espacio.'; return }
  if (!f.desde || !f.hasta || f.hasta < f.desde) { error.value = 'Revisá las fechas: el fin debe ser igual o posterior al inicio.'; return }
  const inicio = desdeLocal(f.desde, f.diaCompleto ? '00:00' : f.horaDesde, org.zona)
  const fin = f.diaCompleto ? desdeLocal(sumarDiasISO(f.hasta, 1), '00:00', org.zona) : desdeLocal(f.hasta, f.horaHasta, org.zona)
  if (fin <= inicio) { error.value = 'El fin debe ser posterior al inicio.'; return }
  guardando.value = true
  try {
    await api.post(rutaOrg(org.id, 'bloqueos'), { espacios: f.espacios, inicio, fin, tipo: f.tipo, motivo: f.motivo.trim() || null })
    exito('Fechas bloqueadas.')
    emit('guardado')
    abierto.value = false
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Modal v-model="abierto" titulo="Cerrar fechas" descripcion="Mientras estén cerrados, esos espacios no se pueden reservar (por ejemplo, por mantenimiento o vacaciones).">
    <form id="form-bloqueo" class="space-y-4" @submit.prevent="guardar">
      <Campo v-if="org.sucursalesActivas.length > 1" etiqueta="Salón" para="b-suc">
        <select id="b-suc" v-model="f.sucursal" class="entrada">
          <option v-for="s in org.sucursalesActivas" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
      </Campo>
      <fieldset>
        <legend class="mb-1 text-sm font-medium text-slate-700">Espacios</legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="e in espacios" :key="e.id" class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-300">
            <input v-model="f.espacios" type="checkbox" :value="e.id" class="rounded border-slate-300 text-marca-600" /> {{ e.nombre }}
          </label>
        </div>
      </fieldset>
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="f.diaCompleto" type="checkbox" class="rounded border-slate-300 text-marca-600" /> Días completos
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde" para="b-desde" requerido>
          <CampoFecha id="b-desde" v-model="f.desde" />
          <CampoHora v-if="!f.diaCompleto" v-model="f.horaDesde" class="mt-2" aria-label="Hora desde" />
        </Campo>
        <Campo etiqueta="Hasta" para="b-hasta" requerido>
          <CampoFecha id="b-hasta" v-model="f.hasta" />
          <CampoHora v-if="!f.diaCompleto" v-model="f.horaHasta" class="mt-2" aria-label="Hora hasta" />
        </Campo>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo" para="b-tipo">
          <select id="b-tipo" v-model="f.tipo" class="entrada">
            <option v-for="(t, k) in TIPOS_BLOQUEO" :key="k" :value="k">{{ t }}</option>
          </select>
        </Campo>
        <Campo etiqueta="Motivo" para="b-motivo"><input id="b-motivo" v-model="f.motivo" class="entrada" placeholder="Ej.: pintura del salón" /></Campo>
      </div>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
    </form>
    <template #pie>
      <button type="button" class="btn-secundario" @click="abierto = false">Cancelar</button>
      <button type="submit" form="form-bloqueo" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Cerrar fechas' }}</button>
    </template>
  </Modal>
</template>
