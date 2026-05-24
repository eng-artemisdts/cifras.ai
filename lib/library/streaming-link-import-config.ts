import type { AuthSidebarFeature } from "@/lib/auth-layout/types";

export const STREAMING_IMPORT_PROVIDER_SLUGS = ["youtube", "spotify", "tiktok", "instagram"] as const;

export type StreamingImportProviderSlug = (typeof STREAMING_IMPORT_PROVIDER_SLUGS)[number];

export type StreamingLinkMetaColumn = {
  title: string;
  body: string;
  titleVariant?: "default" | "gold";
};

/** Dados da coluna esquerda (AuthMarketingSidebar). */
export type StreamingLinkImportSidebarConfig = {
  titleLine1: string;
  titleLine2Gradient: string;
  titleLine3Muted: string;
  introText: string;
  features: AuthSidebarFeature[];
};

/** Dados do painel principal (componente único). */
export type StreamingLinkImportPanelConfig = {
  slug: StreamingImportProviderSlug;
  requiresPro: boolean;
  rowTopTitle: string;
  rowTopMonoHint: string;
  cardTag: string;
  cardTagRight: string;
  instructions: string[];
  exampleUrls: string;
  urlPlaceholder: string;
  metaColumns: StreamingLinkMetaColumn[];
  hint: string;
};

export type StreamingLinkImportConfig = {
  sidebar: StreamingLinkImportSidebarConfig;
  panel: StreamingLinkImportPanelConfig;
  /** Título curto para metadata (ex.: «YouTube»). */
  pageTitle: string;
};

const steps23: AuthSidebarFeature[] = [
  { title: "02  Captura", description: "Link ou arquivo de áudio", accent: "muted" },
  { title: "03  IA analisa", description: "Acordes sugeridos", accent: "muted" },
];

const metaDefault: StreamingLinkMetaColumn[] = [
  {
    title: "Links públicos",
    body: "Vídeos e playlists precisam estar acessíveis sem login especial.",
  },
  {
    title: "Detecção Pro mais precisa",
    body: "Assinantes Pro usam pipelines de IA com modelos e ajustes extras — acordes mais estáveis em arranjos densos e menos retrabalho manual antes de exportar a cifra.",
  },
  {
    title: "Privacidade",
    body: "Só processamos o áudio necessário para gerar a cifra.",
    titleVariant: "gold",
  },
];

/**
 * Conteúdo alinhado aos frames Pencil: lCtH3 (YouTube), 0dhNf (Spotify), O39X7 (TikTok), o1Z4x (Instagram).
 */
