# cifra.ai-web

Front-end Next.js 16 da cifra.ai (Auth0, Schubert/Beethoven BFF, Spotify, Stripe).

## Desenvolvimento local

```bash
cp .env.example .env.local
# preencher variáveis (ver .env.example)
pnpm install
pnpm dev
```

Abrir [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Build de produção

```bash
NODE_ENV=production pnpm run build
pnpm start
```

## Deploy na Vercel

Guia completo: **[docs/DEPLOY-VERCEL.md](./docs/DEPLOY-VERCEL.md)**.

Resumo: importar este repositório na Vercel, Node 22, `pnpm install --frozen-lockfile` + `pnpm run build` (já em `vercel.json`), configurar variáveis de `.env.example` em Production, e actualizar callbacks Auth0/Spotify/Stripe para o domínio de produção.
