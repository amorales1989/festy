<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import Campo from '@/components/ui/Campo.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { ZONAS_HORARIAS } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { exito } = useNotificaciones()
const f = reactive({ nombre: '', razon_social: '', cuit: '', email_contacto: '', telefono: '', zona_horaria: '', horas_vencimiento_tentativa: 72, dias_devolucion_garantia: 7,
  direccion: '', logo: null as string | null, color_marca: '#7c3aed', condiciones_presupuesto: '', validez_presupuesto_dias: 15 })
const error = ref('')
const guardando = ref(false)
const puede = org.puede('organizacion.editar')

watch(() => org.actual, (o) => {
  if (o) Object.assign(f, { nombre: o.nombre, razon_social: o.razon_social ?? '', cuit: o.cuit ?? '', email_contacto: o.email_contacto ?? '',
    telefono: o.telefono ?? '', zona_horaria: o.zona_horaria, horas_vencimiento_tentativa: o.horas_vencimiento_tentativa, dias_devolucion_garantia: o.dias_devolucion_garantia,
    direccion: o.direccion ?? '', logo: o.logo, color_marca: o.color_marca, condiciones_presupuesto: o.condiciones_presupuesto ?? '',
    validez_presupuesto_dias: o.validez_presupuesto_dias })
}, { immediate: true })

// El logo se achica en el navegador (máx. 600×300) para que los PDF pesen poco.
async function elegirLogo(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  if (!/^image\/(png|jpeg)$/.test(archivo.type)) { error.value = 'El logo tiene que ser PNG o JPG.'; return }
  const img = new Image()
  img.src = URL.createObjectURL(archivo)
  await img.decode()
  const escala = Math.min(1, 600 / img.width, 300 / img.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(img.width * escala)
  lienzo.height = Math.round(img.height * escala)
  lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height)
  URL.revokeObjectURL(img.src)
  const datos = archivo.type === 'image/png' ? lienzo.toDataURL('image/png') : lienzo.toDataURL('image/jpeg', 0.85)
  if (datos.length > 400000) { error.value = 'El logo es demasiado pesado. Probá con una imagen más simple o en JPG.'; return }
  f.logo = datos
  error.value = ''
}

async function guardar() {
  error.value = ''
  if (f.cuit && !/^\d{2}-?\d{8}-?\d$/.test(f.cuit.trim())) { error.value = 'El CUIT debe tener 11 dígitos (ej.: 30-12345678-9).'; return }
  guardando.value = true
  try {
    await api.patch(rutaOrg(org.id), {
      nombre: f.nombre.trim(), razon_social: f.razon_social.trim() || null, cuit: f.cuit.trim() || null,
      email_contacto: f.email_contacto.trim() || null, telefono: f.telefono.trim() || null, zona_horaria: f.zona_horaria,
      horas_vencimiento_tentativa: f.horas_vencimiento_tentativa, dias_devolucion_garantia: f.dias_devolucion_garantia,
      direccion: f.direccion.trim() || null, logo: f.logo, color_marca: f.color_marca,
      condiciones_presupuesto: f.condiciones_presupuesto.trim() || null, validez_presupuesto_dias: f.validez_presupuesto_dias,
    })
    await org.refrescarActual()
    exito('Datos guardados.')
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="tarjeta space-y-4 p-5" @submit.prevent="guardar">
    <fieldset :disabled="!puede" class="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre comercial" para="o-nombre" requerido><input id="o-nombre" v-model="f.nombre" class="entrada" /></Campo>
      <Campo etiqueta="Razón social" para="o-rs"><input id="o-rs" v-model="f.razon_social" class="entrada" /></Campo>
      <Campo etiqueta="CUIT" para="o-cuit"><input id="o-cuit" v-model="f.cuit" class="entrada" placeholder="30-12345678-9" /></Campo>
      <Campo etiqueta="Teléfono" para="o-tel"><input id="o-tel" v-model="f.telefono" type="tel" class="entrada" /></Campo>
      <Campo etiqueta="Email de contacto" para="o-email"><input id="o-email" v-model="f.email_contacto" type="email" class="entrada" /></Campo>
      <Campo etiqueta="Zona horaria" para="o-zona" ayuda="Todas las fechas y horas se muestran en esta zona.">
        <select id="o-zona" v-model="f.zona_horaria" class="entrada">
          <option v-for="z in ZONAS_HORARIAS" :key="z" :value="z">{{ z.replace('America/', '').replace(/_/g, ' ') }}</option>
        </select>
      </Campo>
      <Campo etiqueta="Vencimiento de reservas tentativas (horas)" para="o-tent"
             ayuda="Pasado este plazo sin seña, la tentativa vuelve a consulta y libera la fecha.">
        <input id="o-tent" v-model.number="f.horas_vencimiento_tentativa" type="number" min="1" max="2160" class="entrada" />
      </Campo>
      <Campo etiqueta="Moneda" para="o-moneda"><input id="o-moneda" value="Pesos argentinos (ARS)" class="entrada" disabled /></Campo>
      <Campo etiqueta="Dirección" para="o-dir" class="sm:col-span-2" ayuda="Aparece en presupuestos y comprobantes.">
        <input id="o-dir" v-model="f.direccion" class="entrada" />
      </Campo>
    </fieldset>
    <fieldset :disabled="!puede" class="space-y-4 border-t border-slate-100 pt-4">
      <legend class="text-sm font-semibold text-slate-900">Presupuestos y comprobantes</legend>
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex h-20 w-40 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
          <img v-if="f.logo" :src="f.logo" alt="Logo" class="max-h-16 max-w-36 object-contain" />
          <span v-else class="text-xs text-slate-400">Sin logo</span>
        </div>
        <div class="space-y-2">
          <label class="btn-secundario btn-chico cursor-pointer">
            <input type="file" accept="image/png,image/jpeg" class="sr-only" @change="elegirLogo" /> {{ f.logo ? 'Cambiar logo' : 'Subir logo' }}
          </label>
          <button v-if="f.logo" type="button" class="btn-fantasma btn-chico text-rose-600" @click="f.logo = null">Quitar</button>
          <p class="text-xs text-slate-500">PNG o JPG. Se ajusta solo.</p>
        </div>
        <Campo etiqueta="Color de la marca" para="o-color">
          <input id="o-color" v-model="f.color_marca" type="color" class="h-10 w-20 cursor-pointer rounded-lg ring-1 ring-slate-300" />
        </Campo>
        <Campo etiqueta="Devolución de la garantía (días)" para="o-diasgar" ayuda="Plazo para devolverla después del evento. Se imprime en los documentos.">
          <input id="o-diasgar" v-model.number="f.dias_devolucion_garantia" type="number" min="0" max="90" class="entrada w-28" />
        </Campo>
        <Campo etiqueta="Validez del presupuesto (días)" para="o-validez">
          <input id="o-validez" v-model.number="f.validez_presupuesto_dias" type="number" min="1" max="180" class="entrada w-28" />
        </Campo>
      </div>
      <Campo etiqueta="Condiciones que se imprimen en los presupuestos" para="o-cond">
        <textarea id="o-cond" v-model="f.condiciones_presupuesto" rows="4" class="entrada" />
      </Campo>
    </fieldset>
    <p v-if="!puede" class="text-sm text-slate-500">Tu rol no permite editar estos datos.</p>
    <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div v-if="puede" class="flex justify-end"><button class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar cambios' }}</button></div>
  </form>
</template>
