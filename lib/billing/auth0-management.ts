import type { BillingPlan } from "@/lib/billing/plan-types";

type Auth0AppMetadataPatch = {
  plan?: "free" | "starter" | "pro";
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
};

type Auth0UserDocument = {
  app_metadata?: Record<string, unknown>;
};

/** Leitura direta do `app_metadata` (atualizado pelo webhook Stripe). */
export type Auth0BillingSnapshot = {
  plan?: BillingPlan;
  stripe_customer_id?: string;
  subscription_status?: string | null;
};

let cachedToken: { value: string; exp: number } | null = null;

function auth0Domain(): string {
  const d = process.env.AUTH0_DOMAIN?.trim();
  if (!d) throw new Error("AUTH0_DOMAIN não definido.");
  return d;
}

function isMgmtConfigured(): boolean {
  return Boolean(
    process.env.AUTH0_MANAGEMENT_CLIENT_ID?.trim() &&
      process.env.AUTH0_MANAGEMENT_CLIENT_SECRET?.trim(),
  );
}

async function getManagementToken(): Promise<string> {
  if (!isMgmtConfigured()) {
    throw new Error(
      "Management API não configurada (AUTH0_MANAGEMENT_CLIENT_ID / AUTH0_MANAGEMENT_CLIENT_SECRET).",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) {
    return cachedToken.value;
  }
  const domain = auth0Domain();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID!.trim(),
    client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET!.trim(),
    audience: `https://${domain}/api/v2/`,
  });
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Auth0 M2M token falhou (${res.status}): ${t}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = typeof json.expires_in === "number" ? json.expires_in : 120;
  cachedToken = { value: json.access_token, exp: now + ttl };
  return json.access_token;
}

async function getAuth0UserDocument(auth0UserId: string): Promise<Auth0UserDocument> {
  const domain = auth0Domain();
  const token = await getManagementToken();
  const existingRes = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!existingRes.ok) {
    const t = await existingRes.text();
    throw new Error(`Auth0 get user falhou (${existingRes.status}): ${t}`);
  }
  return (await existingRes.json()) as Auth0UserDocument;
}

async function patchAuth0UserAppMetadataRecord(
  auth0UserId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!isMgmtConfigured()) return;
  const domain = auth0Domain();
  const token = await getManagementToken();
  const existing = await getAuth0UserDocument(auth0UserId);
  const nextMeta = { ...(existing.app_metadata ?? {}), ...patch };
  const patchRes = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ app_metadata: nextMeta }),
    },
  );
  if (!patchRes.ok) {
    const t = await patchRes.text();
    throw new Error(`Auth0 patch user falhou (${patchRes.status}): ${t}`);
  }
}

/**
 * Atualiza `app_metadata` do utilizador (sincronizado pelo webhook Stripe).
 * Requer aplicação M2M com `update:users` na Management API.
 */
export async function patchAuth0UserAppMetadata(
  auth0UserId: string,
  patch: Auth0AppMetadataPatch,
): Promise<void> {
  await patchAuth0UserAppMetadataRecord(auth0UserId, patch);
}

export function isAuth0ManagementConfigured(): boolean {
  return isMgmtConfigured();
}

export async function fetchAuth0UserAppMetadata(
  auth0UserId: string,
): Promise<Record<string, unknown> | null> {
  if (!isMgmtConfigured()) return null;
  try {
    const user = await getAuth0UserDocument(auth0UserId);
    return user.app_metadata ?? {};
  } catch {
    return null;
  }
}

export async function patchAuth0UserAppMetadataGeneric(
  auth0UserId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await patchAuth0UserAppMetadataRecord(auth0UserId, patch);
}

/**
 * Obtém plano e Stripe customer a partir do utilizador na Management API.
 * Não depende do JWT da sessão (útil logo após o Checkout).
 * Requer `read:users` na app M2M.
 */
export async function fetchAuth0UserBillingSnapshot(
  auth0UserId: string,
): Promise<Auth0BillingSnapshot | null> {
  if (!isMgmtConfigured()) return null;
  try {
    const domain = auth0Domain();
    if (!domain) return null;
    const u = await getAuth0UserDocument(auth0UserId);
    const meta = u.app_metadata ?? {};
    let plan: BillingPlan | undefined;
    const rawPlan = meta.plan;
    if (rawPlan === "starter" || rawPlan === "pro" || rawPlan === "free") {
      plan = rawPlan;
    }
    const stripe_customer_id =
      typeof meta.stripe_customer_id === "string" && meta.stripe_customer_id.length > 0
        ? meta.stripe_customer_id
        : undefined;
    const subscription_status =
      typeof meta.subscription_status === "string" ? meta.subscription_status : null;
    return { plan, stripe_customer_id, subscription_status };
  } catch {
    return null;
  }
}
