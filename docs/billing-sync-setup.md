# Sincronização Stripe → Auth0 → App (billing)

Guia operacional para garantir que alterações de plano na Stripe se reflectem no cifra.ai (página Assinatura, permissões e Schubert API).

## Arquitectura (resumo)

```
Stripe (subscrição)
    │  webhooks + botão «Sincronizar com Stripe» (POST /api/billing/sync)
    ▼
Next.js  /api/billing/webhook  |  /api/billing/sync
    │  PATCH app_metadata (plan, stripe_customer_id, …)
    ▼
Auth0  app_metadata
    │  Post-Login Action → claims https://cifra.ai/plan e https://cifra.ai/permissions
    ▼
Sessão JWT  +  Management API (tempo real na página /conta/assinatura)
    ▼
Schubert API (headers com plano/permissões do app_metadata, não só JWT)
```

**Correcções já aplicadas no código:**

- `lib/billing/subscription-sync.ts` — lê `price` como string ou objecto expandido.
- `app/api/billing/webhook/route.ts` — `retrieve` com expand; evento `customer.subscription.created`; backfill de `auth0_sub` na Stripe.
- `lib/billing/stripe-auth0-reconcile.ts` — reconciliação Stripe ↔ Auth0 (pesquisa por `auth0_sub`, email ou customer id).
- `POST /api/billing/sync` + botão **«Sincronizar com Stripe»** em `/conta/assinatura` (**só `NODE_ENV=development`**).
- `lib/billing/resolve-billing-plan.ts` — permissões alinhadas ao `app_metadata` no proxy Schubert.
- `lib/billing/auth0-management.ts` — falha explícita se M2M não estiver configurada (em vez de ignorar silenciosamente).

---

## Recuperação rápida (só dev local)

> Disponível apenas com `next dev` (`NODE_ENV=development`). Em produção use webhooks Stripe.

Se o plano na Stripe está correcto mas o Auth0 não tem campos `plan` / `stripe_*`:

1. Abrir **`/conta/assinatura`**.
2. Clicar **«Sincronizar com Stripe»**.
3. A página actualiza (lê `app_metadata` via Management API).
4. Testar features; se a UI ainda bloquear, **logout + login** (JWT).

O sync procura o customer Stripe por: `app_metadata.stripe_customer_id` → metadata `auth0_sub` → email da conta.

---

## Fase 1 — Diagnóstico (5–10 min)

### 1.1 Verificar `app_metadata` no Auth0

O `app_metadata` **não aparece na lista de utilizadores**. Tem de abrir o perfil de **uma pessoa** (ex.: Gabriel Moura).

#### Passo a passo no Dashboard Auth0

1. **User Management** → **Users** (é onde está agora — lista com Name, User ID, Connection, …).
2. **Clique no nome ou no email** do utilizador (não no menu `⋯` à direita). Abre a página de detalhe desse user.
3. Na página do utilizador, procure uma destas secções (o Auth0 varia ligeiramente por tenant):

   **Opção A — Raw JSON (mais comum)**  
   - Role até ao fim da página ou abra o separador **Raw JSON** / **JSON**.  
   - Expanda o bloco JSON.  
   - Procure o objecto `"app_metadata": { ... }` (fica **abaixo** de `"user_metadata"`).

   **Opção B — Metadata na ficha Details**  
   - No separador **Details**, desça até **Metadata**.  
   - O Auth0 mostra muitas vezes só **`user_metadata`** editável na UI.  
   - Se **não** vir `app_metadata` aí, use sempre a **Opção A (Raw JSON)** — o billing do cifra.ai grava em `app_metadata`, que por vezes só é visível no JSON completo.

4. O que deve ver (exemplo após sync Stripe):

   ```json
   "app_metadata": {
     "plan": "pro",
     "stripe_customer_id": "cus_xxxxxxxx",
     "stripe_subscription_id": "sub_xxxxxxxx",
     "subscription_status": "active"
   }
   ```

5. **User ID** para a Stripe: na lista ou no topo do perfil, copie o valor **User ID** (ex.: `google-oauth2|1025…` ou `auth0|…`). Esse é o `auth0_sub` que deve ir na metadata do customer Stripe.

> **Não confundir:** `user_metadata` = preferências do utilizador; **`app_metadata`** = plano/billing (actualizado pelo webhook). Editar RBAC em **User Management → Roles** também **não** substitui o `app_metadata.plan`.

Campos esperados após sync correcto:

| Campo | Exemplo |
|-------|---------|
| `plan` | `"free"` \| `"starter"` \| `"pro"` |
| `stripe_customer_id` | `"cus_…"` |
| `stripe_subscription_id` | `"sub_…"` |
| `subscription_status` | `"active"`, `"trialing"`, `"canceled"`, … |

**Interpretação:**

| Situação | Próximo passo |
|----------|----------------|
| `plan` desactualizado vs Stripe | Fase 2 (Stripe + webhook) |
| `plan` correcto, features bloqueadas | Fase 3 (Action + relogin) |
| Campos vazios / sem `plan` | Fase 2 — webhook nunca actualizou |

