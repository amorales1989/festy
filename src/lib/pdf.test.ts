import { describe, expect, it } from 'vitest'
import { crearPDF, nombreArchivo, textoPDF } from './pdf'

describe('textoPDF', () => {
  it('conserva acentos y ñ, y reemplaza caracteres que la fuente PDF no soporta', () => {
    expect(textoPDF('Año · Señada → Confirmada “ok” …')).toBe('Año · Señada -> Confirmada "ok" ...')
    expect(textoPDF('$ 1.500,00')).toBe('$ 1.500,00')
    expect(textoPDF(null)).toBe('')
  })
})

describe('nombreArchivo', () => {
  it('arma un nombre sin acentos con la fecha DD-MM-AAAA', () => {
    expect(nombreArchivo('Eventos', 'Quinta Los Álamos', '2026-10-13')).toBe('eventos-quinta-los-alamos-13-10-2026.pdf')
  })
})

describe('crearPDF', () => {
  it('genera un PDF con título, filas, totales y numeración de páginas', async () => {
    const filas = Array.from({ length: 80 }, (_, i) => ({ evento: `Cumpleaños ${i + 1}`, monto: '$ 1.000,00' }))
    const doc = await crearPDF({
      titulo: 'Cobros registrados', organizacion: 'Quinta Los Álamos', zona: 'America/Argentina/Buenos_Aires',
      resumen: [['Total cobrado', '$ 80.000,00']],
      secciones: [{ columnas: [{ clave: 'evento', titulo: 'Evento' }, { clave: 'monto', titulo: 'Monto', alinear: 'right' }], filas,
        pie: { evento: 'Total', monto: '$ 80.000,00' } }],
    })
    const contenido = doc.output()
    expect(contenido.startsWith('%PDF-')).toBe(true)
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    expect(contenido).toContain('Cobros registrados')
    expect(contenido).toContain('Cumpleaños 80') // la ñ viaja como byte WinAnsi (241)
    expect(contenido).toContain(`Página 1 de ${doc.getNumberOfPages()}`)
  })

  it('muestra un mensaje cuando la sección no tiene datos', async () => {
    const doc = await crearPDF({ titulo: 'Clientes', organizacion: 'X', zona: 'UTC',
      secciones: [{ columnas: [{ clave: 'a', titulo: 'A' }], filas: [], vacio: 'Sin clientes.' }] })
    expect(doc.output()).toContain('Sin clientes.')
  })
})
