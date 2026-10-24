import { describe, expect, it } from 'vitest'
import { diasDelItem, minutosEnDia, type ItemAgenda } from './agenda'

const BA = 'America/Argentina/Buenos_Aires'
const item = (inicio: string, fin: string): ItemAgenda => ({ clave: 'x', tipo: 'reserva', id: 'x', titulo: 'x', inicio, fin, espacioIds: [] })

describe('agenda', () => {
  it('un evento que cruza la medianoche ocupa dos días locales', () => {
    // sábado 14/11 21:00 a domingo 15/11 05:00 (hora de Buenos Aires)
    expect(diasDelItem(item('2026-11-15T00:00:00Z', '2026-11-15T08:00:00Z'), BA)).toEqual(['2026-11-14', '2026-11-15'])
  })
  it('para disponibilidad, la madrugada no ocupa el día siguiente', () => {
    expect(diasDelItem(item('2026-11-15T00:00:00Z', '2026-11-15T08:00:00Z'), BA, true)).toEqual(['2026-11-14'])
    // si se extiende pasado el mediodía, sí ocupa el día siguiente
    expect(diasDelItem(item('2026-11-15T00:00:00Z', '2026-11-15T16:00:00Z'), BA, true)).toEqual(['2026-11-14', '2026-11-15'])
  })
  it('un evento que termina exactamente a medianoche no ocupa el día siguiente', () => {
    expect(diasDelItem(item('2026-11-14T13:00:00Z', '2026-11-15T03:00:00Z'), BA)).toEqual(['2026-11-14'])
  })
  it('eventos de varios días', () => {
    expect(diasDelItem(item('2026-11-13T12:00:00Z', '2026-11-16T02:00:00Z'), BA)).toHaveLength(3)
  })
  it('calcula minutos desde la medianoche local', () => {
    expect(minutosEnDia('2026-11-15T00:00:00Z', '2026-11-14', BA)).toBe(21 * 60)
    expect(minutosEnDia('2026-11-15T08:00:00Z', '2026-11-15', BA)).toBe(5 * 60)
  })
})
