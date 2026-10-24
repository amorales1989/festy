// Exportación CSV compatible con Excel en español (separador ";" y BOM UTF-8).
export function aCSV(filas: Array<Record<string, unknown>>, columnas?: Array<{ clave: string; titulo: string }>): string {
  const cols = columnas ?? Object.keys(filas[0] ?? {}).map((c) => ({ clave: c, titulo: c }))
  const escapar = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [cols.map((c) => escapar(c.titulo)).join(';')]
  for (const f of filas) lineas.push(cols.map((c) => escapar(f[c.clave])).join(';'))
  return '﻿' + lineas.join('\r\n')
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
