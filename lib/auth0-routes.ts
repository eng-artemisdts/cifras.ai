const AUTH0_LOGIN = "/auth/login";

/** Página de entrada da app (não Universal Login). */
export const APP_LOGIN_PATH = "/login" as const;

/** Rota gerida pelo SDK — termina a sessão na app e redireciona conforme Auth0. */
export const AUTH0_LOGOUT_PATH = "/auth/logout" as const;

/**
 * `returnTo` aceite pelo `/auth/login` (Auth0): só path relativo na mesma app.
 * Evita open-redirect (`//evil.com`).
 */
export function sanitizeAuthReturnTo(raw: string | undefined | null): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return undefined;
  if (t.startsWith("/auth")) return undefined;
  return t;
}

export type Auth0LoginOptions = {
  /** Nome da connection no Auth0 (ex.: google-oauth2, apple). */
  connection?: string;
  screenHint?: "signup";
  loginHint?: string;
  /** Pass-through para o SDK (`/auth/login?returnTo=...`). */
  returnTo?: string;
};

export function getAuth0ConnectionEnv() {
  return {
    google: process.env.AUTH0_CONNECTION_GOOGLE ?? "google-oauth2",
    apple: process.env.AUTH0_CONNECTION_APPLE ?? "apple",
  };
}

export function auth0LoginHref(opts?: Auth0LoginOptions): string {
  const params = new URLSearchParams();
  if (opts?.connection) params.set("connection", opts.connection);
  if (opts?.screenHint === "signup") params.set("screen_hint", "signup");
  if (opts?.loginHint) params.set("login_hint", opts.loginHint);
  const safeReturn = sanitizeAuthReturnTo(opts?.returnTo);
  if (safeReturn) params.set("returnTo", safeReturn);
  const q = params.toString();
  return q ? `${AUTH0_LOGIN}?${q}` : AUTH0_LOGIN;
}

/**
 * Redirecionamento para a página de entrada da app (`/login`), não para a Universal Login (`/auth/login`).
 * Use em páginas protegidas quando o utilizador deve ver primeiro a nossa UI e só depois o Auth0.
 */
export function appLoginHref(returnTo?: string): string {
  const safe = sanitizeAuthReturnTo(returnTo);
  if (!safe) return APP_LOGIN_PATH;
  return `${APP_LOGIN_PATH}?${new URLSearchParams({ returnTo: safe }).toString()}`;
}
