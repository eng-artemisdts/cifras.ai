import Image from "next/image";
import Link from "next/link";
import { AudioWaveform, Menu, Music2, Sparkles, Users, X } from "lucide-react";

import type { Auth0UserMenuUser } from "@/components/auth/auth0-user-menu";
import { Auth0UserMenu } from "@/components/auth/auth0-user-menu";
import LightRays from "@/components/LightRays";
import { SubscribePlanButton } from "@/components/billing/subscribe-plan-button";
import {
  LandingGuestNav,
  LandingHeroActions,
  LandingPlanFreeSignupLink,
} from "@/components/landing/landing-ctas";
import { LandingHeroDemo } from "@/components/landing/landing-hero-demo";
import { ArtemisFooterBrand } from "@/components/layout/artemis-footer-brand";

const navLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#comunidade", label: "Comunidade" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export type LandingPageProps = {
  /** Quando definido, o header mostra avatar + menu em vez de Entrar / cadastro. */
  user?: Auth0UserMenuUser | null;
};

export function LandingPage({ user = null }: LandingPageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-cifra-bg text-cifra-text">
      <header className="sticky top-0 z-50 border-b border-cifra-border bg-cifra-bg/80 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500 motion-safe:fill-mode-both">
        <div className="mx-auto flex h-[72px] w-full min-w-0 max-w-[1200px] items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:justify-normal lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 max-w-[calc(100%-3rem)] items-center gap-2 transition-opacity duration-200 hover:opacity-90 motion-reduce:transition-none sm:max-w-none sm:gap-2.5"
          >

            <Image
              src="/logo.svg"
              alt="cifra.ai"
              width={228}
              height={60}
              className="h-5 w-auto max-w-full shrink object-contain object-left sm:h-6"
              style={{ width: "auto" }}
              priority
              unoptimized
            />
            <span className="inline-flex h-5 shrink-0 items-center self-center rounded-md border border-cifra-teal/45 bg-cifra-teal/12 px-1.5 font-mono text-[8px] font-bold leading-none tracking-widest text-cifra-teal sm:px-2 sm:text-[9px]">
              BETA
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center justify-center gap-10 md:flex">
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

          {user ? (
            <div className="flex shrink-0 items-center justify-end gap-2 md:justify-self-end">
              <Auth0UserMenu user={user} />
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
                </div>
              </details>
            </div>
          ) : (
            <LandingGuestNav navLinks={navLinks} />
          )}
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
          <div className="relative z-10 mx-auto max-w-[880px] text-center">
            <div className="flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out">
              <Image
                src="/logo.svg"
                alt="cifra.ai"
                width={828}
                height={220}
                className="h-10 w-auto max-w-[min(100%,240px)] shrink-0 object-contain sm:h-11 md:h-12"
                style={{ width: "auto" }}
                priority
                unoptimized
              />
            </div>
            <p className="mt-5 font-mono text-xs font-medium uppercase tracking-wider text-cifra-teal motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-100 motion-safe:duration-600 motion-safe:fill-mode-both motion-safe:ease-out sm:mt-6">
              Comunidade · Cifras e acordes com IA
            </p>
            <h1 className="mt-6 font-serif text-4xl font-normal leading-tight tracking-tight text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
              A sua cifra, gerada com o melhor da IA — para todos tocarem.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out lg:text-lg">
              Junte-se a uma comunidade de músicos que transformam faixas, links e
              gravações em cifras editáveis. A IA sugere acordes e letra; você revisa,
              partilha com a banda e leva tudo para o palco.
            </p>
            <LandingHeroDemo className="mt-10 max-w-[720px]" />
            <LandingHeroActions />
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
              IA poderosa, feita para quem faz música
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-100 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-teal/25 hover:shadow-[0_16px_48px_-16px_rgba(15,210,193,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <Music2 className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  De qualquer origem
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  Spotify, YouTube, TikTok, Instagram ou um ficheiro de áudio — cole o
                  link ou envie a gravação e deixe a IA fazer o trabalho pesado.
                </p>
              </article>
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-200 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-teal/25 hover:shadow-[0_16px_48px_-16px_rgba(15,210,193,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <AudioWaveform className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  Acordes e letra com IA
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  Detecção harmónica avançada, letra alinhada ao áudio e editor
                  intuitivo para ajustar tonalidade, capo e secções antes de tocar.
                </p>
              </article>
              <article className="group rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cifra-gold/35 hover:shadow-[0_16px_48px_-16px_rgba(240,180,41,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-gold/15 text-cifra-gold transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100">
                  <Sparkles className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  Biblioteca e exportação
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-cifra-muted">
                  Guarde versões na sua biblioteca, partilhe com colegas de banda e
                  exporte para PDF ou texto — pronto para ensaio ou palco.
                </p>
              </article>
            </div>

            <div className="mt-16 grid gap-4 sm:grid-cols-3">
              {[
                { value: "50 MB", label: "Áudio por envio" },
                { value: "4+", label: "Fontes de importação" },
                { value: "PDF", label: "Exportação imediata" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`rounded-2xl border border-cifra-border bg-cifra-surface-2 px-8 py-10 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-600 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 hover:border-cifra-teal/20 hover:bg-cifra-surface motion-reduce:transition-none ${i === 0
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

        <section
          id="comunidade"
          className="border-b border-cifra-border bg-cifra-surface/30 px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[960px] text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-cifra-teal/15 text-cifra-teal">
              <Users className="size-7" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="mt-6 font-serif text-3xl text-white sm:text-4xl">
              Uma comunidade para quem vive de música
            </h2>
            <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-cifra-muted">
              Cantores, guitarristas, professores e bandas usam o cifra.ai para gerar
              cifras mais rápido, colaborar em versões personalizadas e descobrir
              repertório na biblioteca. Não precisa ser expert em teoria — a IA
              acelera o caminho do ouvido à cifra pronta.
            </p>
            <div className="mt-12 grid gap-6 text-left sm:grid-cols-3">
              {[
                {
                  title: "Para iniciantes",
                  body: "Importe uma música que adora e receba acordes sugeridos em minutos.",
                },
                {
                  title: "Para bandas",
                  body: "Crie variações com capo, tonalidade e versões privadas para o seu set.",
                },
                {
                  title: "Para professores",
                  body: "Prepare material de aula com cifras editáveis e exportação em PDF.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-cifra-border bg-cifra-surface p-6"
                >
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cifra-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="px-6 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-center font-serif text-3xl text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both sm:text-4xl">
              Planos para cada etapa da sua jornada musical
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:delay-100 motion-safe:duration-600 motion-safe:fill-mode-both">
              Comece grátis na comunidade. Evolua quando precisar de mais importações e recursos.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cifra-muted/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <p className="text-sm font-medium text-cifra-muted">Grátis</p>
                <p className="mt-2 font-serif text-4xl text-white">R$ 0</p>
                <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-cifra-muted">
                  <li>Explorar e guardar favoritos</li>
                  <li>Biblioteca pessoal</li>
                  <li>Importação básica de áudio</li>
                  <li>Suporte da comunidade</li>
                </ul>
                <LandingPlanFreeSignupLink className="mt-8 block rounded-lg border border-cifra-border py-3 text-center text-sm font-semibold text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/30 hover:bg-cifra-surface-2 active:scale-[0.99] motion-reduce:active:scale-100">
                  Entrar na comunidade
                </LandingPlanFreeSignupLink>
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
                  <li>Tudo do plano Grátis</li>
                  <li>Mais importações por mês</li>
                  <li>Spotify e YouTube</li>
                  <li>Exportação em PDF</li>
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
                  <li>Tudo do Starter</li>
                  <li>TikTok e Instagram Reels</li>
                  <li>Detecção de acordes avançada</li>
                  <li>Variações ilimitadas e suporte prioritário</li>
                </ul>
                <SubscribePlanButton
                  plan="pro"
                  className="mt-8 w-full rounded-lg bg-cifra-teal py-3 text-center text-sm font-semibold text-cifra-bg shadow-md shadow-cifra-teal/25 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-lg hover:shadow-cifra-teal/35 active:scale-[0.99] motion-reduce:active:scale-100"
                >
                  Experimentar 14 dias grátis
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
              Perguntas frequentes
            </h2>
            <div className="mt-10 space-y-3">
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Como a IA gera a minha cifra?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  Envie um link ou ficheiro de áudio. A plataforma analisa a gravação,
                  reconhece a música quando possível e sugere acordes, secções e letra.
                  Depois pode editar tudo no editor antes de guardar ou exportar.
                </p>
              </details>
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Preciso saber teoria musical?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  Não. A IA propõe os acordes a partir do áudio; você ouve, ajusta o
                  que fizer sentido e aprende no processo. Músicos experientes também
                  ganham tempo ao ter um rascunho sólido para refinar.
                </p>
              </details>
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Posso partilhar cifras com a minha banda?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  Sim. Guarde versões na biblioteca, crie variações com capo ou
                  tonalidade diferentes e exporte em PDF para enviar aos colegas de
                  banda ou alunos.
                </p>
              </details>
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 transition-colors duration-200 open:pb-5 hover:border-cifra-teal/25">
                <summary className="cursor-pointer list-none text-left font-medium text-white transition-colors duration-200 hover:text-cifra-teal [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    Posso experimentar antes de assinar?
                    <span className="text-cifra-muted transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-cifra-muted">
                  O plano Grátis permite explorar a plataforma e gerar cifras com
                  limites generosos. O plano Pro inclui 14 dias de teste para
                  desbloquear importações avançadas e detecção mais precisa.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section
          id="comecar"
          className="border-t border-cifra-border bg-cifra-teal px-6 py-16 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-[960px] text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out">
            <h2 className="font-serif text-3xl text-cifra-bg sm:text-4xl">
              Pronto para gerar a sua próxima cifra?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-cifra-bg/80 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:delay-150 motion-safe:duration-600 motion-safe:fill-mode-both">
              Junte-se à comunidade cifra.ai — grátis para começar, sem cartão de
              crédito.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/cadastro"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg bg-cifra-bg px-6 text-sm font-semibold text-cifra-teal shadow-md shadow-cifra-bg/20 transition-all duration-200 ease-out hover:opacity-95 hover:shadow-lg active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/explorar"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg border-2 border-cifra-bg px-6 text-sm font-semibold text-cifra-bg transition-all duration-200 ease-out hover:bg-cifra-bg/15 hover:shadow-[0_0_24px_-4px_rgba(8,8,16,0.35)] active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Explorar cifras
              </Link>
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
            <Link
              href="/explorar"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-text"
            >
              Explorar
            </Link>
            <a
              href="mailto:ola@cifra.ai"
              className="text-cifra-muted transition-colors duration-200 ease-out hover:text-cifra-text"
            >
              Fale connosco
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
