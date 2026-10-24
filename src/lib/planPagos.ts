// Plan de pagos de un presupuesto. Debe dar el mismo resultado que
// public.aceptar_presupuesto(): seña al reservar y cuotas mensuales; la
// última vence 7 días antes del evento (nunca antes de hoy).
import { sumarDiasISO } from './formato'

export interface CuotaPlan { concepto: string; vencimiento: string; monto: number }

const redondear = (n: number) => Math.round(n * 100) / 100
const truncar = (n: number) => Math.trunc(n * 100) / 100

export function planDePagos(total: number, senaPct: number, cantidadCuotas: number, fechaEvento: string | null, hoy: string): CuotaPlan[] {
  if (total <= 0) return []
  const plan: CuotaPlan[] = []
  const sena = redondear((total * senaPct) / 100)
  if (sena > 0) plan.push({ concepto: 'Seña', vencimiento: hoy, monto: sena })
  const resto = redondear(total - sena)
  if (resto <= 0) return plan
  const ultima = fechaEvento ? (sumarDiasISO(fechaEvento, -7) > hoy ? sumarDiasISO(fechaEvento, -7) : hoy) : hoy
  if (cantidadCuotas <= 1) {
    plan.push({ concepto: 'Saldo', vencimiento: ultima, monto: resto })
    return plan
  }
  const cuota = truncar(resto / cantidadCuotas)
  for (let i = 1; i <= cantidadCuotas; i++) {
    const venc = sumarDiasISO(ultima, -(cantidadCuotas - i) * 30)
    plan.push({
      concepto: i === cantidadCuotas ? 'Saldo' : `Cuota ${i}`,
      vencimiento: venc > hoy ? venc : hoy,
      monto: i === cantidadCuotas ? redondear(resto - cuota * (cantidadCuotas - 1)) : cuota,
    })
  }
  return plan
}
