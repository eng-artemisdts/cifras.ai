export type LibraryNavItem = {
  href: string;
  label: string;
  current?: boolean;
};

/** Card da faixa horizontal “Recomendados”. */
export type RecommendationTile = {
  id: string;
  title: string;
  subtitle: string;
  /** Classes Tailwind para o bloco de capa (cor sólida ou gradiente). */
  coverTone: "navy" | "navyAlt" | "surface" | "tealGlow";
  /** Capa da Schubert quando existe `trackKey` em `tracks/by-key`. */
  coverImageUrl?: string | null;
  /** `/cifras/:artistSlug/:songSlug` quando há slugs; senão `/cifras?trackId=`. */
  href?: string | null;
};

/** Linha em “Últimos acessos”. */
export type RecentAccessItem = {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  thumbTone: "navy" | "tealTint" | "surface";
  coverImageUrl?: string | null;
  /** `/cifras/:artistSlug/:songSlug` ou `/cifras?trackId=`. */
  href?: string | null;
};

export type CatalogTabId = "musicas" | "artistas" | "albuns" | "playlists";

export type CatalogTab = {
  id: CatalogTabId;
  label: string;
};

/** Card do grid principal (músicas). */
export type MusicCatalogCard = {
  id: string;
  title: string;
  subtitle: string;
  tagLabel: string;
  tagVariant: "teal" | "amber";
  coverTone: "navy" | "navyTeal" | "surface";
  coverImageUrl?: string | null;
  isOwnerVersion?: boolean;
  canDeleteVersion?: boolean;
  isSaved?: boolean;
  accessHref?: string | null;
  editHref?: string | null;
  trackKey?: string | null;
};

/** Linha “Artistas sugeridos”. */
export type ArtistSuggestion = {
  id: string;
  name: string;
  description: string;
  followState: "idle" | "following";
  avatarTone: "navy" | "tealGradient";
  avatarImageUrl?: string | null;
};
