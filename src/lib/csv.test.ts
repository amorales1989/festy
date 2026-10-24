import { describe, expect, it } from 'vitest'
import { aCSV } from './csv'

describe('aCSV', () => {
  it('usa ; como separador, BOM y escapa comillas', () => {
    const csv = aCSV([{ a: 'Hola; mundo', b: 'Dijo "sí"', c: null }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('a;b;c')
    expect(csv).toContain('"Hola; mundo";"Dijo ""sí""";')
  })
})
