import type { BillingPlan } from "@/lib/billing/plan-types";

/**
 * Fonte única dos preços e cotas mostrados no app (landing, /conta/assinatura, banner de cota).
 *
 * - Preços: têm de bater com os Prices activos na Stripe (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`).
 *   A Stripe cobra o valor do Price; este ficheiro só controla o que o utilizador vê.
 * - Cotas: espelham `schubert-api/src/ingest/import-quota.constants.ts` (`IMPORT_QUOTA_RULES`),
 *   que é quem aplica o limite.
 */

/** Janela deslizante dos planos pagos, em dias. */
export const IMPORT_QUOTA_WINDOW_DAYS = 30;

export type ImportQuotaWindow = "lifetime" | "rolling";

export type PlanCatalogEntry = {
  plan: BillingPlan;
  name: string;
  /** Preço mensal em reais; 0 no plano gratuito. */
  monthlyPriceBrl: number;
  importLimit: number;
  importWindow: ImportQuotaWindow;
  blurb: string;
  features: readonly string[];
};

export const PLAN_CATALOG: Record<BillingPlan, PlanCatalogEntry> = {
  free: {
    plan: "free",
    name: "Grátis",
    monthlyPriceBrl: 0,
    importLimit: 2,
    importWindow: "lifetime",
    blurb: "Experimente com 2 músicas geradas por IA e use todo o catálogo de cifras.",
    features: [
      "2 músicas geradas por IA, no total",
      "Acesso a todo o catálogo de cifras",
      "Biblioteca pessoal e favoritos",
      "Upload de MP3, YouTube e Spotify",
    ],
  },
  starter: {
    plan: "starter",
    name: "Starter",
    monthlyPriceBrl: 29.9,
    importLimit: 12,
    importWindow: "rolling",
    blurb: "Para quem tira músicas novas toda semana.",
    features: [
      "12 músicas novas a cada 30 dias",
      "Tudo do plano Grátis",
      "Variações com capo e tonalidade",
      "Exportação em PDF",
    ],
  },
  pro: {
    plan: "pro",
    name: "Pro",
    monthlyPriceBrl: 79.9,
    importLimit: 35,
    importWindow: "rolling",
    blurb: "Para professores, bandas e quem monta repertório o mês todo.",
    features: [
      "35 músicas novas a cada 30 dias",
      "Tudo do Starter",
      "TikTok e Instagram Reels",
      "Variações ilimitadas e suporte prioritário",
    ],
  },
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** `29.9` → `R$ 29,90`; `0` → `R$ 0`. */
export function formatPlanPrice(valueBrl: number): string {
  if (valueBrl === 0) return "R$ 0";
  return BRL.format(valueBrl).replace(/ /g, " ");
}

/** Frase curta da cota: «2 músicas no total» ou «12 músicas a cada 30 dias». */
export function importAllowanceLabel(entry: PlanCatalogEntry): string {
  const unit = entry.importLimit === 1 ? "música" : "músicas";
  return entry.importWindow === "lifetime"
    ? `${entry.importLimit} ${unit} no total`
    : `${entry.importLimit} ${unit} a cada ${IMPORT_QUOTA_WINDOW_DAYS} dias`;
}
