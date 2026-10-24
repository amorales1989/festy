// Documentos comerciales en PDF con la marca del salón: presupuesto y comprobante de pago.
import type { jsPDF } from 'jspdf'
import { fmtDiaLargo, fmtFecha, fmtMoneda } from './formato'
import { montoEnLetras } from './letras'
import { textoPDF } from './pdf'
import type { CuotaPlan } from './planPagos'

export interface Emisor {
  nombre: string
  razon_social?: string | null
  cuit?: string | null
  direccion?: string | null
  telefono?: string | null
  email_contacto?: string | null
  logo?: string | null
  color_marca?: string | null
  zona_horaria: string
}

const MARGEN = 16
const OSCURO: [number, number, number] = [15, 23, 42]
const GRIS: [number, number, number] = [100, 116, 139]

function rgb(hex: string | null | undefined): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [124, 58, 237]
}
const claro = (c: [number, number, number]): [number, number, number] => c.map((v) => Math.round(v + (255 - v) * 0.9)) as [number, number, number]

async function nuevoDoc() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { doc: new jsPDF({ unit: 'mm', format: 'a4' }), autoTable }
}

/** Encabezado con logo y datos del emisor; devuelve la altura ocupada. */
function encabezado(doc: jsPDF, e: Emisor, tipo: string, numero: string, lineasDerecha: string[]): number {
  const ancho = doc.internal.pageSize.getWidth()
  const color = rgb(e.color_marca)
  doc.setFillColor(...color).rect(0, 0, ancho, 4, 'F')
  let x = MARGEN
  if (e.logo) {
    try {
      const p = doc.getImageProperties(e.logo)
      const proporcion = p.width / p.height
      const w = Math.min(40, 18 * proporcion), h = w / proporcion
      doc.addImage(e.logo, MARGEN, 9 + (18 - h) / 2, w, h)
      x = MARGEN + w + 5
    } catch { /* logo inválido: se omite */ }
  }
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...OSCURO)
  doc.text(textoPDF(e.nombre), x, 15)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
  const datos = [e.razon_social, e.cuit ? `CUIT ${e.cuit}` : null, e.direccion, [e.telefono, e.email_contacto].filter(Boolean).join(' · ')].filter(Boolean) as string[]
  datos.forEach((d, i) => doc.text(textoPDF(d), x, 20 + i * 4))

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...color)
  doc.text(textoPDF(tipo), ancho - MARGEN, 15, { align: 'right' })
  doc.setFontSize(11).setTextColor(...OSCURO)
  doc.text(textoPDF(numero), ancho - MARGEN, 21, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
  lineasDerecha.forEach((l, i) => doc.text(textoPDF(l), ancho - MARGEN, 26 + i * 4.2, { align: 'right' }))
  const y = Math.max(20 + datos.length * 4, 26 + lineasDerecha.length * 4.2, 30) + 4
  doc.setDrawColor(226, 232, 240).line(MARGEN, y, ancho - MARGEN, y)
  return y + 6
}

function recuadro(doc: jsPDF, x: number, y: number, w: number, titulo: string, filas: Array<[string, string]>, color: [number, number, number]): number {
  const alto = 8 + filas.length * 5
  doc.setFillColor(...claro(color)).roundedRect(x, y, w, alto, 2, 2, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...color)
  doc.text(textoPDF(titulo.toUpperCase()), x + 4, y + 5.5)
  filas.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
    doc.text(textoPDF(k), x + 4, y + 11 + i * 5)
    doc.setTextColor(...OSCURO)
    doc.text(textoPDF(v), x + 28, y + 11 + i * 5, { maxWidth: w - 32 })
  })
  return alto
}

function piePaginas(doc: jsPDF, texto: string) {
  const ancho = doc.internal.pageSize.getWidth(), alto = doc.internal.pageSize.getHeight()
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS)
    doc.text(textoPDF(texto), MARGEN, alto - 8)
    doc.text(`Página ${i} de ${n}`, ancho - MARGEN, alto - 8, { align: 'right' })
  }
}

