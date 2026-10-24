<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { quitarPush, registrarPush } from '@/lib/app'
import { useRoute, useRouter } from 'vue-router'
import {
  CalendarDays, ChevronsUpDown, FileText, House, ListChecks, LogOut, Menu, PartyPopper, Plus,
  Settings, Users, Wallet, X,
} from 'lucide-vue-next'
import BusquedaGlobal from '@/components/BusquedaGlobal.vue'
import CampanaNotificaciones from '@/components/CampanaNotificaciones.vue'
import FormReserva from '@/components/reservas/FormReserva.vue'
import FormEntrevista from '@/components/entrevistas/FormEntrevista.vue'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useAcciones } from '@/stores/acciones'
import { fmtFecha } from '@/lib/formato'

const org = useOrganizacion()
const sesion = useSesion()
const acciones = useAcciones()
const route = useRoute()
const router = useRouter()
const menuMovil = ref(false)
const selectorAbierto = ref(false)

const navegacion = computed(() => [
  { a: '/', etiqueta: 'Inicio', icono: House, visible: true },
  { a: '/calendario', etiqueta: 'Agenda', icono: CalendarDays, visible: org.puede('calendario.ver') },
  { a: '/reservas', etiqueta: 'Eventos', icono: PartyPopper, visible: org.puede('reservas.ver') },
  { a: '/presupuestos', etiqueta: 'Presupuestos', icono: FileText, visible: org.puede('presupuestos.ver') },
  { a: '/clientes', etiqueta: 'Clientes', icono: Users, visible: org.puede('clientes.ver') },
  { a: org.puede('pagos.ver') ? '/cobros' : '/gastos', etiqueta: 'Finanzas', icono: Wallet, visible: org.puede('pagos.ver') || org.puede('gastos.ver') },
  { a: '/tareas', etiqueta: 'Tareas', icono: ListChecks, visible: org.puede('tareas.ver') },
  { a: '/configuracion', etiqueta: 'Ajustes', icono: Settings, visible: true },
].filter((n) => n.visible))

const navegacionInferior = computed(() => navegacion.value.filter((n) => n.a !== '/configuracion' && n.a !== '/tareas').slice(0, 4))

function activo(a: string) {
  if (a === '/presupuestos') return route.path.startsWith('/presupuestos') || route.path.startsWith('/catalogo')
  if (a === '/cobros' || a === '/gastos') return ['/cobros', '/gastos', '/garantias', '/caja', '/proveedores', '/rentabilidad'].some((x) => route.path.startsWith(x))
  return a === '/' ? route.path === '/' : route.path.startsWith(a)
}
watch(() => route.fullPath, () => { menuMovil.value = false })

async function cambiarOrganizacion(id: string) {
  selectorAbierto.value = false
  await org.seleccionar(id)
  acciones.cambiosGuardados()
  await router.push('/')
}
const campana = ref<InstanceType<typeof CampanaNotificaciones> | null>(null)
onMounted(() => { void registrarPush(() => campana.value?.cargar()) })

