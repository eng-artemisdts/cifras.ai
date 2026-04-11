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
    client = new Auth0Client({
      signInReturnToPath: "/biblioteca",
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