// ---------------------------------------------------------------------------
// Presupuesto
// ---------------------------------------------------------------------------
export interface DatosPresupuesto {
  numero: number
  fecha_emision: string
  valido_hasta: string
  titulo: string
  tipo_evento: string
  fecha_evento: string | null
  horario: string | null
  espacio: string | null
  invitados: number | null
  cliente: { nombre: string; telefono?: string | null; email?: string | null; documento?: string | null }
  items: Array<{ descripcion: string; cantidad: number; unidad: string; precio_unitario: number }>
  subtotal: number
  descuento: number
  total: number
  sena_porcentaje: number
  plan: CuotaPlan[]
  condiciones?: string | null
  notas?: string | null
  estado: string
  garantia?: { monto: number; dias: number } | null
}

const UNIDADES: Record<string, string> = { evento: 'evento', persona: 'pers.', hora: 'h', unidad: 'u.' }
export const numeroDoc = (n: number, digitos = 5) => String(n).padStart(digitos, '0')

export async function crearPdfPresupuesto(e: Emisor, p: DatosPresupuesto): Promise<jsPDF> {
  const { doc, autoTable } = await nuevoDoc()
  const ancho = doc.internal.pageSize.getWidth()
  const color = rgb(e.color_marca)
  doc.setProperties({ title: textoPDF(`Presupuesto ${numeroDoc(p.numero, 4)} - ${p.titulo}`), creator: 'Festy' })
  let y = encabezado(doc, e, 'PRESUPUESTO', `N° ${numeroDoc(p.numero, 4)}`,
    [`Fecha: ${fmtFecha(p.fecha_emision, e.zona_horaria)}`, `Válido hasta: ${fmtFecha(p.valido_hasta, e.zona_horaria)}`])

  const col = (ancho - MARGEN * 2 - 6) / 2
  const altoCli = recuadro(doc, MARGEN, y, col, 'Cliente', [
    ['Nombre', p.cliente.nombre], ...(p.cliente.documento ? [['DNI / CUIT', p.cliente.documento] as [string, string]] : []),
    ...(p.cliente.telefono ? [['Teléfono', p.cliente.telefono] as [string, string]] : []), ...(p.cliente.email ? [['Email', p.cliente.email] as [string, string]] : []),
  ], color)
  const altoEv = recuadro(doc, MARGEN + col + 6, y, col, 'Evento', [
    ['Evento', p.titulo], ['Tipo', p.tipo_evento],
    ['Fecha', p.fecha_evento ? `${fmtDiaLargo(p.fecha_evento).replace(/^./, (c) => c.toUpperCase())} de ${p.fecha_evento.slice(0, 4)}` : 'A confirmar'],
    ...(p.horario ? [['Horario', p.horario] as [string, string]] : []), ...(p.espacio ? [['Espacio', p.espacio] as [string, string]] : []),
    ...(p.invitados ? [['Invitados', String(p.invitados)] as [string, string]] : []),
  ], color)
  y += Math.max(altoCli, altoEv) + 7

  const pie: string[][] = [['', '', '', 'Subtotal', fmtMoneda(p.subtotal)]]
  if (p.descuento > 0) pie.push(['', '', '', 'Descuento', `- ${fmtMoneda(p.descuento)}`])
  pie.push(['', '', '', 'TOTAL', fmtMoneda(p.total)])
  autoTable(doc, {
    startY: y, margin: { left: MARGEN, right: MARGEN, bottom: 18 },
    head: [['Descripción', 'Cantidad', 'Unidad', 'Precio unitario', 'Importe']],
    body: p.items.length
      ? p.items.map((i) => [textoPDF(i.descripcion), i.cantidad.toLocaleString('es-AR'), UNIDADES[i.unidad] ?? i.unidad, textoPDF(fmtMoneda(i.precio_unitario)), textoPDF(fmtMoneda(i.cantidad * i.precio_unitario))])
      : [[{ content: 'Sin ítems.', colSpan: 5, styles: { halign: 'center' } }]],
    foot: pie.map((f) => f.map(textoPDF)), showFoot: 'lastPage',
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: [30, 41, 59] },
    headStyles: { fillColor: color, textColor: 255 },
    footStyles: { fillColor: [255, 255, 255], textColor: OSCURO, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 20 }, 2: { cellWidth: 18 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 32 } },
    didParseCell: (d) => {
      if (d.section === 'head' && [1, 3, 4].includes(d.column.index)) d.cell.styles.halign = 'right'
      if (d.section === 'foot' && d.column.index >= 3) d.cell.styles.halign = 'right'
      if (d.section === 'foot' && d.row.index === pie.length - 1 && d.column.index >= 3) {
        d.cell.styles.fillColor = claro(color); d.cell.styles.fontSize = 11
      }
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  if (p.garantia && p.garantia.monto > 0) {
    const ancho2 = ancho - MARGEN * 2
    doc.setFillColor(255, 251, 235).setDrawColor(253, 230, 138).roundedRect(MARGEN, y, ancho2, 17, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(120, 53, 15)
    doc.text('Depósito de garantía reintegrable', MARGEN + 4, y + 6)
    doc.text(textoPDF(fmtMoneda(p.garantia.monto)), ancho - MARGEN - 4, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(146, 64, 14)
    doc.text(textoPDF(`No forma parte del precio. Se abona antes del evento y se devuelve dentro de los ${p.garantia.dias} días posteriores si no hay daños ni faltantes.`),
      MARGEN + 4, y + 11.5, { maxWidth: ancho2 - 8 })
    y += 24
  }

  if (p.plan.length) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...OSCURO).text('Forma de pago', MARGEN, y)
    autoTable(doc, {
      startY: y + 2, margin: { left: MARGEN, right: MARGEN, bottom: 18 }, tableWidth: (ancho - MARGEN * 2) * 0.62,
      head: [['Concepto', 'Vencimiento', 'Monto']],
      body: p.plan.map((c, i) => [c.concepto + (i === 0 && c.concepto === 'Seña' ? ` (${p.sena_porcentaje.toLocaleString('es-AR')} %)` : ''),
        i === 0 && c.concepto === 'Seña' ? 'Al reservar la fecha' : `Antes del ${fmtFecha(c.vencimiento, e.zona_horaria)}`, fmtMoneda(c.monto)].map(textoPDF)),
      theme: 'plain', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [30, 41, 59] },
      headStyles: { textColor: GRIS, fontStyle: 'bold', lineWidth: { bottom: 0.2 }, lineColor: [226, 232, 240] },
      columnStyles: { 2: { halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'head' && d.column.index === 2) d.cell.styles.halign = 'right' },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  const alto = doc.internal.pageSize.getHeight()
  for (const [titulo, texto] of [['Condiciones', p.condiciones], ['Observaciones', p.notas]] as const) {
    if (!texto) continue
    const lineas = doc.setFontSize(8.5).splitTextToSize(textoPDF(texto), ancho - MARGEN * 2) as string[]
    if (y + 8 + lineas.length * 4 > alto - 20) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...OSCURO).text(titulo, MARGEN, y)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS).text(lineas, MARGEN, y + 5)
    y += 9 + lineas.length * 4
  }
  if (p.estado === 'vencido' || p.estado === 'rechazado') sello(doc, p.estado === 'vencido' ? 'VENCIDO' : 'RECHAZADO')
  piePaginas(doc, `Presupuesto N° ${numeroDoc(p.numero, 4)} · ${e.nombre} · Válido hasta el ${fmtFecha(p.valido_hasta, e.zona_horaria)}`)
  return doc
}

function sello(doc: jsPDF, texto: string) {
  const ancho = doc.internal.pageSize.getWidth(), alto = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'bold').setFontSize(70).setTextColor(244, 63, 94)
    doc.saveGraphicsState()
    doc.setGState(new (doc as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 0.18 }) as never)
    doc.text(texto, ancho / 2, alto / 2, { align: 'center', angle: 30 })
    doc.restoreGraphicsState()
  }
}

