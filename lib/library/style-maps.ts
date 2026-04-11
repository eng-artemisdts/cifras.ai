import type {
  MusicCatalogCard,
  RecentAccessItem,
  RecommendationTile,
} from "./types";

export const recommendationCoverClass: Record<
  RecommendationTile["coverTone"],
  string
> = {
  navy: "bg-[#1C1F3E]",
  navyAlt: "bg-[#1C1F3E]",
  surface: "bg-cifra-surface-2",
  tealGlow: "bg-linear-to-br from-cifra-teal/13 to-[#1C1F3E]",
};

export const recentThumbClass: Record<RecentAccessItem["thumbTone"], string> = {
  navy: "bg-[#1C1F3E]",
  tealTint: "bg-cifra-teal/20",
  surface: "bg-cifra-surface-2",
};

export const musicCoverClass: Record<MusicCatalogCard["coverTone"], string> = {
  navy: "bg-[#1C1F3E]",
  navyTeal:
    "bg-linear-to-r from-[#1C1F3E] to-cifra-teal/20",
  surface: "bg-cifra-surface-2",
};

export const artistAvatarClass: Record<
  "navy" | "tealGradient",
  string
> = {
  navy: "bg-[#1C1F3E]",
  tealGradient: "bg-linear-to-br from-cifra-teal to-[#1C1F3E]",
};
