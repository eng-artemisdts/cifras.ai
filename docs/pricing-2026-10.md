# Pricing cifra.ai — outubro 2026

Base: documento "Custos por música — Cifra.ai" (custo variável de **R$ 1,76 por música nova de 4 min**, 94% Music.ai). Câmbio R$ 5,20/US$.

## Recomendação

```
Modelo recomendado: Freemium + cota de uso (tiers com créditos de "música nova")
Métrica de valor:   música nova processada por IA. Abrir cifras do catálogo é livre em todos os planos.
```

| Tier | Preço | Cota | Público | Posicionamento |
|---|---|---|---|---|
| Grátis | R$ 0 | 2 músicas **no total** (vitalício) | Quem quer testar a IA | Faz o papel do trial. Custo máximo de R$ 3,53 por usuário, uma vez |
| Starter | **R$ 29,90/mês** (antes R$ 49) | 12 músicas a cada 30 dias | Músico que tira 2–3 músicas por semana | Abaixo do Chordify mensal (~US$ 8–9 ≈ R$ 42–47) |
| Pro | **R$ 79,90/mês** (antes R$ 149) | 35 músicas a cada 30 dias, TikTok e Reels | Professores, bandas, repertório de igreja | "Mais popular"; âncora de valor |

O trial de 14 dias do Pro foi removido. Ele liberava até 35 músicas sem receita (~R$ 62 de custo de IA por trial).

### Margem bruta

Desconta Stripe (3,99% + R$ 0,39 + 0,7% Billing) e o custo de IA. Não desconta infraestrutura fixa (R$ 195–625/mês).

| Plano | Custo de IA com 100% da cota | Margem com 100% de uso | Margem com 50% de uso |
|---|---|---|---|
| Starter R$ 29,90 | R$ 21,15 | 23% | 59% |
| Pro R$ 79,90 | R$ 61,70 | 18% | 56% |

Os dois planos ficam positivos mesmo com a cota inteira usada. Os preços antigos (R$ 49 e R$ 149) tinham margem maior, mas estavam acima da concorrência e com cotas semanais que, usadas por inteiro, quase anulavam a margem do Starter (16%).

### Concorrência (referência)

