// Exportación a PDF (jsPDF + autotable), generada en el navegador.
// Cada documento lleva encabezado con la organización, fecha de generación en
// la zona de la organización y numeración "Página X de Y".
// Las librerías se cargan recién al exportar para no agrandar la carga inicial.
import type { jsPDF } from 'jspdf'
import { fmtFechaHora } from './formato'

export interface ColumnaPDF {
  clave: string
  titulo: string
  alinear?: 'left' | 'right' | 'center'
  /** Ancho relativo; las columnas sin ancho se reparten el resto. */
  ancho?: number
}

export interface SeccionPDF {
  titulo?: string
  columnas: ColumnaPDF[]
  filas: Array<Record<string, unknown>>
  /** Fila final destacada (por ejemplo, totales). */
  pie?: Record<string, string>
  vacio?: string
}

export interface OpcionesPDF {
  titulo: string
  subtitulo?: string
  organizacion: string
  zona: string
  horizontal?: boolean
  /** Datos destacados debajo del título: [etiqueta, valor]. */
  resumen?: Array<[string, string]>
  secciones: SeccionPDF[]
}

const MARCA: [number, number, number] = [124, 58, 237]
const GRIS: [number, number, number] = [100, 116, 139]
const MARGEN = 14

/**
 * Las fuentes estándar de PDF usan WinAnsi (Latin-1): acentos y ñ funcionan,
 * pero algunos caracteres tipográficos no. Se reemplazan por equivalentes.
 */
export function textoPDF(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    .replace(/[   ]/g, ' ')
    .replace(/[→⇒]/g, '->')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\u0000-ÿ–—€]/g, '')
}

export async function crearPDF(o: OpcionesPDF): Promise<jsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: o.horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const generado = fmtFechaHora(new Date(), o.zona)
  doc.setProperties({ title: textoPDF(`${o.titulo} - ${o.organizacion}`), creator: 'Festy' })

  // Encabezado de la primera página
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MARCA)
  doc.text(textoPDF(o.organizacion.toUpperCase()), MARGEN, 14)
  doc.setFontSize(18).setTextColor(15, 23, 42)
  doc.text(textoPDF(o.titulo), MARGEN, 23)
  let y = 23
  if (o.subtitulo) {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
    doc.text(textoPDF(o.subtitulo), MARGEN, (y += 6))
  }
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
  doc.text(textoPDF(`Generado el ${generado}`), ancho - MARGEN, 14, { align: 'right' })

  // Resumen en recuadros
  if (o.resumen?.length) {
    y += 6
    const anchoCaja = (ancho - MARGEN * 2 - (o.resumen.length - 1) * 3) / o.resumen.length
    o.resumen.forEach(([etiqueta, valor], i) => {
      const x = MARGEN + i * (anchoCaja + 3)
      doc.setFillColor(245, 243, 255).roundedRect(x, y, anchoCaja, 15, 2, 2, 'F')
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS)
      doc.text(textoPDF(etiqueta), x + 3, y + 5.5)
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42)
      doc.text(textoPDF(valor), x + 3, y + 11.5, { maxWidth: anchoCaja - 6 })
    })
    y += 15
  }
  y += 6

  for (const s of o.secciones) {
    if (s.titulo) {
      if (y > alto - 40) { doc.addPage(); y = 22 }
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42)
      doc.text(textoPDF(s.titulo), MARGEN, y)
      y += 3
    }
    const total = s.columnas.reduce((t, c) => t + (c.ancho ?? 0), 0)
    const libres = s.columnas.filter((c) => !c.ancho).length
    const disponible = ancho - MARGEN * 2
    const estilosColumna: Record<number, { halign?: 'left' | 'right' | 'center'; cellWidth?: number }> = {}
    s.columnas.forEach((c, i) => {
      estilosColumna[i] = { halign: c.alinear ?? 'left' }
      if (c.ancho && total > 0 && libres === 0) estilosColumna[i]!.cellWidth = (c.ancho / total) * disponible
    })
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: 22, bottom: 16 },
      head: [s.columnas.map((c) => textoPDF(c.titulo))],
      body: s.filas.length
        ? s.filas.map((f) => s.columnas.map((c) => textoPDF(f[c.clave])))
        : [[{ content: textoPDF(s.vacio ?? 'Sin datos.'), colSpan: s.columnas.length, styles: { halign: 'center', textColor: GRIS } }]],
      foot: s.pie ? [s.columnas.map((c) => textoPDF(s.pie![c.clave] ?? ''))] : undefined,
      showFoot: 'lastPage',
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, overflow: 'linebreak', textColor: [30, 41, 59] },
      headStyles: { fillColor: MARCA, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [237, 233, 254], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: estilosColumna,
      didParseCell: (d) => {
        // Las columnas numéricas del pie/encabezado se alinean como su columna.
        const c = s.columnas[d.column.index]
        if (c?.alinear && d.section !== 'body') d.cell.styles.halign = c.alinear
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // Encabezado reducido (desde la página 2) y pie con numeración en todas
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
    if (i > 1) {
      doc.text(textoPDF(`${o.organizacion} · ${o.titulo}`), MARGEN, 12)
      doc.text(textoPDF(`Generado el ${generado}`), ancho - MARGEN, 12, { align: 'right' })
    }
    doc.setDrawColor(226, 232, 240).line(MARGEN, alto - 11, ancho - MARGEN, alto - 11)
    doc.text('Festy', MARGEN, alto - 6.5)
    doc.text(`Página ${i} de ${paginas}`, ancho - MARGEN, alto - 6.5, { align: 'right' })
  }
  return doc
}

/** Genera el PDF y lo descarga con el nombre indicado. */
export async function exportarPDF(archivo: string, o: OpcionesPDF): Promise<void> {
  const doc = await crearPDF(o)
  const { guardarPDF } = await import('./compartir')
  await guardarPDF(doc, archivo.endsWith('.pdf') ? archivo : `${archivo}.pdf`, o.titulo)
}

/** Nombre de archivo seguro: "eventos-quinta-los-alamos-13-10-2026.pdf". */
export function nombreArchivo(base: string, organizacion: string, fechaISO: string): string {
  const limpio = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const [a, m, d] = fechaISO.split('-')
  return `${limpio(base)}-${limpio(organizacion)}-${d}-${m}-${a}.pdf`
}
