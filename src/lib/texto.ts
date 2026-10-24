/** Igual que public.normalizar() en la base: minúsculas y sin acentos. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
