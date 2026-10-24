import { describe, expect, it } from 'vitest'
import { aLocal, desdeLocal, fmtFecha, fmtFechaHora, fmtMoneda, parsearFechaAR, parsearMonto, sumarDiasISO, tiempoRelativo } from './formato'

const BA = 'America/Argentina/Buenos_Aires'

describe('montos en formato argentino', () => {
  it.each([
    ['1.500.000,50', 1500000.5],
    ['1500000.5', 1500000.5],
    ['$ 1.000', 1000],
    ['250', 250],
    ['0,99', 0.99],
    ['', null],
    ['abc', null],
  ])('%s → %s', (texto, esperado) => expect(parsearMonto(texto)).toBe(esperado))

  it('formatea ARS con separadores locales', () => {
    expect(fmtMoneda(1500000.5)).toMatch(/\$\s?1\.500\.000,50/)
    expect(fmtMoneda(null)).toBe('—')
  })
})

describe('fechas DD/MM/AAAA', () => {
  it('parsea fechas válidas', () => {
    expect(parsearFechaAR('14/11/2026')).toBe('2026-11-14')
    expect(parsearFechaAR('1/2/2027')).toBe('2027-02-01')
  })
  it('rechaza fechas inexistentes o mal formadas', () => {
    expect(parsearFechaAR('31/02/2026')).toBeNull()
    expect(parsearFechaAR('2026-11-14')).toBeNull()
    expect(parsearFechaAR('14/13/2026')).toBeNull()
  })
  it('formatea fechas puras sin corrimiento por zona', () => {
    expect(fmtFecha('2026-01-01', 'Pacific/Kiritimati')).toBe('01/01/2026')
  })
  it('suma días cruzando meses y años', () => {
    expect(sumarDiasISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDiasISO('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('zona horaria de la organización', () => {
  it('convierte hora local de Buenos Aires (UTC-3) a UTC', () => {
    expect(desdeLocal('2026-11-14', '21:00', BA)).toBe('2026-11-15T00:00:00.000Z')
  })
  it('es independiente de la zona del navegador', () => {
    expect(desdeLocal('2026-11-14', '21:00', 'Europe/Madrid')).toBe('2026-11-14T20:00:00.000Z')
  })
  it('ida y vuelta', () => {
    expect(aLocal('2026-11-15T00:00:00.000Z', BA)).toEqual({ fecha: '2026-11-14', hora: '21:00' })
    expect(fmtFechaHora('2026-11-15T08:30:00.000Z', BA)).toBe('15/11/2026 05:30')
  })
})

describe('tiempoRelativo', () => {
  it('dice "recién" en el primer minuto y minutos u horas después', () => {
    const hace = (ms: number) => new Date(Date.now() - ms).toISOString()
    expect(tiempoRelativo(hace(10_000), 'America/Argentina/Buenos_Aires')).toBe('recién')
    expect(tiempoRelativo(hace(5 * 6e4), 'America/Argentina/Buenos_Aires')).toBe('hace 5 min')
    expect(tiempoRelativo(hace(3 * 36e5), 'America/Argentina/Buenos_Aires')).toBe('hace 3 h')
  })
})
