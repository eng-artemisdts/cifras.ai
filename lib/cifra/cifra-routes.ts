/** Cifra pública sincronizada — rota `/cifra?trackId=`. */
export function cifraHref(trackId: string): string {
  const id = trackId.trim();
  if (!id) return "/cifra";
  return `/cifra?trackId=${encodeURIComponent(id)}`;
}

/** Editor de transcrição (requer sessão). */
export function cifraEditHref(trackId: string): string {
  const id = trackId.trim();
  if (!id) return "/cifra/edit";
  return `/cifra/edit?trackId=${encodeURIComponent(id)}`;
}
