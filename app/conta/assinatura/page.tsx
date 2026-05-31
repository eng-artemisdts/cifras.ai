import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, RefreshCw, Shield, Sparkles } from "lucide-react";

import { SubscribePlanButton } from "@/components/billing/subscribe-plan-button";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { getAuth0SessionCached } from "@/lib/auth0";
import { auth0LoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import {
  fetchAuth0UserBillingSnapshot,
  isAuth0ManagementConfigured,
} from "@/lib/billing/auth0-management";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { billingPlanFromSessionUser, stripeCustomerIdFromSessionUser } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assinatura",
  description: "Plano e faturação no cifra.ai.",
};

const PLAN_LABEL: Record<BillingPlan, { title: string; blurb: string }> = {
  free: {
    title: "Grátis",
    blurb: "Ideal para experimentar buscas e a biblioteca essencial.",
  },
  starter: {
    title: "Starter",
    blurb: "Importações e relatórios para o dia a dia da banda ou estúdio.",
  },
  pro: {
    title: "Pro",
    blurb: "Importações avançadas, variações ilimitadas e suporte prioritário.",
  },
};

function planCardClass(plan: BillingPlan): string {
  if (plan === "pro") {
    return "border-cifra-gold/35 bg-gradient-to-br from-cifra-gold/[0.08] via-cifra-surface to-cifra-surface shadow-[0_0_40px_-12px_rgba(240,180,41,0.25)]";
  }
  if (plan === "starter") {
    return "border-cifra-teal/30 bg-gradient-to-br from-cifra-teal/[0.07] via-cifra-surface to-cifra-surface shadow-[0_0_36px_-14px_rgba(15,210,193,0.2)]";
  }
  return "border-cifra-border bg-cifra-surface";
}

type AssinaturaPageProps = {
  searchParams?: Promise<{ checkout?: string | string[] }>;
};

