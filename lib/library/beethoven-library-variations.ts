import { fetchBeethovenFromBrowser } from "@/lib/beethoven-browser-client";

/** Falha numa ação da biblioteca, com o status HTTP da Beethoven para escolher a mensagem. */
export class LibraryActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LibraryActionError";
  }
}

export async function deleteMyVariationByTrackId(trackId: string): Promise<void> {
  const key = trackId.trim();
  if (!key) throw new Error("variation_track_id_missing");
  const res = await fetchBeethovenFromBrowser(`tracks/variations/by-track-id/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new LibraryActionError(`delete_variation_failed:${res.status}`, res.status);
  }
}

export async function removeTrackFromLibraryByTrackKey(trackKey: string): Promise<void> {
  const key = trackKey.trim();
  if (!key) throw new Error("library_track_key_missing");
  const res = await fetchBeethovenFromBrowser(`library-home/access/by-track-key/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new LibraryActionError(`remove_library_track_failed:${res.status}`, res.status);
  }
}

/** Mensagem para o utilizador quando excluir uma versão ou remover da biblioteca falha. */
export function libraryActionErrorMessage(
  error: unknown,
  action: "delete-version" | "remove-library",
): string {
  const status = error instanceof LibraryActionError ? error.status : 0;
  if (status === 401) return "Sua sessão expirou. Entre de novo e tente outra vez.";
  if (action === "delete-version") {
    if (status === 400) return "Esta é a cifra original e não pode ser excluída, só as versões criadas a partir dela.";
    if (status === 403) return "Só quem criou esta versão pode excluí-la.";
    if (status === 404) return "Esta versão já foi excluída. Atualize a página.";
    return "Não foi possível excluir a versão agora. Tente novamente.";
  }
  if (status === 404) return "Esta música já não está na sua biblioteca. Atualize a página.";
  return "Não foi possível remover da biblioteca agora. Tente novamente.";
}
