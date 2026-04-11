const AUTH0_LOGIN = "/auth/login";

/** Rota gerida pelo SDK — termina a sessão na app e redireciona conforme Auth0. */
export const AUTH0_LOGOUT_PATH = "/auth/logout" as const;

export type Auth0LoginOptions = {
  /** Nome da connection no Auth0 (ex.: google-oauth2, apple). */
  connection?: string;
  screenHint?: "signup";
  loginHint?: string;
};

export function getAuth0ConnectionEnv() {
  return {
    google: process.env.AUTH0_CONNECTION_GOOGLE ?? "google-oauth2",
    apple: process.env.AUTH0_CONNECTION_APPLE ?? "apple",
    spotify: process.env.AUTH0_CONNECTION_SPOTIFY ?? "spotify",
  };
}

export function auth0LoginHref(opts?: Auth0LoginOptions): string {
  const params = new URLSearchParams();
  if (opts?.connection) params.set("connection", opts.connection);
  if (opts?.screenHint === "signup") params.set("screen_hint", "signup");
  if (opts?.loginHint) params.set("login_hint", opts.loginHint);
  const q = params.toString();
  return q ? `${AUTH0_LOGIN}?${q}` : AUTH0_LOGIN;
}
