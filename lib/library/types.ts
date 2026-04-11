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
};

/** Linha em “Últimos acessos”. */
export type RecentAccessItem = {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  thumbTone: "navy" | "tealTint" | "surface";
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
};

/** Linha “Artistas sugeridos”. */
export type ArtistSuggestion = {
  id: string;
  name: string;
  description: string;
  followState: "idle" | "following";
  avatarTone: "navy" | "tealGradient";
};