| Produto | Preço | Fonte |
|---|---|---|
| Chordify Premium | ~US$ 8–9/mês; US$ 54/ano | [App Store / AppPricingLab](https://apppricinglab.com/app/apple/1073624757) |
| Moises Premium / Pro | US$ 5,99/mês / US$ 29,99/mês (loja dos EUA, mar. 2026) | [AppPricingLab](https://apppricinglab.com/iap/apple/1515796612) |
| Cifra Club PRO | não encontrado | — |

## Premissas a validar antes de escalar

- **Uso médio de 50% da cota** → medir `used/limit` por plano em `ingest_jobs` após 30 dias.
- **Faixa média de 4 min** → gravar a duração do áudio em cada job.
- **Free vitalício converte melhor que 3 por semana** → comparar a conversão Free→pago das coortes antes e depois da mudança.
- **Disposição a pagar R$ 29,90 / R$ 79,90** → teste A/B do card Starter (R$ 24,90 vs R$ 29,90) ou entrevistas com 10 assinantes atuais.

## Riscos

- **Assinantes antigos perdem cota.** Starter caía de ~22 para 12 músicas/mês e Pro de ~43 para 35, ainda que paguem menos. → Migrar para o preço novo e avisar por e-mail antes (passo 7).
- **Usuários Grátis que já importaram 2 ou mais músicas ficam bloqueados na hora.** Ex-assinantes que voltaram ao Grátis também, porque a contagem é vitalícia. → Aceitar ou dar um crédito único de boas-vindas a quem já é usuário.
- **Power users no Pro com faixas longas** (10 min = R$ 4,37). → Limitar a duração por plano (próxima fase).
- **Preço exibido e Price na Stripe divergirem.** O app mostra o que está em `lib/billing/plan-catalog.ts`; a Stripe cobra o Price. → Sempre alterar os dois juntos (este passo a passo).

## O que mudou no código

| Onde | Mudança |
|---|---|
| `schubert-api/src/ingest/import-quota.constants.ts` | `IMPORT_QUOTA_RULES`: Grátis 3 vitalício; Starter 12 e Pro 35 em 30 dias |
| `schubert-api/src/ingest/import-quota.service.ts` | Cota vitalícia (sem janela, sem "próximo slot") e janela de 30 dias; resposta ganha `window` |
| `schubert-api/src/ingest-jobs/ingest-jobs.service.ts` | `countImports` / `findOldestImport` com janela opcional |
| `schubert-api/src/ingest/import-quota.service.spec.ts` | Testes das regras (4 casos) |
| `cifra.ai-web/lib/billing/plan-catalog.ts` | **Fonte única dos preços e textos dos planos** |
| `cifra.ai-web/components/landing-page.tsx`, `app/conta/assinatura/page.tsx` | Cards e botões lêem o catálogo; textos do trial removidos |
| `cifra.ai-web/components/library/import-quota-banner.tsx` e painéis de importação | "2 músicas no total" no Grátis; "30 dias" nos pagos |
| `cifra.ai-web/app/api/billing/checkout/route.ts` | Sem `trial_period_days` |
| `cifra.ai-web/lib/billing/stripe-server.ts`, `subscription-sync.ts` | `STRIPE_PRICE_*` aceita lista `novo,antigo`, para assinantes do preço antigo não virarem Grátis |

## Passo a passo na Stripe

Faça tudo primeiro em **modo de teste** (botão "Modo de teste" no topo do Dashboard), valide, e repita em produção.

1. **Criar o novo preço do Starter.** Dashboard → **Catálogo de produtos** → produto **Starter** → **Adicionar outro preço**. Valor `29,90`, moeda **BRL**, **Recorrente**, período **Mensal**. Em "Lookup key" (opcional) use `starter_monthly_2026_10`. Salve.
   - Preços na Stripe não podem ter o valor editado. Sempre se cria um preço novo.
2. **Criar o novo preço do Pro.** Mesmo caminho no produto **Pro**: `79,90`, BRL, recorrente mensal, lookup key `pro_monthly_2026_10`.
3. **Definir como padrão.** Em cada produto, no menu `⋯` do preço novo → **Definir como preço padrão**.
4. **Copiar os IDs.** Abra cada preço novo e copie o ID (`price_...`). Copie também o ID do preço antigo (o que está hoje em `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`).
5. **Atualizar a Vercel.** Projeto `cifra.ai-web` → **Settings → Environment Variables**. Edite, em Production e Preview:
   - `STRIPE_PRICE_STARTER` = `price_NOVO_STARTER,price_ANTIGO_STARTER`
   - `STRIPE_PRICE_PRO` = `price_NOVO_PRO,price_ANTIGO_PRO`

   O primeiro ID é usado no checkout. Os seguintes só servem para reconhecer quem ainda paga o preço antigo. Depois, faça um **Redeploy**: variáveis novas só valem após um deploy.
6. **Portal do cliente.** **Configurações → Billing → Portal do cliente → Produtos**. Inclua os preços novos de Starter e Pro e remova os antigos, para que trocas de plano usem o preço novo.
7. **Migrar assinantes atuais** (recomendado, porque o preço caiu). Para cada um em **Assinaturas**: abra a assinatura → **Atualizar assinatura** → troque o preço pelo novo → em rateio escolha **Não ratear** para o valor novo valer a partir da próxima fatura → **Atualizar**. Avise antes por e-mail: o valor cai, mas a cota passa a ser 12 (Starter) ou 35 (Pro) músicas a cada 30 dias.
8. **Trials.** Assinaturas em `trialing` continuam até o fim do trial. Confira se algum **Payment Link** ou **cupom** ainda oferece trial e desative.
9. **Validar em teste.**
   - Assine o Starter em `/conta/assinatura` com o cartão `4242 4242 4242 4242`.
   - Em **Desenvolvedores → Webhooks**, o evento `customer.subscription.created` deve aparecer com resposta 200.
   - No Auth0, o `app_metadata.plan` do usuário deve ficar `starter`.
   - Em `/biblioteca`, o banner deve mostrar "0/12 nos últimos 30 dias".
   - Com um usuário Grátis, a 3ª importação deve ser bloqueada com "Já usou as 2 músicas grátis".
10. **Limpar depois da migração.** Quando nenhum assinante estiver no preço antigo (filtre **Assinaturas** pelo preço), arquive o preço antigo (`⋯` → **Arquivar preço**) e remova o ID antigo das variáveis da Vercel.

### Ordem de deploy

1. `schubert-api` (`fly deploy`). Aplica as cotas novas. O front atual continua funcionando, porque só ganha o campo `window`.
2. Stripe: passos 1 a 6.
3. `cifra.ai-web`: deploy com os textos novos e as variáveis do passo 5.
4. Stripe: passos 7 a 10.

## Próxima fase

- **Plano anual**: R$ 299/ano (Starter) e R$ 799/ano (Pro), ou seja, 2 meses grátis. Exige um preço anual por produto e um seletor mensal/anual no checkout.
- **Música avulsa**: R$ 4,90 por música extra (margem ~51%). Exige checkout `mode: "payment"` e créditos no Schubert.
- **Não descontar da cota** quando a música já está no catálogo ou no cache (hoje desconta).
- **Limite de duração** por plano: 7 min no Grátis e Starter, 10 min no Pro.
