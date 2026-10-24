<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, Minus } from 'lucide-vue-next'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { fmtFecha, fmtMoneda } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const planes = ref<Fila<'planes'>[]>([])
onMounted(async () => { planes.value = await api.get<Fila<'planes'>[]>('/planes') })

const FUNCIONES: Array<[string, string]> = [
  ['calendario', 'Calendario y disponibilidad'], ['reservas', 'Reservas y clientes'], ['cobros', 'Cobros y plan de cuotas'],
  ['tareas', 'Tareas'], ['panel', 'Panel principal'], ['gastos', 'Gastos'], ['importacion', 'Importación de datos'],
  ['exportacion', 'Exportación CSV'], ['auditoria', 'Registro de auditoría'], ['multi_salon', 'Varios salones (marcas)'],
  ['roles_personalizados', 'Roles personalizados'],
]
const limite = (n: number | null) => (n === null ? 'Ilimitado' : String(n))

async function cambiar(p: Fila<'planes'>) {
  if (!(await confirmar({ titulo: `Cambiar al plan ${p.nombre}`, confirmar: 'Cambiar plan',
    mensaje: 'El cambio es inmediato. Si bajás de plan, primero tenés que estar dentro de sus límites.' }))) return
  try {
    await api.put(rutaOrg(org.id, 'plan'), { plan: p.clave })
    await org.refrescarActual()
    exito(`Ahora estás en el plan ${p.nombre}.`)
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Facturación pendiente de integración.</strong> El cobro de la suscripción (Mercado Pago) todavía no está conectado:
      el cambio de plan modifica los límites pero no genera un cobro. Los precios se definirán antes del lanzamiento.
    </div>
    <p class="text-sm text-slate-600">Plan actual: <strong>{{ org.plan?.nombre }}</strong>
      <template v-if="org.actual?.suscripcion_estado === 'prueba'"> · prueba hasta el {{ fmtFecha(org.actual.prueba_hasta, org.zona) }}</template></p>
    <div class="grid gap-4 md:grid-cols-3">
      <section v-for="p in planes" :key="p.clave" :class="['tarjeta flex flex-col p-5', p.clave === org.actual?.plan_clave && 'ring-2 ring-marca-500']">
        <h2 class="text-lg font-semibold">{{ p.nombre }}</h2>
        <p class="text-sm text-slate-500">{{ Number(p.precio_mensual_ars) > 0 ? `${fmtMoneda(p.precio_mensual_ars, true)} / mes` : 'Precio a definir' }}</p>
        <dl class="mt-4 grid grid-cols-2 gap-1 text-sm">
          <dt class="text-slate-500">Sedes</dt><dd class="text-right font-medium">{{ limite(p.max_sucursales) }}</dd>
          <dt class="text-slate-500">Espacios</dt><dd class="text-right font-medium">{{ limite(p.max_espacios) }}</dd>
          <dt class="text-slate-500">Usuarios</dt><dd class="text-right font-medium">{{ limite(p.max_usuarios) }}</dd>
        </dl>
        <ul class="mt-4 flex-1 space-y-1 text-sm">
          <li v-for="[clave, nombre] in FUNCIONES" :key="clave" :class="['flex items-center gap-2', !p.funciones.includes(clave) && 'text-slate-400']">
            <Check v-if="p.funciones.includes(clave)" class="size-4 text-emerald-600" /><Minus v-else class="size-4" /> {{ nombre }}
          </li>
        </ul>
        <button v-if="p.clave !== org.actual?.plan_clave && org.puede('plan.gestionar')" class="btn-secundario mt-4" @click="cambiar(p)">Cambiar a {{ p.nombre }}</button>
        <p v-else-if="p.clave === org.actual?.plan_clave" class="mt-4 text-center text-sm font-medium text-marca-700">Tu plan actual</p>
      </section>
    </div>
  </div>
</template>
