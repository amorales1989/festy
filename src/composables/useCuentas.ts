// Cuentas de dinero de la organización activa (efectivo, banco, Mercado Pago…),
// compartidas entre los formularios de cobro, gasto, garantía y pago a proveedores.
import { computed, ref } from 'vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { useOrganizacion } from '@/stores/organizacion'

export type Cuenta = Fila<'cuentas'>

const cuentas = ref<Cuenta[]>([])
let orgCargada = ''

export function useCuentas() {
  const org = useOrganizacion()
  async function cargar(forzar = false) {
    if (!forzar && orgCargada === org.id) return
    cuentas.value = await api.get<Cuenta[]>(rutaOrg(org.id, 'cuentas')).catch(() => [])
    orgCargada = org.id
  }
  const activas = computed(() => cuentas.value.filter((c) => c.activo))
  /** Cuenta que se usa si no se elige otra (la que tiene asociado ese medio). */
  const cuentaDeMedio = (medio: string) => activas.value.find((c) => c.medios.includes(medio)) ?? null
  return { cuentas, activas, cargar, cuentaDeMedio }
}