### 1.2 Página `/conta/assinatura`

- Badge **«Estado em tempo real»** visível → Management API configurada; a página lê `app_metadata` directamente.
- Badge **ausente** → configurar M2M (Fase 2.3).

### 1.3 Teste rápido de sessão

1. Terminar sessão na app.
2. Entrar de novo.
3. Testar uma funcionalidade do plano (ex.: importação Pro).

Se o plano na Assinatura já estava certo e o resto só funcionou após relogin → JWT estava desactualizado (Fase 3). Ainda assim, confirme o webhook para não depender sempre de relogin.

---

## Fase 2 — Stripe → Auth0 (webhook)

### 2.1 Metadata `auth0_sub` na Stripe

O webhook **ignora** eventos se não encontrar o Auth0 user id.

1. Stripe → **Customers** → customer do utilizador → **Metadata**.
2. Adicionar (se em falta):

   ```
   auth0_sub = auth0|xxxxxxxxxxxx
   ```

   Copiar o valor exacto de Auth0 → User → **user_id**.

3. Stripe → **Subscriptions** → subscrição activa → **Metadata** → mesmo `auth0_sub`.

**Nota:** subscrições criadas pelo checkout da app (`POST /api/billing/checkout`) preenchem isto automaticamente. Alterações manuais no Dashboard Stripe muitas vezes deixam metadata vazio.

### 2.2 Webhook endpoint na Stripe

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint** (ou editar existente).
2. URL de produção:

   ```
   https://<seu-dominio>/api/billing/webhook
   ```

3. Eventos obrigatórios:

   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

4. Copiar **Signing secret** (`whsec_…`) para a variável de ambiente `STRIPE_WEBHOOK_SECRET`.

#### Desenvolvimento local (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Use o `whsec_…` que a CLI imprime em `STRIPE_WEBHOOK_SECRET` no `.env.local`.

### 2.3 Variáveis de ambiente (Next.js)

No ambiente onde corre `cifra.ai-web` (`.env.local`, Vercel, etc.):

```env
# Auth0 (sessão)
AUTH0_DOMAIN=seu-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=...

# Auth0 Management API (webhook + página Assinatura em tempo real)
AUTH0_MANAGEMENT_CLIENT_ID=...
AUTH0_MANAGEMENT_CLIENT_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

**Importante:** os `price_…` devem ser exactamente os prices usados nas subscrições na Stripe. Outro price → o sistema grava `plan: "free"`.

### 2.4 Aplicação M2M no Auth0

1. Auth0 → **Applications** → **Applications** → criar ou usar app **Machine to Machine**.
2. Autorizar a **Auth0 Management API**.
3. Scopes necessários:

   - `read:users`
   - `update:users`

4. Usar **Client ID** e **Client Secret** dessa app em `AUTH0_MANAGEMENT_CLIENT_ID` / `AUTH0_MANAGEMENT_CLIENT_SECRET`.

### 2.5 Validar entrega do webhook

1. Stripe → Webhooks → endpoint → **Event deliveries**.
2. Abrir o último `customer.subscription.updated`:
   - **200** → servidor processou (verificar `app_metadata` de novo).
   - **4xx/5xx** → ver logs do servidor (`[stripe webhook]`).
3. Se aparecer nos logs:

   ```
   [stripe webhook] auth0_sub em falta; ignorando sync da subscrição sub_...
   ```

   → corrigir metadata na Stripe (passo 2.1) e reenviar evento (**Resend** no Dashboard).

### 2.6 Forçar re-sync após correcções

Opções:

- Stripe → subscrição → alterar plano e voltar (dispara `customer.subscription.updated`).
- Stripe → Webhooks → evento → **Resend**.
- Stripe CLI: `stripe trigger customer.subscription.updated`

Confirmar de novo `app_metadata.plan` no Auth0.

---

## Fase 3 — Auth0 → JWT (Post-Login Action)

A app **não** usa permissões RBAC da API Auth0 (`permissions` no access token de API) para billing.

Usa claims customizados no namespace `https://cifra.ai/`:

| Claim | Uso |
|-------|-----|
| `https://cifra.ai/plan` | Plano na sessão |
| `https://cifra.ai/permissions` | Gates na UI e headers para Schubert |
| `https://cifra.ai/stripe_customer_id` | Portal de faturação |

### 3.1 Criar ou actualizar Post-Login Action

Auth0 → **Actions** → **Library** → **Build Custom** (ou editar existente).

Nome sugerido: `Inject Cifra billing claims`.

