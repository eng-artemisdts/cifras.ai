import type { SchubertRecognizedSong } from "@/lib/schubert-identify-types";
import type { SchubertTrackJson } from "@/lib/schubert-api";

export type ImportMetadataMode = "ingest" | "variation";

/** Estado partilhado entre detecção e o passo de revisão de metadados. */
export type ImportMetadataContext = {
  file: File;
  mode: ImportMetadataMode;
  /** Metadados AudD / formulário; podem estar vazios se não houve detecção. */
  song: SchubertRecognizedSong;
  /** Só em `variation`: faixa base Schubert já reconhecida. */
  variationBaseTrack?: SchubertTrackJson;
  variationBaseTrackId?: string;
};

export function emptyRecognizedSong(): SchubertRecognizedSong {
  return {
    title: "",
    artist: "",
    album: "",
    release_date: "",
    label: "",
    timecode: "",
    song_link: "",
    spotify_artist_ids: [],
  };
}

/** Metadados exibidos no passo de revisão ao criar variação a partir da faixa na base. */
export function recognizedSongForVariation(
  base: SchubertTrackJson,
  audd: SchubertRecognizedSong | null,
): SchubertRecognizedSong {
  const empty = emptyRecognizedSong();
  const titleFromTrack = typeof base.name === "string" ? base.name.trim() : "";
  const artistFromTrack =
    typeof base.artistId === "object" && base.artistId && "name" in base.artistId
      ? String((base.artistId as { name?: string }).name ?? "").trim()
      : "";
  if (audd && (audd.title.trim() || audd.artist.trim())) {
    return {
      ...empty,
      ...audd,
      title: audd.title.trim() || titleFromTrack,
      artist: audd.artist.trim() || artistFromTrack,
      album: (audd.album ?? "").trim(),
      cover_image_url: audd.cover_image_url ?? base.coverImageUrl,
    };
  }
  return {
    ...empty,
    title: titleFromTrack,
    artist: artistFromTrack,
    album: "",
    cover_image_url: base.coverImageUrl ?? audd?.cover_image_url,
  };
}

export function mergeSongMeta(
  base: SchubertRecognizedSong,
  overrides: Pick<SchubertRecognizedSong, "title" | "artist" | "album">,
): SchubertRecognizedSong {
  return {
    ...base,
    title: overrides.title.trim(),
    artist: overrides.artist.trim(),
    album: overrides.album.trim(),
  };
}
