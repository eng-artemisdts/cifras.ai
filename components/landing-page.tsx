import Image from "next/image";
import Link from "next/link";
import { AudioWaveform, Menu, Music2, Sparkles, X } from "lucide-react";

import LightRays from "@/components/LightRays";
import { SubscribePlanButton } from "@/components/billing/subscribe-plan-button";
import { ArtemisFooterBrand } from "@/components/layout/artemis-footer-brand";

const navLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-cifra-bg text-cifra-text">
      <header className="sticky top-0 z-50 border-b border-cifra-border bg-cifra-bg/80 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500 motion-safe:fill-mode-both">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center transition-opacity duration-200 hover:opacity-90 motion-reduce:transition-none"
          >
            <Image
              src="/logo.svg"
              alt="cifra.ai"
              width={228}
              height={60}
              className="h-6 w-auto shrink-0 object-contain sm:h-6"
              priority
              unoptimized
            />
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-cifra-muted transition-all duration-200 ease-out hover:text-cifra-teal motion-reduce:transition-none"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-cifra-border px-4 py-2 text-sm font-medium text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/40 hover:text-cifra-teal active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Entrar
            </Link>
            <a
              href="#demo"
              className="rounded-lg border border-cifra-border px-4 py-2 text-sm font-medium text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/40 hover:text-cifra-teal active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Ver demo
            </a>
            <Link
              href="/cadastro"
              className="rounded-lg bg-cifra-teal px-4 py-2 text-sm font-semibold text-cifra-bg shadow-sm shadow-cifra-teal/20 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-md hover:shadow-cifra-teal/25 active:scale-[0.98] motion-reduce:hover:shadow-sm motion-reduce:active:scale-100"
            >
              Começar agora
            </Link>
          </div>

          <details className="group relative sm:hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden">
              <span className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-cifra-border text-cifra-text transition-colors duration-200 hover:border-cifra-teal/35 hover:bg-cifra-surface">
                <Menu className="size-5 group-open:hidden" />
                <X className="hidden size-5 group-open:block" />
              </span>
            </summary>
            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-cifra-border bg-cifra-surface-2 p-3 shadow-xl">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-3 py-2 text-sm text-cifra-muted transition-colors duration-150 hover:bg-cifra-surface hover:text-cifra-text"
                >
                  {l.label}
                </a>
              ))}
              <hr className="my-2 border-cifra-border" />
              <Link
                href="/login"
                className="block rounded-lg px-3 py-2 text-sm text-cifra-text transition-colors duration-150 hover:bg-cifra-surface"
              >
                Entrar
              </Link>
              <a
                href="#demo"
                className="block rounded-lg px-3 py-2 text-sm text-cifra-text transition-colors duration-150 hover:bg-cifra-surface"
              >
                Ver demo
              </a>
              <Link
                href="/cadastro"
                className="mt-1 block rounded-lg bg-cifra-teal px-3 py-2 text-center text-sm font-semibold text-cifra-bg transition-all duration-200 hover:bg-cifra-teal-hover active:scale-[0.98]"
              >
                Começar agora
              </Link>
            </div>
          </details>
        </div>
      </header>

      <main className="flex-1">
        <section
          id="acesso"
          className="relative overflow-hidden border-b border-cifra-border px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24"
        >
          <div className="pointer-events-none absolute inset-0 z-0 min-h-full">
            <LightRays
              raysOrigin="top-center"
              raysColor="#0fd2c1"
              raysSpeed={0.85}
              lightSpread={0.9}
              rayLength={1.85}
              fadeDistance={1.05}
              saturation={0.92}
              mouseInfluence={0.08}
              className="min-h-full"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-1 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -20%, var(--cifra-glow) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(28, 31, 62, 0.5) 0%, transparent 50%)",
            }}
          />
          <div className="relative z-10 mx-auto max-w-[720px] text-center">
            <div className="flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out">
              <Image
                src="/logo.svg"
                alt="cifra.ai"
                width={828}
                height={220}
                className="h-10 w-auto max-w-[min(100%,240px)] shrink-0 object-contain sm:h-11 md:h-12"
                priority
                unoptimized
              />
            </div>
            <p className="mt-5 font-mono text-xs font-medium uppercase tracking-wider text-cifra-teal motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-100 motion-safe:duration-600 motion-safe:fill-mode-both motion-safe:ease-out sm:mt-6">
              NOVO · Cifras e acordes com IA
            </p>
            <h1 className="mt-6 font-serif text-4xl font-normal leading-tight tracking-tight text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
              Do áudio à cifra. Do link ao palco.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out lg:text-lg">
              cifra.ai transforma faixas e capturas em cifras editáveis — com
              detecção harmônica, revisão humana no loop e exportação para PDF,
              texto ou o seu fluxo de ensaio.
            </p>
            <form
              className="mx-auto mt-10 flex max-w-xl flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-5 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out sm:flex-row sm:items-stretch"
              action="#"
            >
              <label htmlFor="email-hero" className="sr-only">
                E-mail corporativo
              </label>
              <input
                id="email-hero"
                name="email"
                type="email"
                required
                placeholder="seu@email.com"
                className="h-12 flex-1 rounded-lg border border-cifra-border bg-cifra-surface px-4 text-sm text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/40 transition-[border-color,box-shadow] duration-200 focus:border-cifra-teal focus:ring-2"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-lg bg-cifra-teal px-6 text-sm font-semibold text-cifra-bg shadow-md shadow-cifra-teal/20 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-lg hover:shadow-cifra-teal/30 active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Pedir acesso antecipado
              </button>
            </form>
            <a
              href="mailto:vendas@example.com"
              className="mt-4 inline-block text-sm font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
            >
              Falar com vendas
            </a>
            <p className="mt-6 text-sm text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:delay-500 motion-safe:duration-500 motion-safe:fill-mode-both">
              Prefere acesso direto?{" "}
              <Link
                href="/cadastro"
                className="font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
              >
                Criar conta
              </Link>
              <span className="text-cifra-muted"> · </span>
              <Link
                href="/login"
                className="font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
              >
                Entrar
              </Link>
            </p>
          </div>
        </section>

        <section
          id="recursos"
          className="border-b border-cifra-border px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[1200px]">
            <p className="text-center font-mono text-xs font-medium uppercase tracking-wider text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-600 motion-safe:fill-mode-both">
              Por que cifra.ai
            </p>
            <h2 className="mt-3 text-center font-serif text-3xl text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-75 motion-safe:duration-700 motion-safe:fill-mode-both sm:text-4xl">
              Tudo o que você precisa para sair tocando
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-100 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-teal/25 hover:shadow-[0_16px_48px_-16px_rgba(15,210,193,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <Music2 className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  Origens em um só lugar
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  Importe de streaming, vídeo ou arquivo — menos troca de
                  ferramentas, mais tempo com o instrumento na mão.
                </p>
              </article>
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-teal/25 hover:shadow-[0_16px_48px_-16px_rgba(15,210,193,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <AudioWaveform className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  Harmonia estimada com IA
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  A IA sugere acordes e estrutura a partir do áudio; você revisa,
                  ajusta tonalidade e marca seções antes de exportar.
                </p>
              </article>
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-gold/35 hover:shadow-[0_16px_48px_-16px_rgba(240,180,41,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-gold/15 text-cifra-gold transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <Sparkles className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  Exportação e biblioteca
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  Salve versões na biblioteca, compartilhe com a banda e leve a
                  cifra para PDF, texto simples ou o seu fluxo de ensaio.
                </p>
              </article>
            </div>

            <div className="mt-16 grid gap-4 sm:grid-cols-3">
              {[
                { value: "50 MB", label: "Áudio por envio" },
                { value: "3+", label: "Fontes de importação" },
                { value: "PDF", label: "Exportação imediata" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`rounded-2xl border border-cifra-border bg-cifra-surface-2 px-8 py-10 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-600 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 hover:border-cifra-teal/20 hover:bg-cifra-surface motion-reduce:transition-none ${
                    i === 0
                      ? "motion-safe:delay-100"
                      : i === 1
                        ? "motion-safe:delay-200"
                        : "motion-safe:delay-300"
                  }`}
                >
                  <p className="font-serif text-4xl text-white sm:text-5xl">
                    {s.value}
                  </p>
                  <p className="mt-2 text-sm text-cifra-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-center font-serif text-3xl text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both sm:text-4xl">
              Escolha como levar o cifra.ai para o seu time
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:delay-100 motion-safe:duration-600 motion-safe:fill-mode-both">
              Planos flexíveis. Escale quando estiver pronto.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cifra-muted/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <p className="text-sm font-medium text-cifra-muted">Free</p>
                <p className="mt-2 font-serif text-4xl text-white">Grátis</p>
                <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-cifra-muted">
                  <li>Busca básica e favoritos</li>
                  <li>1 workspace</li>
                  <li>Suporte comunidade</li>
                </ul>
                <Link
                  href="/cadastro"
                  className="mt-8 block rounded-lg border border-cifra-border py-3 text-center text-sm font-semibold text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/30 hover:bg-cifra-surface-2 active:scale-[0.99] motion-reduce:active:scale-100"
                >
                  Começar grátis
                </Link>
              </div>
              <div className="flex flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cifra-teal/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <p className="text-sm font-medium text-cifra-muted">
                  Starter
                </p>
                <p className="mt-2 font-serif text-4xl text-white">
                  R$ 49
                  <span className="text-lg font-sans font-normal text-cifra-muted">
                    /mês
                  </span>
                </p>
                <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-cifra-muted">
                  <li>Tudo do Free</li>
                  <li>Relatórios agendados</li>
                  <li>Integrações principais</li>
                </ul>
                <SubscribePlanButton
                  plan="starter"
                  className="mt-8 w-full rounded-lg border border-cifra-teal/50 bg-cifra-teal/10 py-3 text-center text-sm font-semibold text-cifra-teal transition-all duration-200 ease-out hover:border-cifra-teal hover:bg-cifra-teal/20 active:scale-[0.99] motion-reduce:active:scale-100"
                >
                  Assinar
                </SubscribePlanButton>
              </div>
              <div className="relative flex flex-col rounded-2xl border-2 border-cifra-teal bg-cifra-surface-2 p-8 shadow-[0_0_40px_-10px_rgba(15,210,193,0.35)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_48px_-8px_rgba(15,210,193,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cifra-teal px-3 py-1 text-xs font-semibold text-cifra-bg shadow-sm shadow-cifra-teal/40">
                  Mais popular
                </span>
                <p className="text-sm font-medium text-cifra-muted">Pro</p>
                <p className="mt-2 font-serif text-4xl text-white">
                  R$ 149
                  <span className="text-lg font-sans font-normal text-cifra-muted">
                    /mês
                  </span>
                </p>
                <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-cifra-muted">
                  <li>API e webhooks</li>
                  <li>SSO (SAML / OIDC)</li>
                  <li>Suporte prioritário</li>
                </ul>
                <SubscribePlanButton
                  plan="pro"
                  className="mt-8 w-full rounded-lg bg-cifra-teal py-3 text-center text-sm font-semibold text-cifra-bg shadow-md shadow-cifra-teal/25 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-lg hover:shadow-cifra-teal/35 active:scale-[0.99] motion-reduce:active:scale-100"
                >
                  Trial 14 dias
                </SubscribePlanButton>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="border-t border-cifra-border bg-cifra-surface/50 px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[720px]">
            <h2 className="text-center font-serif text-3xl text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-600 motion-safe:fill-mode-both sm:text-4xl">
              Respostas rápidas
            </h2>
            <div className="mt-10 space-y-3">
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Integra com meu stack atual?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  Sim. O front recomendado combina Next.js com Tailwind e
                  componentes no estilo shadcn/ui; você pode montar telas no v0
                  ou reutilizar tokens do seu design system.
                </p>
              </details>
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Posso testar antes de comprar?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  O plano Pro inclui trial de 14 dias com acesso à API e suporte
                  para validar fluxos com o seu time antes de assinar.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section
          id="demo"
          className="border-t border-cifra-border bg-cifra-teal px-6 py-16 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-[960px] text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out">
            <h2 className="font-serif text-3xl text-cifra-bg sm:text-4xl">
              Pronto para gerar sua próxima cifra?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-cifra-bg/80 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:delay-150 motion-safe:duration-600 motion-safe:fill-mode-both">
              Agende uma demo ou leve o resumo comercial para estúdio, escola ou
              produto.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:demo@example.com"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg bg-cifra-bg px-6 text-sm font-semibold text-cifra-teal shadow-md shadow-cifra-bg/20 transition-all duration-200 ease-out hover:opacity-95 hover:shadow-lg active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Agendar demo
              </a>
              <a
                href="#"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg border-2 border-cifra-bg px-6 text-sm font-semibold text-cifra-bg transition-all duration-200 ease-out hover:bg-cifra-bg/15 hover:shadow-[0_0_24px_-4px_rgba(8,8,16,0.35)] active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Baixar one-pager
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex w-full justify-center border-t border-cifra-border">
        <div className="flex w-full min-w-0 max-w-[1200px] flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row lg:px-8">
          <div className="flex min-w-0 shrink items-center justify-center sm:justify-start sm:self-start">
            <ArtemisFooterBrand size="md" />
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-center gap-6 text-sm sm:justify-end">
            <Link
              href="/login"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-teal"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-teal"
            >
              Cadastro
            </Link>
            <a
              href="#"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-text"
            >
              Status
            </a>
            <a
              href="#"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-text"
            >
              Documentação
            </a>
            <a
              href="mailto:comercial@example.com"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-text"
            >
              Contato comercial
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