// ---------------------------------------------------------------------------
// Comprobante de pago
// ---------------------------------------------------------------------------
export interface DatosComprobante {
  numero: number
  fecha: string
  monto: number
  concepto: string
  medio: string
  referencia?: string | null
  anulado: boolean
  anulado_motivo?: string | null
  cliente: { nombre: string; documento?: string | null }
  evento: { numero: number; titulo: string; fecha: string }
  total_evento: number
  pagado_hasta_este: number
  registrado_por?: string | null
}

export async function crearPdfComprobante(e: Emisor, c: DatosComprobante): Promise<jsPDF> {
  const { doc, autoTable } = await nuevoDoc()
  const ancho = doc.internal.pageSize.getWidth()
  const color = rgb(e.color_marca)
  doc.setProperties({ title: textoPDF(`Comprobante ${numeroDoc(c.numero, 8)}`), creator: 'Festy' })
  let y = encabezado(doc, e, 'COMPROBANTE DE PAGO', `N° ${numeroDoc(c.numero, 8)}`, [`Fecha: ${fmtFecha(c.fecha, e.zona_horaria)}`])

  // Monto destacado
  doc.setFillColor(...claro(color)).roundedRect(MARGEN, y, ancho - MARGEN * 2, 24, 2, 2, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS).text('Recibimos de', MARGEN + 5, y + 7)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...OSCURO)
  doc.text(textoPDF(c.cliente.nombre + (c.cliente.documento ? ` (${c.cliente.documento})` : '')), MARGEN + 5, y + 13)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
  doc.text(textoPDF(`la suma de ${montoEnLetras(c.monto)}`), MARGEN + 5, y + 19, { maxWidth: ancho - MARGEN * 2 - 60 })
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...color)
  doc.text(textoPDF(fmtMoneda(c.monto)), ancho - MARGEN - 5, y + 15, { align: 'right' })
  y += 32

  autoTable(doc, {
    startY: y, margin: { left: MARGEN, right: MARGEN },
    body: [
      ['Concepto', `${c.concepto} del evento #${c.evento.numero} "${c.evento.titulo}"`],
      ['Fecha del evento', fmtFecha(c.evento.fecha, e.zona_horaria)],
      ['Medio de pago', c.medio + (c.referencia ? ` · Ref. ${c.referencia}` : '')],
      ['Total del evento', fmtMoneda(c.total_evento)],
      ['Pagado con este comprobante', fmtMoneda(c.pagado_hasta_este)],
      ['Saldo pendiente', fmtMoneda(Math.max(c.total_evento - c.pagado_hasta_este, 0))],
    ].map((f) => f.map(textoPDF)),
    theme: 'plain', styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: [30, 41, 59] },
    columnStyles: { 0: { textColor: GRIS, cellWidth: 60 }, 1: { fontStyle: 'bold' } },
    didDrawCell: (d) => { doc.setDrawColor(241, 245, 249).line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height) },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22

  doc.setDrawColor(148, 163, 184).line(ancho - MARGEN - 70, y, ancho - MARGEN, y)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
  doc.text(textoPDF(`Firma y aclaración${c.registrado_por ? ` · Registró: ${c.registrado_por}` : ''}`), ancho - MARGEN, y + 4, { align: 'right' })
  doc.setFontSize(7.5).text('Documento no válido como factura.', MARGEN, y + 4)
  if (c.anulado) {
    sello(doc, 'ANULADO')
    doc.setPage(1).setFont('helvetica', 'bold').setFontSize(9).setTextColor(225, 29, 72)
    doc.text(textoPDF(`Comprobante anulado${c.anulado_motivo ? `: ${c.anulado_motivo}` : ''}`), MARGEN, y + 12)
  }
  piePaginas(doc, `${e.nombre} · Comprobante N° ${numeroDoc(c.numero, 8)}`)
  return doc
}

