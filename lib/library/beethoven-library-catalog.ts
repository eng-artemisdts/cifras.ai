import { fetchBeethovenFromServer } from "@/lib/beethoven-server-api";
import type { ArtistSuggestion, CatalogTabId, MusicCatalogCard } from "@/lib/library/types";

type CatalogTrack = {
  id?: string;
  trackKey?: string | null;
  name?: string;
  artistName?: string;
  imageUrl?: string | null;
  isPrivate?: boolean;
  isSaved?: boolean;
  hasMyVersion?: boolean;
  isOwnerVersion?: boolean;
  accessHref?: string | null;
  editHref?: string | null;
};

type CatalogArtist = {
  id?: string;
  artistName?: string;
  imageUrl?: string | null;
  tracksCount?: number;
  hasMyVersion?: boolean;
};

type BeethovenLibraryCatalogResponse = {
  tab?: CatalogTabId;
  tracks?: CatalogTrack[];
  artists?: CatalogArtist[];
  total?: number;
};

const coverTones: MusicCatalogCard["coverTone"][] = ["navy", "navyTeal", "surface"];
const avatarTones: ArtistSuggestion["avatarTone"][] = ["navy", "tealGradient"];

function normalizeCatalogKeyPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function preferredTrack(a: CatalogTrack, b: CatalogTrack): CatalogTrack {
  const score = (track: CatalogTrack): number => {
    if (track.isOwnerVersion === true) return 3;
    if (track.isSaved === true) return 2;
    return 1;
  };
  return score(b) > score(a) ? b : a;
}

export async function fetchLibraryCatalog(params: {
  userId?: string;
  tab: CatalogTabId;
  limit?: number;
}): Promise<{ tracks: MusicCatalogCard[]; artists: ArtistSuggestion[]; total: number }> {
  const query = new URLSearchParams({
    tab: params.tab,
    limit: String(params.limit ?? 120),
  });
  if (params.userId?.trim()) query.set("userId", params.userId.trim());
  const res = await fetchBeethovenFromServer(`library-home/catalog?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`beethoven_library_catalog_failed:${res.status}`);
  }
  const data = (await res.json()) as BeethovenLibraryCatalogResponse;
  const tracksRawBase = Array.isArray(data.tracks) ? data.tracks : [];
  const artistsRaw = Array.isArray(data.artists) ? data.artists : [];
  const tracksRaw =
    params.tab === "musicas"
      ? (() => {
          const dedup = new Map<string, CatalogTrack>();
          for (const track of tracksRawBase) {
            const key = `${normalizeCatalogKeyPart(track.name)}::${normalizeCatalogKeyPart(track.artistName)}`;
            if (!key || key === "::") continue;
            const prev = dedup.get(key);
            dedup.set(key, prev ? preferredTrack(prev, track) : track);
          }
          return [...dedup.values()];
        })()
      : tracksRawBase;

  const tracks = tracksRaw.map((track, index): MusicCatalogCard => {
    const isPrivate = track.isPrivate === true;
    const isSaved = track.isSaved === true;
    const isOwnerVersion = track.isOwnerVersion === true;
    const tagLabel = isOwnerVersion
      ? "Minha versão"
      : isPrivate
        ? "Privada"
        : isSaved
          ? "Salva"
          : "Pública";
    return {
      id: track.id ?? `track-${index}`,
      title: track.name?.trim() || "Sem nome",
      subtitle: `${track.artistName?.trim() || "Artista desconhecido"} · Cifra`,
      tagLabel,
      tagVariant: isOwnerVersion || isSaved ? "teal" : "amber",
      coverTone: coverTones[index % coverTones.length],
      coverImageUrl: typeof track.imageUrl === "string" && track.imageUrl.trim() ? track.imageUrl.trim() : null,
      isOwnerVersion,
      isSaved,
      accessHref: typeof track.accessHref === "string" ? track.accessHref : null,
      editHref: typeof track.editHref === "string" ? track.editHref : null,
      trackKey: typeof track.trackKey === "string" ? track.trackKey : null,
    };
  });

  const artists = artistsRaw.map((artist, index): ArtistSuggestion => {
    const count = Number.isFinite(artist.tracksCount) ? Number(artist.tracksCount) : 0;
    const hasMyVersion = artist.hasMyVersion === true;
    return {
      id: artist.id ?? `artist-${index}`,
      name: artist.artistName?.trim() || "Artista desconhecido",
      description: hasMyVersion
        ? `${count} cifra(s) · você tem versão`
        : `${count} cifra(s) na biblioteca`,
      followState: hasMyVersion ? "following" : "idle",
      avatarTone: avatarTones[index % avatarTones.length],
      avatarImageUrl:
        typeof artist.imageUrl === "string" && artist.imageUrl.trim() ? artist.imageUrl.trim() : null,
    };
  });

  return {
    tracks,
    artists,
    total: params.tab === "musicas" ? tracks.length : Number.isFinite(data.total) ? Number(data.total) : artists.length,
  };
}