export const streamingLinkImportConfig: Record<StreamingImportProviderSlug, StreamingLinkImportConfig> = {
  youtube: {
    pageTitle: "YouTube",
    sidebar: {
      titleLine1: "YouTube",
      titleLine2Gradient: "como enviar",
      titleLine3Muted: "o link",
      introText:
        "Siga os passos ao lado direito: copie o URL público no app ou site do YouTube e cole no cifra.ai.",
      features: [
        { title: "01  Origem", description: "URL do vídeo ou playlist", accent: "teal" },
        ...steps23,
      ],
    },
    panel: {
      slug: "youtube",
      requiresPro: false,
      rowTopTitle: "Instruções · YouTube",
      rowTopMonoHint: "Copiar link no app ou navegador",
      cardTag: "YOUTUBE",
      cardTagRight: "Link público do vídeo ou playlist",
      instructions: [
        "1. Abra o vídeo, Shorts ou playlist no app YouTube ou no navegador.",
        "2. Toque em Compartilhar e depois em Copiar link. Em playlists, use o menu ⋮ da lista e escolha Compartilhar → Copiar link da playlist.",
        "3. Cole o link na caixa abaixo ou na próxima tela de captura. O conteúdo precisa estar público (sem login obrigatório).",
      ],
      exampleUrls:
        "https://www.youtube.com/watch?v=…\nhttps://youtu.be/…\nhttps://www.youtube.com/playlist?list=…",
      urlPlaceholder: "Cole o link do YouTube aqui",
      metaColumns: metaDefault,
      hint: "Conteúdo com muita voz comprimida ou marca d'água pode reduzir a precisão da IA.",
    },
  },
  spotify: {
    pageTitle: "Spotify",
    sidebar: {
      titleLine1: "Spotify",
      titleLine2Gradient: "playlists",
      titleLine3Muted: "ou link",
      introText:
        "Com a conta Spotify ligada ao cifra.ai, navegue pelas suas playlists e escolha uma faixa; ou cole o link open.spotify.com da música.",
      features: [
        { title: "01  Origem", description: "Playlists · URL da faixa", accent: "teal" },
        ...steps23,
      ],
    },
    panel: {
      slug: "spotify",
      requiresPro: false,
      rowTopTitle: "Importar · Spotify",
      rowTopMonoHint: "Conta ligada · playlists e links",
      cardTag: "SPOTIFY",
      cardTagRight: "Playlists da conta ou link da faixa",
      instructions: [
        "1. Ligue o Spotify em Conta · Perfil se ainda não estiver ligado (permite ler as suas playlists).",
        "2. No separador «Minhas playlists», escolha uma lista e depois uma faixa — segue para enviar um excerto de áudio para a IA.",
        "3. Ou no separador «Colar link», use o URL da faixa (open.spotify.com/track/…) como antes.",
      ],
      exampleUrls:
        "https://open.spotify.com/track/…\nhttps://open.spotify.com/playlist/…\nhttps://open.spotify.com/album/…",
      urlPlaceholder: "Cole o link do Spotify aqui",
      metaColumns: metaDefault,
      hint: "Conteúdo com muita voz comprimida ou marca d'água pode reduzir a precisão da IA.",
    },
  },
  tiktok: {
    pageTitle: "TikTok",
    sidebar: {
      titleLine1: "TikTok",
      titleLine2Gradient: "como enviar",
      titleLine3Muted: "o link",
      introText:
        "O TikTok gera um URL curto (vm.tiktok.com) ou longo; ambos podem ser colados no cifra.ai.",
      features: [
        { title: "01  Origem", description: "Link do vídeo público", accent: "teal" },
        ...steps23,
      ],
    },
    panel: {
      slug: "tiktok",
      requiresPro: true,
      rowTopTitle: "Instruções · TikTok",
      rowTopMonoHint: "Compartilhar → copiar link",
      cardTag: "TIKTOK",
      cardTagRight: "Link direto do vídeo",
      instructions: [
        "1. Abra o vídeo ou som no app TikTok.",
        "2. Toque na seta Compartilhar (à direita) e depois em Copiar link. Em alguns dispositivos o caminho é Compartilhar → Mais → Copiar.",
        "3. Cole o link abaixo ou na próxima etapa. Perfis ou vídeos privados não funcionam — o post precisa ser público.",
      ],
      exampleUrls: "https://www.tiktok.com/@usuario/video/…\nhttps://vm.tiktok.com/…",
      urlPlaceholder: "Cole o link do TikTok aqui",
      metaColumns: metaDefault,
      hint: "Conteúdo com muita voz comprimida ou marca d'água pode reduzir a precisão da IA.",
    },
  },
  instagram: {
    pageTitle: "Instagram Reels",
    sidebar: {
      titleLine1: "Instagram",
      titleLine2Gradient: "Reels ·",
      titleLine3Muted: "como enviar",
      introText: "Use Copiar link no menu ⋯ do post ou o URL público do Reel no navegador.",
      features: [
        { title: "01  Origem", description: "Link instagram.com/reel ou /p/", accent: "teal" },
        ...steps23,
      ],
    },
    panel: {
      slug: "instagram",
      requiresPro: true,
      rowTopTitle: "Instruções · Instagram Reels",
      rowTopMonoHint: "Menu ⋯ → copiar link",
      cardTag: "INSTAGRAM",
      cardTagRight: "Reels ou post de vídeo público",
      instructions: [
        "1. Abra o Reel ou o vídeo no app Instagram (aba Reels ou feed).",
        "2. Toque em ⋯ no canto superior direito do post e escolha Copiar link. No navegador, copie o URL da barra de endereços.",
        "3. Cole o link abaixo ou na captura seguinte. Contas privadas ou conteúdo restrito a seguidores não são aceitos — o Reel precisa abrir sem login.",
      ],
      exampleUrls: "https://www.instagram.com/reel/…\nhttps://www.instagram.com/p/…",
      urlPlaceholder: "Cole o link do Instagram aqui",
      metaColumns: metaDefault,
      hint: "Conteúdo com muita voz comprimida ou marca d'água pode reduzir a precisão da IA.",
    },
  },
};

export function isStreamingImportProviderSlug(s: string): s is StreamingImportProviderSlug {
  return (STREAMING_IMPORT_PROVIDER_SLUGS as readonly string[]).includes(s);
}
