<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ titulo: string; ancho?: 'sm' | 'md' | 'lg' | 'xl'; descripcion?: string }>(), { ancho: 'md' })
const abierto = defineModel<boolean>({ required: true })
const panel = ref<HTMLElement | null>(null)
let previo: Element | null = null

const anchos = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

function alTeclear(e: KeyboardEvent) {
  if (e.key === 'Escape') abierto.value = false
  if (e.key === 'Tab' && panel.value) {
    const foco = panel.value.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
    if (!foco.length) return
    const primero = foco[0]!, ultimo = foco[foco.length - 1]!
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
  }
}

watch(abierto, async (v) => {
  if (v) {
    previo = document.activeElement
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    await nextTick()
    panel.value?.querySelector<HTMLElement>('[autofocus],input,select,textarea,button:not([data-cerrar])')?.focus()
  } else {
    document.removeEventListener('keydown', alTeclear)
    document.body.style.overflow = ''
    ;(previo as HTMLElement | null)?.focus?.()
  }
}, { immediate: true })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', alTeclear)
  document.body.style.overflow = ''
})
void props
</script>

<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <div v-if="abierto" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
           @mousedown.self="abierto = false">
        <div ref="panel" role="dialog" aria-modal="true" :aria-label="titulo"
             :class="['flex max-h-[calc(92vh-var(--ins-top))] w-full flex-col rounded-t-2xl bg-white pb-[var(--ins-bottom)] shadow-xl sm:rounded-2xl sm:pb-0', anchos[ancho]]">
          <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 class="text-base font-semibold text-slate-900">{{ titulo }}</h2>
              <p v-if="descripcion" class="mt-0.5 text-sm text-slate-500">{{ descripcion }}</p>
            </div>
            <button data-cerrar type="button" class="btn-fantasma -m-1.5 p-1.5" aria-label="Cerrar" @click="abierto = false">
              <X class="size-5" />
            </button>
          </header>
          <div class="overflow-y-auto px-5 py-4"><slot /></div>
          <footer v-if="$slots.pie" class="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <slot name="pie" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