async function salir() {
  await quitarPush()
  await sesion.salir()
  org.reiniciar()
  await router.replace('/ingresar')
}
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <!-- Barra lateral -->
    <div v-if="menuMovil" class="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" @click="menuMovil = false" />
    <aside :class="['fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
                    menuMovil ? 'translate-x-0' : '-translate-x-full', 'pt-[var(--ins-top)] pb-[var(--ins-bottom)]']">
      <div class="flex h-16 items-center justify-between gap-2 px-4">
        <RouterLink to="/" class="flex items-center gap-2">
          <img src="/favicon.svg" alt="" class="size-8" />
          <span class="text-lg font-bold tracking-tight">Festy</span>
        </RouterLink>
        <button class="btn-fantasma p-1.5 lg:hidden" aria-label="Cerrar menú" @click="menuMovil = false"><X class="size-5" /></button>
      </div>

      <div class="relative px-3">
        <button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                :aria-expanded="selectorAbierto" aria-haspopup="listbox" @click="selectorAbierto = !selectorAbierto">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-marca-100 text-sm font-semibold text-marca-700">
            {{ org.actual?.nombre.slice(0, 1).toUpperCase() }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ org.actual?.nombre }}</span>
            <span class="block truncate text-xs text-slate-500">{{ org.rol }}</span>
          </span>
          <ChevronsUpDown class="size-4 text-slate-400" />
        </button>
        <div v-if="selectorAbierto" class="absolute inset-x-3 top-full z-10 mt-1 rounded-lg bg-white p-1 shadow-lg ring-1 ring-slate-200" role="listbox">
          <button v-for="o in org.organizaciones" :key="o.id" role="option" :aria-selected="o.id === org.id"
                  :class="['block w-full truncate rounded-md px-2.5 py-2 text-left text-sm', o.id === org.id ? 'bg-marca-50 font-medium text-marca-700' : 'hover:bg-slate-50']"
                  @click="cambiarOrganizacion(o.id)">{{ o.nombre }}</button>
          <RouterLink to="/bienvenida" class="mt-1 flex items-center gap-2 rounded-md border-t border-slate-100 px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      @click="selectorAbierto = false">
            <Plus class="size-4" /> Crear otra organización
          </RouterLink>
        </div>
      </div>

      <nav class="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Navegación principal">
        <RouterLink v-for="n in navegacion" :key="n.a" :to="n.a"
                    :class="['flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                             activo(n.a) ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900']"
                    :aria-current="activo(n.a) ? 'page' : undefined">
          <component :is="n.icono" class="size-5" /> {{ n.etiqueta }}
        </RouterLink>
      </nav>

      <div class="border-t border-slate-100 p-3">
        <div class="flex items-center gap-2 px-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ sesion.perfil?.nombre || sesion.usuario?.email }}</p>
            <p class="truncate text-xs text-slate-500">{{ sesion.usuario?.email }}</p>
          </div>
          <button class="btn-fantasma p-2" aria-label="Cerrar sesión" title="Cerrar sesión" @click="salir"><LogOut class="size-4" /></button>
        </div>
      </div>
    </aside>

    <!-- Contenido -->
    <div class="min-w-0 flex-1">
      <header class="sticky top-0 z-30 flex h-[calc(4rem+var(--ins-top))] items-center gap-3 border-b border-slate-200 bg-white/90 px-4 pt-[var(--ins-top)] backdrop-blur sm:px-6">
        <button class="btn-fantasma -ml-2 p-2 lg:hidden" aria-label="Abrir menú" @click="menuMovil = true"><Menu class="size-5" /></button>
        <div class="min-w-0 flex-1"><BusquedaGlobal /></div>
        <CampanaNotificaciones ref="campana" />
        <button v-if="org.puede('reservas.crear')" class="btn-primario hidden shrink-0 lg:inline-flex" @click="acciones.nuevaReserva()">
          <Plus class="size-4" /> Nueva reserva
        </button>
      </header>

      <div v-if="org.actual?.estado === 'baja_solicitada'" class="bg-rose-600 px-4 py-2 text-center text-sm text-white" role="alert">
        Solicitaste la baja de la cuenta. Los datos se eliminarán definitivamente 30 días después de
        {{ fmtFecha(org.actual.baja_solicitada_at, org.zona) }}.
        <RouterLink to="/configuracion/datos" class="font-semibold underline">Cancelar la baja</RouterLink>
      </div>

      <main class="px-4 pt-6 pb-[calc(7rem+var(--ins-bottom))] sm:px-6 lg:px-8 lg:pb-8">
        <RouterView :key="org.id" />
      </main>
    </div>

    <!-- Barra inferior en celular: lo más usado a un toque -->
    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[var(--ins-bottom)] backdrop-blur lg:hidden"
         aria-label="Accesos rápidos">
      <RouterLink v-for="n in navegacionInferior.slice(0, 2)" :key="n.a" :to="n.a"
                  :class="['flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', activo(n.a) ? 'text-marca-700' : 'text-slate-500']">
        <component :is="n.icono" class="size-5" />{{ n.etiqueta }}
      </RouterLink>
      <div class="flex items-center justify-center">
        <button v-if="org.puede('reservas.crear')" class="-mt-6 flex size-14 items-center justify-center rounded-full bg-marca-600 text-white shadow-lg ring-4 ring-white"
                aria-label="Nueva reserva" @click="acciones.nuevaReserva()"><Plus class="size-7" /></button>
      </div>
      <RouterLink v-for="n in navegacionInferior.slice(2, 4)" :key="n.a" :to="n.a"
                  :class="['flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', activo(n.a) ? 'text-marca-700' : 'text-slate-500']">
        <component :is="n.icono" class="size-5" />{{ n.etiqueta }}
      </RouterLink>
    </nav>

    <FormReserva v-if="org.puede('reservas.crear') || org.puede('reservas.editar')" />
    <FormEntrevista v-if="org.puede('entrevistas.ver')" />
  </div>
</template>