/** Datos del emisor a partir de la organización activa. */
export function emisorDe(o: { nombre: string; razon_social: string | null; cuit: string | null; direccion: string | null; telefono: string | null;
  email_contacto: string | null; logo: string | null; color_marca: string; zona_horaria: string }): Emisor {
  return { nombre: o.nombre, razon_social: o.razon_social, cuit: o.cuit, direccion: o.direccion, telefono: o.telefono,
    email_contacto: o.email_contacto, logo: o.logo, color_marca: o.color_marca, zona_horaria: o.zona_horaria }
}

// ---------------------------------------------------------------------------
// Depósito de garantía: recibo de cobro y constancia de devolución
// ---------------------------------------------------------------------------
export interface DatosGarantia {
  tipo: 'recibo' | 'devolucion'
  numero: number
  fecha: string
  monto: number
  medio: string | null
  referencia?: string | null
  devuelto?: number
  motivo_retencion?: string | null
  dias_devolucion: number
  cliente: { nombre: string; documento?: string | null }
  evento: { numero: number; titulo: string; fecha: string }
  registrado_por?: string | null
}

export async function crearPdfGarantia(e: Emisor, g: DatosGarantia): Promise<jsPDF> {
  const { doc, autoTable } = await nuevoDoc()
  const ancho = doc.internal.pageSize.getWidth()
  const color = rgb(e.color_marca)
  const esRecibo = g.tipo === 'recibo'
  const titulo = esRecibo ? 'RECIBO DE GARANTÍA' : 'DEVOLUCIÓN DE GARANTÍA'
  doc.setProperties({ title: textoPDF(`${titulo} ${numeroDoc(g.numero, 8)}`), creator: 'Festy' })
  let y = encabezado(doc, e, titulo, `N° ${numeroDoc(g.numero, 8)}`, [`Fecha: ${fmtFecha(g.fecha, e.zona_horaria)}`])

  const montoDestacado = esRecibo ? g.monto : (g.devuelto ?? 0)
  doc.setFillColor(...claro(color)).roundedRect(MARGEN, y, ancho - MARGEN * 2, 24, 2, 2, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS).text(esRecibo ? 'Recibimos de' : 'Devolvemos a', MARGEN + 5, y + 7)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...OSCURO)
  doc.text(textoPDF(g.cliente.nombre + (g.cliente.documento ? ` (${g.cliente.documento})` : '')), MARGEN + 5, y + 13)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
  doc.text(textoPDF(montoDestacado > 0 ? `la suma de ${montoEnLetras(montoDestacado)}` : 'no corresponde devolución'), MARGEN + 5, y + 19,
    { maxWidth: ancho - MARGEN * 2 - 60 })
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...color)
  doc.text(textoPDF(fmtMoneda(montoDestacado)), ancho - MARGEN - 5, y + 15, { align: 'right' })
  y += 32

  const filas: string[][] = [
    ['Concepto', `Depósito de garantía del evento #${g.evento.numero} "${g.evento.titulo}"`],
    ['Fecha del evento', fmtFecha(g.evento.fecha, e.zona_horaria)],
  ]
  if (esRecibo) {
    filas.push(['Medio de pago', (g.medio ?? '') + (g.referencia ? ` · Ref. ${g.referencia}` : '')])
  } else {
    const retenido = g.monto - (g.devuelto ?? 0)
    filas.push(['Garantía recibida', fmtMoneda(g.monto)], ['Devuelto', fmtMoneda(g.devuelto ?? 0)])
    if (retenido > 0) filas.push(['Retenido', fmtMoneda(retenido)], ['Motivo de la retención', g.motivo_retencion ?? ''])
    if ((g.devuelto ?? 0) > 0 && g.medio) filas.push(['Medio de devolución', g.medio])
  }
  autoTable(doc, {
    startY: y, margin: { left: MARGEN, right: MARGEN }, body: filas.map((f) => f.map(textoPDF)),
    theme: 'plain', styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: [30, 41, 59] },
    columnStyles: { 0: { textColor: GRIS, cellWidth: 60 }, 1: { fontStyle: 'bold' } },
    didDrawCell: (d) => { doc.setDrawColor(241, 245, 249).line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height) },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const leyenda = esRecibo
    ? `Este importe es un depósito de garantía: no forma parte del precio del evento. Se devolverá dentro de los ${g.dias_devolucion} días posteriores al evento, una vez verificado que no haya daños ni faltantes. En caso de daños, se descontará el costo de la reparación o reposición.`
    : 'Con esta devolución queda cancelado el depósito de garantía del evento.'
  const lineas = doc.setFontSize(8.5).splitTextToSize(textoPDF(leyenda), ancho - MARGEN * 2) as string[]
  doc.setFont('helvetica', 'normal').setTextColor(...GRIS).text(lineas, MARGEN, y)
  y += lineas.length * 4 + 18

  doc.setDrawColor(148, 163, 184)
  doc.line(MARGEN, y, MARGEN + 70, y)
  doc.line(ancho - MARGEN - 70, y, ancho - MARGEN, y)
  doc.setFontSize(8).setTextColor(...GRIS)
  doc.text('Firma del cliente', MARGEN, y + 4)
  doc.text(textoPDF(`Por ${e.nombre}${g.registrado_por ? ` · ${g.registrado_por}` : ''}`), ancho - MARGEN, y + 4, { align: 'right' })
  doc.setFontSize(7.5).text('Documento no válido como factura.', MARGEN, y + 12)
  piePaginas(doc, `${e.nombre} · ${titulo.charAt(0)}${titulo.slice(1).toLowerCase()} N° ${numeroDoc(g.numero, 8)}`)
  return doc
}
