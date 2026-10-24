<script setup lang="ts">
// Página web pública del salón: dirección, descripción y WhatsApp. El logo y el
// color se toman de "Organización". Los pedidos llegan como consultas.
import { computed, reactive, ref, watch } from 'vue'
import { Copy, ExternalLink, Globe } from 'lucide-vue-next'
import Campo from '@/components/ui/Campo.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { normalizar } from '@/lib/texto'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { exito } = useNotificaciones()
const puedeEditar = computed(() => org.puede('organizacion.editar'))
const f = reactive({ pagina_activa: false, pagina_slug: '', pagina_descripcion: '', pagina_whatsapp: '' })
const error = ref('')
const guardando = ref(false)

const sugerido = (nombre: string) => normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
watch(() => org.actual, (o) => {
  if (!o) return
  Object.assign(f, {
    pagina_activa: o.pagina_activa, pagina_slug: o.pagina_slug ?? sugerido(o.nombre),
    pagina_descripcion: o.pagina_descripcion ?? '', pagina_whatsapp: o.pagina_whatsapp ?? (o.telefono ?? '').replace(/\D/g, ''),
  })
}, { immediate: true })

const origen = location.origin
const enlace = computed(() => `${origen}/s/${f.pagina_slug}`)
const slugValido = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.pagina_slug) && f.pagina_slug.length >= 3 && f.pagina_slug.length <= 40)
const publicada = computed(() => org.actual?.pagina_activa && org.actual.pagina_slug)

async function guardar() {
  error.value = ''
  f.pagina_slug = f.pagina_slug.trim().toLowerCase()
  if (!slugValido.value) { error.value = 'La dirección puede tener letras sin acentos, números y guiones (de 3 a 40 caracteres).'; return }
  const wa = f.pagina_whatsapp.replace(/\D/g, '')
  if (wa && (wa.length < 8 || wa.length > 15)) { error.value = 'El WhatsApp debe tener entre 8 y 15 dígitos, con código de país (ej.: 5491155550000).'; return }
  guardando.value = true
  try {
    await api.put(rutaOrg(org.id, 'pagina'), { ...f, pagina_whatsapp: wa })
    await org.refrescarActual()
    exito(f.pagina_activa ? 'Página publicada.' : 'Cambios guardados. La página no está publicada.')
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}
async function copiar() {
  try { await navigator.clipboard.writeText(enlace.value); exito('Enlace copiado.') } catch { /* el navegador no permite copiar */ }
}
</script>

<template>
  <form class="tarjeta space-y-4 p-5" @submit.prevent="guardar">
    <div>
      <h2 class="flex items-center gap-2 font-semibold"><Globe class="size-4 text-marca-600" /> Página web del salón</h2>
      <p class="mt-1 text-sm text-slate-600">Compartila en Instagram, Google o WhatsApp. Los clientes ven tus espacios, qué fechas están libres y te piden la suya:
        el pedido entra como <strong>consulta</strong> (no bloquea la fecha) y te avisa en la campana.</p>
    </div>
    <label class="flex items-center gap-2 text-sm font-medium"><input v-model="f.pagina_activa" type="checkbox" :disabled="!puedeEditar" /> Publicar la página</label>
    <Campo etiqueta="Dirección de la página" para="pg-slug" :error="f.pagina_slug && !slugValido ? 'Solo letras sin acentos, números y guiones.' : ''">
      <div class="flex items-stretch">
        <span class="hidden items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-2 text-sm text-slate-500 sm:flex">{{ origen }}/s/</span>
        <input id="pg-slug" v-model="f.pagina_slug" class="entrada sm:rounded-l-none" :disabled="!puedeEditar" autocomplete="off" />
      </div>
    </Campo>
    <Campo etiqueta="Presentación" para="pg-desc" ayuda="Qué ofrecen, para qué eventos, qué incluye. Hasta 2000 caracteres.">
      <textarea id="pg-desc" v-model="f.pagina_descripcion" rows="5" maxlength="2000" class="entrada" :disabled="!puedeEditar" />
    </Campo>
    <Campo etiqueta="WhatsApp para recibir pedidos" para="pg-wa" ayuda="Con código de país y área, sin el 15 (ej.: 54 9 11 5555 0000).">
      <input id="pg-wa" v-model="f.pagina_whatsapp" class="entrada" inputmode="tel" :disabled="!puedeEditar" />
    </Campo>
    <p class="text-xs text-slate-500">El logo, el color, el teléfono y la dirección se toman de <RouterLink to="/configuracion/organizacion" class="enlace">Organización</RouterLink>.</p>
    <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="flex flex-wrap gap-2">
      <button v-if="puedeEditar" class="btn-primario" :disabled="guardando">Guardar</button>
      <template v-if="publicada">
        <button type="button" class="btn-secundario" @click="copiar"><Copy class="size-4" /> Copiar enlace</button>
        <a :href="`/s/${org.actual!.pagina_slug}`" target="_blank" rel="noopener" class="btn-secundario"><ExternalLink class="size-4" /> Ver página</a>
      </template>
    </div>
  </form>
</template>
