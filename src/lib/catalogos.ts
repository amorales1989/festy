// Etiquetas y colores de estados y catálogos. Deben coincidir con los CHECK y
// enums de la base de datos.
import type { EstadoContrato, EstadoReserva } from './supabase'

export const ESTADOS_RESERVA: Record<EstadoReserva, { etiqueta: string; clase: string; punto: string; ayuda: string }> = {
  consulta:   { etiqueta: 'Consulta',   clase: 'bg-sky-100 text-sky-800 ring-sky-200',         punto: 'bg-sky-500',     ayuda: 'Alguien preguntó por la fecha. Todavía no la ocupa.' },
  tentativa:  { etiqueta: 'Fecha retenida', clase: 'bg-amber-100 text-amber-800 ring-amber-200', punto: 'bg-amber-500', ayuda: 'Le guardás la fecha unos días mientras decide. Si no paga la seña, se libera sola.' },
  senada:     { etiqueta: 'Señada',     clase: 'bg-violet-100 text-violet-800 ring-violet-200', punto: 'bg-violet-500', ayuda: 'Pagó la seña. La fecha es suya.' },
  confirmada: { etiqueta: 'Confirmada', clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200', punto: 'bg-emerald-500', ayuda: 'Evento confirmado.' },
  finalizada: { etiqueta: 'Realizado',  clase: 'bg-slate-100 text-slate-700 ring-slate-200',   punto: 'bg-slate-400',   ayuda: 'El evento ya se hizo.' },
  cancelada:  { etiqueta: 'Cancelado',  clase: 'bg-rose-50 text-rose-700 ring-rose-200 line-through decoration-rose-300', punto: 'bg-rose-400', ayuda: 'Se canceló y la fecha quedó libre.' },
}
export const ORDEN_ESTADOS: EstadoReserva[] = ['consulta', 'tentativa', 'senada', 'confirmada', 'finalizada', 'cancelada']
export const ESTADOS_BLOQUEANTES: EstadoReserva[] = ['tentativa', 'senada', 'confirmada', 'finalizada']

export const ESTADOS_CONTRATO: Record<EstadoContrato, string> = {
  no_requerido: 'No requiere',
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  firmado: 'Firmado',
}

export const TIPOS_EVENTO: Record<string, string> = {
  casamiento: 'Casamiento',
  quince: 'Fiesta de 15',
  cumpleanos: 'Cumpleaños',
  infantil: 'Cumpleaños infantil',
  corporativo: 'Corporativo',
  egresados: 'Egresados',
  bautismo: 'Bautismo',
  comunion: 'Comunión',
  aniversario: 'Aniversario',
  conferencia: 'Conferencia',
  otro: 'Otro',
}

export const TIPOS_ESPACIO: Record<string, string> = {
  salon: 'Salón', quincho: 'Quincho', jardin: 'Jardín', terraza: 'Terraza', sala: 'Sala', auditorio: 'Auditorio', otro: 'Otro',
}

export const MEDIOS_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  cheque: 'Cheque',
  otro: 'Otro',
}

export const CONCEPTOS_PAGO: Record<string, string> = { sena: 'Seña', cuota: 'Cuota', saldo: 'Saldo', extra: 'Extra' }

export const CATEGORIAS_GASTO: Record<string, string> = {
  personal: 'Personal', catering: 'Catering', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento',
  servicios: 'Servicios (luz, gas, agua)', impuestos: 'Impuestos', alquiler: 'Alquiler', marketing: 'Marketing',
  proveedores: 'Proveedores', otro: 'Otro',
}

export const TIPOS_BLOQUEO: Record<string, string> = {
  mantenimiento: 'Mantenimiento', privado: 'Uso privado', feriado: 'Feriado', obra: 'Obra', otro: 'Otro',
}

export const ORIGENES_CLIENTE: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', web: 'Sitio web',
  recomendacion: 'Recomendación', llamada: 'Llamada', presencial: 'Presencial', otro: 'Otro',
}

export const CATEGORIAS_RECURSO: Record<string, string> = {
  mobiliario: 'Mobiliario', vajilla: 'Vajilla', sonido: 'Sonido', iluminacion: 'Iluminación',
  decoracion: 'Decoración', cocina: 'Cocina', otro: 'Otro',
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export const ZONAS_HORARIAS = [
  'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza',
  'America/Argentina/Salta', 'America/Argentina/Jujuy', 'America/Argentina/Tucuman',
  'America/Argentina/Catamarca', 'America/Argentina/La_Rioja', 'America/Argentina/San_Juan',
  'America/Argentina/San_Luis', 'America/Argentina/Rio_Gallegos', 'America/Argentina/Ushuaia',
  'America/Montevideo', 'America/Santiago', 'America/Asuncion', 'America/Sao_Paulo',
]

export const TIPOS_SERVICIO: Record<string, { etiqueta: string; ayuda: string }> = {
  paquete:   { etiqueta: 'Paquete',   ayuda: 'Combo cerrado (ej.: “Fiesta de 15 completa”).' },
  servicio:  { etiqueta: 'Servicio',  ayuda: 'Algo que se presupuesta por separado (ej.: catering, DJ).' },
  adicional: { etiqueta: 'Adicional', ayuda: 'Extra opcional (ej.: cabina de fotos, mesa dulce).' },
}
export const CATEGORIAS_SERVICIO: Record<string, string> = {
  salon: 'Alquiler del espacio', catering: 'Catering', bebidas: 'Bebidas', musica: 'Música y DJ', decoracion: 'Decoración',
  ambientacion: 'Ambientación e iluminación', fotografia: 'Foto y video', animacion: 'Animación y shows', mobiliario: 'Mobiliario',
  personal: 'Personal', otro: 'Otro',
}
export const UNIDADES_SERVICIO: Record<string, { etiqueta: string; corta: string }> = {
  evento: { etiqueta: 'Por evento', corta: 'evento' },
  persona: { etiqueta: 'Por persona', corta: 'por persona' },
  hora: { etiqueta: 'Por hora', corta: 'por hora' },
  unidad: { etiqueta: 'Por unidad', corta: 'c/u' },
}
export const ESTADOS_PRESUPUESTO: Record<string, { etiqueta: string; clase: string }> = {
  borrador:  { etiqueta: 'Borrador',  clase: 'bg-slate-100 text-slate-700 ring-slate-200' },
  enviado:   { etiqueta: 'Enviado',   clase: 'bg-sky-100 text-sky-800 ring-sky-200' },
  aceptado:  { etiqueta: 'Aceptado',  clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  rechazado: { etiqueta: 'Rechazado', clase: 'bg-rose-50 text-rose-700 ring-rose-200' },
  vencido:   { etiqueta: 'Vencido',   clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
}
export const MODALIDADES_ENTREVISTA: Record<string, string> = { presencial: 'En el salón', videollamada: 'Videollamada', telefono: 'Por teléfono' }
export const ESTADOS_ENTREVISTA: Record<string, { etiqueta: string; clase: string }> = {
  programada: { etiqueta: 'Agendada', clase: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  realizada:  { etiqueta: 'Realizada', clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  cancelada:  { etiqueta: 'Cancelada', clase: 'bg-rose-50 text-rose-700 ring-rose-200' },
  no_asistio: { etiqueta: 'No vino', clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
}