export default async function AssinaturaPage({ searchParams }: AssinaturaPageProps) {
  if (!isAuth0Configured()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cifra-bg px-6 py-20">
        <div className="max-w-md rounded-2xl border border-cifra-border bg-cifra-surface px-8 py-10 text-center">
          <Shield className="mx-auto size-10 text-cifra-muted" strokeWidth={1.25} aria-hidden />
          <p className="mt-4 text-sm text-cifra-muted">
            O serviço de contas não está disponível neste ambiente.
          </p>
        </div>
      </div>
    );
  }

  const session = await getAuth0SessionCached();
  if (!session?.user) {
    redirect(auth0LoginHref({ returnTo: "/conta/assinatura" }));
  }

  const sp = searchParams ? await searchParams : {};
  const checkoutRaw =
    typeof sp.checkout === "string" ? sp.checkout : Array.isArray(sp.checkout) ? sp.checkout[0] : undefined;
  const checkoutSuccess = checkoutRaw === "success";

  const snapshot =
    session.user.sub && isAuth0ManagementConfigured()
      ? await fetchAuth0UserBillingSnapshot(session.user.sub)
      : null;

  const planFromSession = billingPlanFromSessionUser(session.user);
  const plan =
    snapshot?.plan !== undefined && snapshot.plan !== null ? snapshot.plan : planFromSession;

  const hasStripeCustomer = Boolean(
    snapshot?.stripe_customer_id ?? stripeCustomerIdFromSessionUser(session.user),
  );

  const planInfo = PLAN_LABEL[plan];
  const liveFromAuth0 = Boolean(
    snapshot &&
      (snapshot.plan !== undefined ||
        Boolean(snapshot.stripe_customer_id) ||
        snapshot.subscription_status != null),
  );
  const maybePendingWebhook =
    checkoutSuccess &&
    plan === "free" &&
    !hasStripeCustomer &&
    isAuth0ManagementConfigured();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-cifra-bg text-cifra-text">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-cifra-teal/6 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-cifra-gold/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-px w-[min(100%,720px)] -translate-x-1/2 bg-linear-to-r from-transparent via-cifra-border to-transparent opacity-80"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-10 sm:px-8 sm:pt-14">
        <Link
          href="/biblioteca"
          className="group inline-flex items-center gap-2 text-sm font-medium text-cifra-muted transition-colors hover:text-cifra-teal"
        >
          <ArrowLeft
            className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
            strokeWidth={2}
            aria-hidden
          />
          Voltar à biblioteca
        </Link>

        <header className="mt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both">
          <span className="inline-flex items-center gap-2 rounded-full border border-cifra-border bg-cifra-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cifra-muted">
            <Sparkles className="size-3.5 text-cifra-teal" strokeWidth={2} aria-hidden />
            Conta
          </span>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl">Assinatura</h1>
            {liveFromAuth0 ? (
              <span className="rounded-full border border-cifra-teal/35 bg-cifra-teal/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cifra-teal">
                Estado em tempo real
              </span>
            ) : null}
          </div>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-cifra-muted">
            {isAuth0ManagementConfigured()
              ? "O seu plano e dados de faturação são actualizados automaticamente após cada pagamento. Se outras áreas da app ainda mostrarem o plano antigo, termine a sessão e entre de novo."
              : "Após o pagamento, o plano pode demorar alguns segundos a actualizar. Actualize a página se necessário."}
          </p>
          {checkoutSuccess && !maybePendingWebhook ? (
            <p className="mt-4 max-w-xl rounded-xl border border-cifra-teal/30 bg-cifra-teal/10 px-4 py-3 text-sm text-cifra-text">
              Pagamento concluído. Se o plano abaixo já está correcto, está tudo sincronizado.
            </p>
          ) : null}
          {maybePendingWebhook ? (
            <p className="mt-4 max-w-xl rounded-xl border border-cifra-gold/35 bg-cifra-gold/10 px-4 py-3 text-sm text-cifra-text">
              Ainda não vemos a subscrição na conta. Aguarde alguns segundos e{" "}
              <strong className="text-white">actualize a página</strong>. Se o problema
              persistir, contacte o suporte.
            </p>
          ) : null}
        </header>

        <div className="mt-12 max-w-xl">
          <section
            className={cn(
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-100 motion-safe:duration-700 motion-safe:fill-mode-both rounded-2xl border p-6 sm:p-8",
              planCardClass(plan),
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cifra-muted">
                  Plano atual
                </p>
                <p className="mt-2 font-serif text-3xl text-white sm:text-4xl">{planInfo.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">{planInfo.blurb}</p>
              </div>
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-2xl border",
                  plan === "pro" && "border-cifra-gold/30 bg-cifra-gold/10 text-cifra-gold",
                  plan === "starter" && "border-cifra-teal/35 bg-cifra-teal/10 text-cifra-teal",
                  plan === "free" && "border-cifra-border bg-cifra-surface-2 text-cifra-muted",
                )}
              >
                <CreditCard className="size-7" strokeWidth={1.5} aria-hidden />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-cifra-border/80 pt-6">
              {hasStripeCustomer ? (
                <ManageBillingButton className="inline-flex items-center justify-center rounded-xl border border-cifra-teal/45 bg-cifra-teal/10 px-5 py-2.5 text-sm font-semibold text-cifra-teal transition hover:border-cifra-teal hover:bg-cifra-teal/18" />
              ) : (
                <p className="text-sm text-cifra-muted">
                  Após a primeira subscrição, poderá gerir cartão e faturas aqui.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="mt-8 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-200 motion-safe:duration-600 motion-safe:fill-mode-both flex gap-4 rounded-2xl border border-cifra-border/80 bg-cifra-surface-2/50 px-4 py-4 sm:px-5">
          <RefreshCw className="mt-0.5 size-5 shrink-0 text-cifra-gold/90" strokeWidth={1.75} aria-hidden />
          <p className="text-sm leading-relaxed text-cifra-muted">
            <span className="font-medium text-cifra-text">Sincronização:</span> após o pagamento,
            o plano é actualizado automaticamente. Se vir informação desactualizada noutras
            páginas, termine a sessão e entre de novo.
          </p>
        </aside>

        {plan !== "pro" ? (
          <div className="mt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both rounded-2xl border border-cifra-border bg-cifra-surface-2/40 p-6 sm:p-8">
            <h2 className="font-serif text-xl text-white sm:text-2xl">Subir de plano</h2>
            <p className="mt-2 max-w-lg text-sm text-cifra-muted">
              Pagamento seguro. O plano Pro inclui 14 dias de teste quando disponível.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              {plan === "free" ? (
                <SubscribePlanButton
                  plan="starter"
                  className="flex flex-1 items-center justify-center rounded-xl border border-cifra-teal/45 bg-cifra-teal/10 py-3.5 text-center text-sm font-semibold text-cifra-teal transition hover:border-cifra-teal hover:bg-cifra-teal/18"
                >
                  Assinar Starter
                </SubscribePlanButton>
              ) : null}
              <SubscribePlanButton
                plan="pro"
                className="flex flex-1 items-center justify-center rounded-xl bg-cifra-teal py-3.5 text-center text-sm font-semibold text-cifra-bg shadow-lg shadow-cifra-teal/20 transition hover:bg-cifra-teal-hover hover:shadow-cifra-teal/30"
              >
                {plan === "free" ? "Pro — trial 14 dias" : "Subir para Pro"}
              </SubscribePlanButton>
            </div>
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-cifra-muted">
            Está no plano máximo desta página. Use &quot;Gerir faturação&quot; para alterar método de
            pagamento ou cancelar.
          </p>
        )}
      </div>
    </div>
  );
}
