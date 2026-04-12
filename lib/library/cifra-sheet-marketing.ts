import type { AuthMarketingSidebarProps } from "@/components/layout/auth-marketing-sidebar";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";

/** Passos da vista «cifra na biblioteca» (alinhado ao fluxo letra + harmonia). */
const bibliotecaCifraFeatures: AuthSidebarFeature[] = [
  { title: "01  Ouvir", description: "Áudio de referência sincronizado", accent: "teal" },
  { title: "02  Ler a cifra", description: "Acordes no tempo com a letra", accent: "muted" },
  { title: "03  Afinar detalhes", description: "Capo e exportação em breve", accent: "muted" },
];

const bibliotecaCifraIntro =
  "A letra e os acordes vêm da base Schubert — use o player para seguir o destaque e a auto-rolagem como no laboratório.";

/**
 * Textos por defeito da `AuthMarketingSidebar` na vista de cifra da biblioteca.
 * Sobrescreva campos em `marketingSidebar` em `CifraSheetPageView` quando esta vista for reutilizada ailleurs.
 */
export const bibliotecaCifraSheetMarketingSidebar: Partial<AuthMarketingSidebarProps> = {
  contextLabel: "cifra · lab",
  contextUppercase: false,
  titleLine1: "Cifra",
  titleLine2: "sincronizada",
  titleLine3: "letra e harmonia",
  introText: bibliotecaCifraIntro,
  features: bibliotecaCifraFeatures,
};
