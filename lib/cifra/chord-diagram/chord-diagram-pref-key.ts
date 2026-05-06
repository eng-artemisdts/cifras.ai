/** Normaliza etiqueta de acorde para chave de preferência (mapa estável). */
export function normalizeChordDiagramPrefKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}
