import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://cifra.ai";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return DEFAULT_SITE_URL;
    }
  }
  return DEFAULT_SITE_URL;
}

const SITE_NAME = "cifra.ai";
const DEFAULT_TITLE = "Cifras e acordes com IA";
const DEFAULT_DESCRIPTION =
  "cifra.ai ajuda músicos e equipes a extrair, revisar e exportar cifras a partir de áudio e links — com uma interface moderna e fluxos pensados para o palco e para o produto.";

/** Metadados alinhados às práticas do Google (títulos, descrição, OG/Twitter, robots, canonical base). */
export function buildRootMetadata(overrides?: Metadata): Metadata {
  const siteUrl = getSiteUrl();
  const base: Metadata = {
    metadataBase: new URL(siteUrl),
    applicationName: SITE_NAME,
    title: {
      default: `${SITE_NAME} · ${DEFAULT_TITLE}`,
      template: `%s · ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: [
      "cifra",
      "acordes",
      "música",
      "IA",
      "transcrição",
      "cifras",
      "letras",
      "músicos",
    ],
    authors: [{ name: SITE_NAME, url: siteUrl }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      languages: {
        "pt-BR": "/",
      },
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: siteUrl,
      siteName: SITE_NAME,
      title: `${SITE_NAME} · ${DEFAULT_TITLE}`,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: "/logo.svg", width: 828, height: 220, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} · ${DEFAULT_TITLE}`,
      description: DEFAULT_DESCRIPTION,
      images: ["/logo.svg"],
    },
    category: "music",
  };

  return { ...base, ...overrides };
}

/** JSON-LD (WebSite + Organization) recomendado pelo Google para marca e URL canônica. */
export function GoogleSiteSeo() {
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: SITE_NAME,
        url: siteUrl,
        inLanguage: "pt-BR",
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": `${siteUrl}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/logo.svg`,
      },
    ],
  };

  return (
    <script
      id="cifra-google-site-seo-jsonld"
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
