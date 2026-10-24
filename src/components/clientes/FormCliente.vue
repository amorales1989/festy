<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { ORIGENES_CLIENTE } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const props = defineProps<{ cliente?: Fila<'clientes'> | null }>()
const abierto = defineModel<boolean>({ required: true })
const emit = defineEmits<{ guardado: [id: string] }>()
const org = useOrganizacion()
const { exito } = useNotificaciones()
const vacio = () => ({ tipo: 'persona', nombre: '', documento: '', email: '', telefono: '', direccion: '', origen: '', notas: '' })
const f = reactive(vacio())
const error = ref('')
const guardando = ref(false)

watch(abierto, (v) => {
  if (!v) return
  error.value = ''
  const c = props.cliente
  Object.assign(f, vacio(), c ? { tipo: c.tipo, nombre: c.nombre, documento: c.documento ?? '', email: c.email ?? '', telefono: c.telefono ?? '', direccion: c.direccion ?? '', origen: c.origen ?? '', notas: c.notas ?? '' } : {})
})

async function guardar() {
  error.value = ''
  if (f.nombre.trim().length < 2) { error.value = 'Ingresá el nombre del cliente.'; return }
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { error.value = 'El email no es válido.'; return }
  guardando.value = true
  const datos = {
    tipo: f.tipo, nombre: f.nombre.trim(), documento: f.documento.trim() || null, email: f.email.trim().toLowerCase() || null,
    telefono: f.telefono.trim() || null, direccion: f.direccion.trim() || null, origen: f.origen || null, notas: f.notas.trim() || null,
  }
  try {
    const r = props.cliente
      ? await api.put<{ id: string }>(rutaOrg(org.id, `clientes/${props.cliente.id}`), datos)
      : await api.post<{ id: string }>(rutaOrg(org.id, 'clientes'), datos)
    exito(props.cliente ? 'Cliente actualizado.' : 'Cliente creado.')
    emit('guardado', r.id)
    abierto.value = false
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Modal v-model="abierto" :titulo="cliente ? 'Editar cliente' : 'Nuevo cliente'">
    <form id="form-cliente" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardar">
      <Campo etiqueta="Nombre y apellido / Razón social" para="c-nombre" requerido class="sm:col-span-2">
        <input id="c-nombre" v-model="f.nombre" class="entrada" />
      </Campo>
      <Campo etiqueta="Tipo" para="c-tipo">
        <select id="c-tipo" v-model="f.tipo" class="entrada"><option value="persona">Persona</option><option value="empresa">Empresa</option></select>
      </Campo>
      <Campo :etiqueta="f.tipo === 'empresa' ? 'CUIT' : 'DNI'" para="c-doc"><input id="c-doc" v-model="f.documento" class="entrada" inputmode="numeric" /></Campo>
      <Campo etiqueta="Teléfono / WhatsApp" para="c-tel"><input id="c-tel" v-model="f.telefono" type="tel" class="entrada" placeholder="+54 9 351 …" /></Campo>
      <Campo etiqueta="Email" para="c-email"><input id="c-email" v-model="f.email" type="email" class="entrada" /></Campo>
      <Campo etiqueta="Dirección" para="c-dir"><input id="c-dir" v-model="f.direccion" class="entrada" /></Campo>
      <Campo etiqueta="¿Cómo nos conoció?" para="c-origen">
        <select id="c-origen" v-model="f.origen" class="entrada"><option value="">—</option><option v-for="(t, k) in ORIGENES_CLIENTE" :key="k" :value="k">{{ t }}</option></select>
      </Campo>
      <Campo etiqueta="Notas" para="c-notas" class="sm:col-span-2"><textarea id="c-notas" v-model="f.notas" rows="2" class="entrada" /></Campo>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ error }}</p>
    </form>
    <template #pie>
      <button class="btn-secundario" @click="abierto = false">Cancelar</button>
      <button type="submit" form="form-cliente" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
    </template>
  </Modal>
</template>
