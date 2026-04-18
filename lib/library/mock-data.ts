import type {
  ArtistSuggestion,
  CatalogTab,
  LibraryNavItem,
  MusicCatalogCard,
  RecentAccessItem,
  RecommendationTile,
} from "./types";

const libraryNavBase: LibraryNavItem[] = [
  { href: "/explorar", label: "Explorar" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/biblioteca/importar", label: "Importar música" },
];

function libraryNavItemIsCurrent(item: LibraryNavItem, activePath: string): boolean {
  if (item.href === "#") return false;
  if (item.href === "/biblioteca/importar") {
    return activePath.startsWith("/biblioteca/importar");
  }
  if (item.href === "/explorar") {
    return activePath === "/explorar" || activePath.startsWith("/explorar/");
  }
  if (item.href === "/biblioteca") {
    return (
      activePath === "/biblioteca" ||
      (activePath.startsWith("/biblioteca/") && !activePath.startsWith("/biblioteca/importar"))
    );
  }
  if (item.href === "/") {
    return activePath === "/";
  }
  return activePath === item.href;
}

/** Itens da barra da biblioteca com `current` conforme a rota ativa. */
export function libraryNavForPath(activePath: string): LibraryNavItem[] {
  return libraryNavBase.map((item) => ({
    ...item,
    current: libraryNavItemIsCurrent(item, activePath),
  }));
}

export const catalogTabs: CatalogTab[] = [
  { id: "musicas", label: "Músicas" },
  { id: "artistas", label: "Artistas" },
  { id: "albuns", label: "Álbuns" },
  { id: "playlists", label: "Playlists" },
];

export const recommendationTiles: RecommendationTile[] = [
  {
    id: "r1",
    title: "Onda noturna",
    subtitle: "Marina Sol · MPB",
    coverTone: "navy",
  },
  {
    id: "r2",
    title: "Circuito azul",
    subtitle: "Atlas Vox · Synth-pop",
    coverTone: "navyAlt",
  },
  {
    id: "r3",
    title: "Ensaio ao vivo #4",
    subtitle: "Você · Importação salva",
    coverTone: "surface",
  },
  {
    id: "r4",
    title: "Neon Reverie",
    subtitle: "The Hollows · Indie",
    coverTone: "tealGlow",
  },
];

export const recentAccessItems: RecentAccessItem[] = [
  {
    id: "u1",
    title: "Starlight Echoes",
    subtitle: "Luna Ray · Álbum · há 2 h",
    timeLabel: "há 2 h",
    thumbTone: "navy",
  },
  {
    id: "u2",
    title: "Ensaio sem título",
    subtitle: "Importar música · Am · há 1 dia",
    timeLabel: "ontem",
    thumbTone: "tealTint",
  },
  {
    id: "u3",
    title: "Velvet Circuit",
    subtitle: "DJ Mira · Playlist · há 3 dias",
    timeLabel: "3 d",
    thumbTone: "surface",
  },
];

export const musicCatalogCards: MusicCatalogCard[] = [
  {
    id: "c1",
    title: "Starlight Echoes",
    subtitle: "Luna Ray · Álbum",
    tagLabel: "Pop",
    tagVariant: "teal",
    coverTone: "navy",
  },
  {
    id: "c2",
    title: "Neon Reverie",
    subtitle: "The Hollows · Single",
    tagLabel: "Indie",
    tagVariant: "teal",
    coverTone: "navyTeal",
  },
  {
    id: "c3",
    title: "Velvet Circuit",
    subtitle: "DJ Mira · Eletrônico",
    tagLabel: "Live",
    tagVariant: "amber",
    coverTone: "surface",
  },
];

export const artistSuggestions: ArtistSuggestion[] = [
  {
    id: "a1",
    name: "Luna Ray",
    description: "2,4 mi ouvintes mensais · Artista verificado",
    followState: "idle",
    avatarTone: "navy",
  },
  {
    id: "a2",
    name: "The Hollows",
    description: "Banda · Rock alternativo",
    followState: "following",
    avatarTone: "tealGradient",
  },
];