Código (deve espelhar `lib/billing/plan-permissions.ts`):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const NS = "https://cifra.ai/";

  const PLAN_PERMS = {
    free: ["library:basic"],
    starter: ["library:basic", "library:import", "reports:scheduled"],
    pro: [
      "library:basic",
      "library:import",
      "reports:scheduled",
      "api:access",
      "billing:sso",
      "support:priority",
    ],
  };

  const rawPlan = event.user.app_metadata?.plan;
  const billingPlan =
    rawPlan === "starter" || rawPlan === "pro" ? rawPlan : "free";
  const permissions = PLAN_PERMS[billingPlan];

  api.idToken.setCustomClaim(`${NS}plan`, billingPlan);
  api.idToken.setCustomClaim(`${NS}permissions`, permissions);

  if (event.authorization?.audience) {
    api.accessToken.setCustomClaim(`${NS}plan`, billingPlan);
    api.accessToken.setCustomClaim(`${NS}permissions`, permissions);
  }

  const stripeId = event.user.app_metadata?.stripe_customer_id;
  if (typeof stripeId === "string" && stripeId.length > 0) {
    api.idToken.setCustomClaim(`${NS}stripe_customer_id`, stripeId);
    if (event.authorization?.audience) {
      api.accessToken.setCustomClaim(`${NS}stripe_customer_id`, stripeId);
    }
  }
};
```

### 3.2 Ligar ao flow Login

1. **Actions** → **Flows** → **Login**.
2. Arrastar a Action para o flow (entre **Start** e **Complete**).
3. **Apply**.

### 3.3 API audience (Schubert)

A app pede access token com audience (`SCHUBERT_AUTH0_AUDIENCE` ou `AUTH0_AUDIENCE`). Confirme no Auth0:

- **Applications** → API da Schubert → **Identifier** = valor do env.
- A Action injecta claims no access token quando `event.authorization.audience` está presente (login com audience).

### 3.4 Actualizar sessão dos utilizadores

Após alterar `app_metadata` ou a Action:

1. **Logout** completo na app.
2. **Login** de novo.

Opcional se a sessão parecer presa: Auth0 → User → **Revoke refresh tokens**.

A página Assinatura pode mostrar o plano correcto **sem** relogin (Management API). Outras áreas (importações, API) dependem do JWT até novo login.

---

## Fase 4 — Checklist final

| # | Verificação | OK? |
|---|-------------|-----|
| 1 | `app_metadata.plan` = plano na Stripe | ☐ |
| 2 | Customer Stripe tem `metadata.auth0_sub` | ☐ |
| 3 | Webhook último evento HTTP 200 | ☐ |
| 4 | `STRIPE_PRICE_*` = prices da subscrição | ☐ |
| 5 | M2M com `read:users` + `update:users` | ☐ |
| 6 | Post-Login Action deployada no flow Login | ☐ |
| 7 | Logout + login após alterações | ☐ |
| 8 | `/conta/assinatura` mostra plano correcto | ☐ |
| 9 | Features do plano desbloqueadas | ☐ |

---

## Resolução de problemas

### Plano na Assinatura correcto, resto da app errado

- Causa: JWT desactualizado.
- Solução: logout + login (Fase 3.4).

### Plano sempre «Grátis» com subscrição activa na Stripe

- Price ID não coincide com `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`.
- Webhook falhou (ver entregas e logs).
- Antes da correcção de código: `customer.subscription.updated` podia mapear price em falta → `free` (corrigido em `subscription-sync.ts`).

### Webhook 200 mas Auth0 não muda

- Falta `auth0_sub` na metadata (ver logs `[stripe webhook] auth0_sub em falta`).
- M2M sem scope `update:users`.
- `AUTH0_DOMAIN` errado no servidor.

### Alterei permissões no Auth0 RBAC e não funcionou

- Esperado: a app ignora RBAC para billing.
- Corrigir `app_metadata.plan` (via Stripe/webhook) e claims via Action (Fase 3).

### Badge «Estado em tempo real» não aparece

- Configurar `AUTH0_MANAGEMENT_CLIENT_ID` e `AUTH0_MANAGEMENT_CLIENT_SECRET`.
- A página usa só claims da sessão (podem estar desactualizados).

---

## Referências no código

| Ficheiro | Responsabilidade |
|----------|------------------|
| `app/api/billing/webhook/route.ts` | Recebe eventos Stripe, actualiza Auth0 |
| `lib/billing/subscription-sync.ts` | Mapeia subscrição → plano |
| `lib/billing/auth0-management.ts` | PATCH/GET `app_metadata` |
| `lib/billing/plan-permissions.ts` | Matriz de permissões (espelhar na Action) |
| `lib/entitlements.ts` | Lê claims `https://cifra.ai/*` da sessão |
| `app/conta/assinatura/page.tsx` | UI do plano (Management API + fallback sessão) |
| `app/api/schubert/[...path]/route.ts` | Proxy com plano/permissões para Schubert API |

---

## Deploy

Depois de alterar código ou env:

1. Deploy `cifra.ai-web` com as novas variáveis.
2. Confirmar webhook Stripe aponta para o URL de produção correcto.
3. Testar com um utilizador: alterar plano na Stripe → verificar `app_metadata` → logout/login → validar features.
