import { AccessTokenError, AccessTokenErrorCode } from "@auth0/nextjs-auth0/errors";
import { redirect } from "next/navigation";

import { isAccessTokenLikelyJwt } from "@/lib/access-token-shape";
import { getAuth0, getAuth0SessionCached } from "@/lib/auth0";
import { AUTH0_LOGOUT_PATH } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";

import type { SchubertTrackJson } from "./schubert-api";

function schubertApiBase(): string {
  return (process.env.SCHUBERT_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

function schubertAudience(): string | null {
  const a = process.env.SCHUBERT_AUTH0_AUDIENCE?.trim() || process.env.AUTH0_AUDIENCE?.trim();
  return a || null;
}

/**
 * Obtém o JSON da faixa no servidor (RSC) com JWT da mesma audience que o proxy `/api/schubert`.
 */
export async function fetchSchubertTrackByKey(trackKey: string): Promise<SchubertTrackJson | null> {
  if (!isAuth0Configured()) return null;
  const session = await getAuth0SessionCached();
  if (!session?.user) return null;

  const audience = schubertAudience();
  if (!audience) return null;

  let token: string;
  try {
    ({ token } = await getAuth0().getAccessToken({ audience }));
  } catch (e) {
    if (
      e instanceof AccessTokenError &&
      e.code === AccessTokenErrorCode.MISSING_REFRESH_TOKEN
    ) {
      redirect(AUTH0_LOGOUT_PATH);
    }
    throw e;
  }
  if (!isAccessTokenLikelyJwt(token)) return null;

  const key = trackKey.trim();
  if (!key) return null;



  const url = `${schubertApiBase()}/tracks/by-key/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`schubert_track_fetch_failed:${res.status}`);
  }

  return (await res.json()) as SchubertTrackJson;
}
