import { describe, expect, it } from 'vitest'
import { montoEnLetras } from './letras'
import { planDePagos } from './planPagos'
import { telefonoWhatsApp } from './compartir'

describe('montoEnLetras', () => {
  it.each([
    [1, 'un peso'],
    [21, 'veintiún pesos'],
    [100, 'cien pesos'],
    [101, 'ciento un pesos'],
    [1000, 'mil pesos'],
    [21000, 'veintiún mil pesos'],
    [1000000, 'un millón de pesos'],
    [1440000, 'un millón cuatrocientos cuarenta mil pesos'],
    [2500000.5, 'dos millones quinientos mil pesos con 50/100'],
    [999999.99, 'novecientos noventa y nueve mil novecientos noventa y nueve pesos con 99/100'],
  ])('%s → %s', (n, texto) => expect(montoEnLetras(n)).toBe(texto))
})

describe('planDePagos (igual que aceptar_presupuesto en la base)', () => {
  it('seña 30 % + 3 cuotas que suman el total, la última 7 días antes del evento', () => {
    const plan = planDePagos(4800000, 30, 3, '2027-09-18', '2026-10-14')
    expect(plan.map((c) => c.monto)).toEqual([1440000, 1120000, 1120000, 1120000])
    expect(plan.at(-1)).toEqual({ concepto: 'Saldo', vencimiento: '2027-09-11', monto: 1120000 })
    expect(plan[1]!.vencimiento).toBe('2027-07-13')
    expect(plan.reduce((t, c) => t + c.monto, 0)).toBe(4800000)
  })
  it('las cuotas nunca vencen antes de hoy', () => {
    const plan = planDePagos(1000, 50, 2, '2026-10-20', '2026-10-14')
    expect(plan.every((c) => c.vencimiento >= '2026-10-14')).toBe(true)
  })
})

describe('telefonoWhatsApp', () => {
  it.each([
    ['+54 9 351 555-1234', '5493515551234'],
    ['0351 15 555-1234', '5493515551234'],
    ['11 2345-6789', '5491123456789'],
    ['123', null],
  ])('%s → %s', (t, esperado) => expect(telefonoWhatsApp(t)).toBe(esperado))
})
