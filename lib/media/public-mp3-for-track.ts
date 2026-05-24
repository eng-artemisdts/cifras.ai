/**
 * URL pública do MP3 em `public/media/mp3`, nomeado pelo `trackId` da faixa
 * (ex.: `all_i_need` → `/media/mp3/all_i_need.mp3`).
 */
export function publicMp3UrlForTrackId(trackId: string): string {
  const id = trackId.trim();
  if (!id) return "";
  return `/media/mp3/${encodeURIComponent(id)}.mp3`;
}
