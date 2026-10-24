// Guardar y compartir archivos de la misma forma en la web y en la app Android.
// En la app (Capacitor) el navegador interno no descarga archivos: se guardan
// en el teléfono y se abre el menú "Compartir" del sistema (WhatsApp, mail…).
import { Capacitor } from '@capacitor/core'
import type { jsPDF } from 'jspdf'

export const esApp = () => Capacitor.isNativePlatform()

async function compartirEnApp(base64: string, archivo: string, titulo: string, texto?: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const { uri } = await Filesystem.writeFile({ path: archivo, data: base64, directory: Directory.Cache })
  await Share.share({ title: titulo, text: texto, files: [uri], dialogTitle: titulo })
}

/** Descarga el PDF (web) o lo guarda y abre "Compartir" (app). */
export async function guardarPDF(doc: jsPDF, archivo: string, titulo = archivo) {
  if (esApp()) {
    await compartirEnApp(doc.output('datauristring').split(',')[1]!, archivo, titulo)
    return
  }
  doc.save(archivo)
}

/** Número argentino en formato internacional para WhatsApp: "351 15 555-1234" → "5493515551234". */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  let d = telefono.replace(/\D/g, '')
  if (!d) return null
  d = d.replace(/^00/, '')
  if (d.startsWith('54')) d = d.slice(2)
  d = d.replace(/^0/, '')
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  // Quita el "15" de celulares escritos a la antigua (código de área de 2 a 4 dígitos + 15 + número).
  const m = /^(\d{2,4})15(\d{6,8})$/.exec(d)
  if (m && m[1]!.length + m[2]!.length === 10) d = m[1]! + m[2]!
  return d.length === 10 ? `549${d}` : null
}

/**
 * Envía un PDF por WhatsApp. En la app y en celulares con "Compartir" se adjunta
 * el archivo; en la computadora se descarga y se abre el chat con el mensaje
 * para adjuntarlo a mano (WhatsApp Web no permite adjuntar por enlace).
 */
export async function enviarPorWhatsApp(doc: jsPDF, archivo: string, mensaje: string, telefono?: string | null): Promise<'compartido' | 'descargado'> {
  if (esApp()) {
    await compartirEnApp(doc.output('datauristring').split(',')[1]!, archivo, archivo, mensaje)
    return 'compartido'
  }
  const file = new File([doc.output('blob')], archivo, { type: 'application/pdf' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], text: mensaje })
      return 'compartido'
    } catch { /* el usuario canceló: se sigue con la descarga */ }
  }
  doc.save(archivo)
  const numero = telefonoWhatsApp(telefono)
  window.open(`https://wa.me/${numero ?? ''}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')
  return 'descargado'
}
