import Image from "next/image";
import Link from "next/link";
import { AudioWaveform, Menu, Music2, Sparkles, X } from "lucide-react";

const navLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-cifra-bg text-cifra-text">
      <header className="sticky top-0 z-50 border-b border-cifra-border bg-cifra-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center">
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
                className="text-sm font-medium text-cifra-muted transition-colors hover:text-cifra-text"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 sm:flex">
            <a
              href="#demo"
              className="rounded-lg border border-cifra-border px-4 py-2 text-sm font-medium text-cifra-text transition-colors hover:border-cifra-muted"
            >
              Ver demo
            </a>
            <a
              href="#acesso"
              className="rounded-lg bg-cifra-teal px-4 py-2 text-sm font-semibold text-cifra-bg transition-colors hover:bg-cifra-teal-hover"
            >
              Começar agora
            </a>
          </div>

          <details className="group relative sm:hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden">
              <span className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-cifra-border text-cifra-text">
                <Menu className="size-5 group-open:hidden" />
                <X className="hidden size-5 group-open:block" />
              </span>
            </summary>
            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-cifra-border bg-cifra-surface-2 p-3 shadow-xl">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-3 py-2 text-sm text-cifra-muted hover:bg-cifra-surface hover:text-cifra-text"
                >
                  {l.label}
                </a>
              ))}
              <hr className="my-2 border-cifra-border" />
              <a
                href="#demo"
                className="block rounded-lg px-3 py-2 text-sm text-cifra-text hover:bg-cifra-surface"
              >
                Ver demo
              </a>
              <a
                href="#acesso"
                className="mt-1 block rounded-lg bg-cifra-teal px-3 py-2 text-center text-sm font-semibold text-cifra-bg"
              >
                Começar agora
              </a>
            </div>
          </details>
        </div>
      </header>

      <main className="flex-1">
        <section
          id="acesso"
          className="relative overflow-hidden border-b border-cifra-border px-6 pb-24 pt-16 lg:px-8 lg:pb-32 lg:pt-24"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -20%, var(--cifra-glow) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(28, 31, 62, 0.5) 0%, transparent 50%)",
            }}
          />
          <div className="relative mx-auto max-w-[720px] text-center">
            <div className="flex justify-center">
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
            <p className="mt-5 font-mono text-xs font-medium uppercase tracking-wider text-cifra-teal sm:mt-6">
              NOVO · Cifras e acordes com IA
            </p>
            <h1 className="mt-6 font-serif text-4xl font-normal leading-tight tracking-tight text-white sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
              Do áudio à cifra. Do link ao palco.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-cifra-muted lg:text-lg">
              cifra.ai transforma faixas e capturas em cifras editáveis — com
              detecção harmônica, revisão humana no loop e exportação para PDF,
              texto ou o seu fluxo de ensaio.
            </p>
            <form
              className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch"
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
                className="h-12 flex-1 rounded-lg border border-cifra-border bg-cifra-surface px-4 text-sm text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/40 focus:border-cifra-teal focus:ring-2"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-lg bg-cifra-teal px-6 text-sm font-semibold text-cifra-bg transition-colors hover:bg-cifra-teal-hover"
              >
                Pedir acesso antecipado
              </button>
            </form>
            <a
              href="mailto:vendas@example.com"
              className="mt-4 inline-block text-sm font-medium text-cifra-teal underline-offset-4 hover:underline"
            >
              Falar com vendas
            </a>
          </div>
        </section>

        <section
          id="recursos"
          className="border-b border-cifra-border px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[1200px]">
            <p className="text-center font-mono text-xs font-medium uppercase tracking-wider text-cifra-muted">
              Por que cifra.ai
            </p>
            <h2 className="mt-3 text-center font-serif text-3xl text-white sm:text-4xl">
              Tudo o que você precisa para sair tocando
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <article className="rounded-2xl border border-cifra-border bg-cifra-surface p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal">
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
              <article className="rounded-2xl border border-cifra-border bg-cifra-surface p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-teal/15 text-cifra-teal">
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
              <article className="rounded-2xl border border-cifra-border bg-cifra-surface p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-cifra-gold/15 text-cifra-gold">
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
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-cifra-border bg-cifra-surface-2 px-8 py-10 text-center"
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
            <h2 className="text-center font-serif text-3xl text-white sm:text-4xl">
              Escolha como levar o cifra.ai para o seu time
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-cifra-muted">
              Planos flexíveis. Escale quando estiver pronto.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-8">
                <p className="text-sm font-medium text-cifra-muted">Free</p>
                <p className="mt-2 font-serif text-4xl text-white">Grátis</p>
                <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-cifra-muted">
                  <li>Busca básica e favoritos</li>
                  <li>1 workspace</li>
                  <li>Suporte comunidade</li>
                </ul>
                <a
                  href="#acesso"
                  className="mt-8 block rounded-lg border border-cifra-border py-3 text-center text-sm font-semibold text-cifra-text transition-colors hover:bg-cifra-surface-2"
                >
                  Começar grátis
                </a>
              </div>
              <div className="flex flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-8">
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
                <a
                  href="#acesso"
                  className="mt-8 block rounded-lg border border-cifra-teal/50 bg-cifra-teal/10 py-3 text-center text-sm font-semibold text-cifra-teal transition-colors hover:bg-cifra-teal/20"
                >
                  Assinar
                </a>
              </div>
              <div className="relative flex flex-col rounded-2xl border-2 border-cifra-teal bg-cifra-surface-2 p-8 shadow-[0_0_40px_-10px_rgba(15,210,193,0.35)]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cifra-teal px-3 py-1 text-xs font-semibold text-cifra-bg">
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
                <a
                  href="#acesso"
                  className="mt-8 block rounded-lg bg-cifra-teal py-3 text-center text-sm font-semibold text-cifra-bg transition-colors hover:bg-cifra-teal-hover"
                >
                  Trial 14 dias
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="border-t border-cifra-border bg-cifra-surface/50 px-6 py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[720px]">
            <h2 className="text-center font-serif text-3xl text-white sm:text-4xl">
              Respostas rápidas
            </h2>
            <div className="mt-10 space-y-3">
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 open:pb-5">
                <summary className="cursor-pointer list-none text-left font-medium text-white [&::-webkit-details-marker]:hidden">
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
              <details className="group rounded-xl border border-cifra-border bg-cifra-surface-2 px-6 py-4 open:pb-5">
                <summary className="cursor-pointer list-none text-left font-medium text-white [&::-webkit-details-marker]:hidden">
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
          <div className="mx-auto max-w-[960px] text-center">
            <h2 className="font-serif text-3xl text-cifra-bg sm:text-4xl">
              Pronto para gerar sua próxima cifra?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-cifra-bg/80">
              Agende uma demo ou leve o resumo comercial para estúdio, escola ou
              produto.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:demo@example.com"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg bg-cifra-bg px-6 text-sm font-semibold text-cifra-teal transition-opacity hover:opacity-90"
              >
                Agendar demo
              </a>
              <a
                href="#"
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg border-2 border-cifra-bg px-6 text-sm font-semibold text-cifra-bg transition-colors hover:bg-cifra-bg/10"
              >
                Baixar one-pager
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-cifra-border px-6 py-10 lg:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-cifra-muted">
            cifra.ai · Artemis Digital Tech
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a href="#" className="text-cifra-muted hover:text-cifra-text">
              Status
            </a>
            <a href="#" className="text-cifra-muted hover:text-cifra-text">
              Documentação
            </a>
            <a
              href="mailto:comercial@example.com"
              className="text-cifra-muted hover:text-cifra-text"
            >
              Contato comercial
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
