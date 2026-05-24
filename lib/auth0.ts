import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { cache } from "react";

import { isAuth0Configured } from "@/lib/auth0-env";

let client: Auth0Client | undefined;

export function getAuth0(): Auth0Client {
  if (!isAuth0Configured()) {
    throw new Error(
      "Auth0 não está configurado. Defina AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET e AUTH0_SECRET (ver .env.example).",
    );
  }
  if (!client) {
    const audience =
      process.env.SCHUBERT_AUTH0_AUDIENCE?.trim() ||
      process.env.AUTH0_AUDIENCE?.trim();
    /** Sem AUTH0_SCOPE no .env, usamos estes (incl. offline_access para refresh token). */
    const scope =
      process.env.AUTH0_SCOPE?.trim() ||
      "openid profile email offline_access";
    client = new Auth0Client({
      signInReturnToPath: "/explorar",
      ...(audience
        ? {
          authorizationParameters: {
            audience,
            scope,
          },
        }
        : {}),
    });
  }
  return client;
}

/** Sessão atual; devolve `null` se o Auth0 não estiver configurado ou não houver sessão. */
export async function getAuth0Session() {
  if (!isAuth0Configured()) return null;
  return getAuth0().getSession();
}

/** Uma leitura de sessão por pedido (layout + página partilham o mesmo resultado). */
export const getAuth0SessionCached = cache(getAuth0Session);
