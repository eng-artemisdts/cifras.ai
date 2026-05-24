import crypto from "node:crypto";

import {
  fetchAuth0UserAppMetadata,
  patchAuth0UserAppMetadataGeneric,
} from "@/lib/billing/auth0-management";

const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  /** Importação: listar playlists e faixas da conta. */
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export type SpotifyConnectionStatus = {
  connected: boolean;
  product: string | null;
  accountId: string | null;
  premium: boolean;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type SpotifyMe = {
  id?: string;
  product?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_not_configured`);
  return value;
}

export function spotifyClientId(): string {
  return requiredEnv("SPOTIFY_CLIENT_ID");
}

function spotifyClientSecret(): string {
  return requiredEnv("SPOTIFY_CLIENT_SECRET");
}

export function spotifyRedirectUri(): string {
  const explicit = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const appBase =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!appBase) throw new Error("APP_BASE_URL_or_NEXT_PUBLIC_SITE_URL_not_configured");
  return `${appBase.replace(/\/$/, "")}/api/spotify/callback`;
}

function spotifyEncryptionKey(): Buffer {
  const raw =
    process.env.SPOTIFY_TOKENS_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH0_SECRET?.trim() ||
    "";
  if (!raw) throw new Error("SPOTIFY_TOKENS_ENCRYPTION_KEY_not_configured");
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptText(text: string): string {
  const key = spotifyEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptText(payload: string): string {
  const key = spotifyEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("invalid_encrypted_payload");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function tokenRequest(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const basic = Buffer.from(`${spotifyClientId()}:${spotifyClientSecret()}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`spotify_token_exchange_failed:${res.status}:${text}`);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

export function spotifyAuthorizeUrl(state: string, redirectUri?: string): string {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", spotifyClientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri?.trim() || spotifyRedirectUri());
  url.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Força a tela de consentimento para renovar refresh token com scopes novos.
  url.searchParams.set("show_dialog", "true");
  return url.toString();
}

export function newOauthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function exchangeCodeForSpotifySession(params: { code: string; redirectUri?: string }) {
  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri?.trim() || spotifyRedirectUri(),
    }),
  );
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(`spotify_me_failed:${meRes.status}:${text}`);
  }
  const me = (await meRes.json()) as SpotifyMe;
  const product = typeof me.product === "string" ? me.product : "";
  const accountId = typeof me.id === "string" ? me.id : "";
  return {
    refreshToken: token.refresh_token ?? "",
    accountId,
    product,
    scope: token.scope ?? "",
  };
}

export async function saveSpotifySessionForUser(
  auth0UserId: string,
  session: { refreshToken: string; accountId: string; product: string; scope: string },
): Promise<void> {
  if (!session.refreshToken) throw new Error("spotify_missing_refresh_token");
  await patchAuth0UserAppMetadataGeneric(auth0UserId, {
    spotify_connected: true,
    spotify_account_id: session.accountId || null,
    spotify_product: session.product || null,
    spotify_scope: session.scope || null,
    spotify_refresh_token_enc: encryptText(session.refreshToken),
    spotify_updated_at: new Date().toISOString(),
  });
}

export async function spotifyStatusForUser(auth0UserId: string): Promise<SpotifyConnectionStatus> {
  const meta = await fetchAuth0UserAppMetadata(auth0UserId);
  const connected = meta?.spotify_connected === true;
  const product = typeof meta?.spotify_product === "string" ? meta.spotify_product : null;
  const accountId = typeof meta?.spotify_account_id === "string" ? meta.spotify_account_id : null;

  return {
    connected,
    product,
    accountId,
    premium: product === "premium",
  };
}

export async function spotifyAccessTokenForUser(auth0UserId: string): Promise<string> {
  const meta = await fetchAuth0UserAppMetadata(auth0UserId);
  const enc = typeof meta?.spotify_refresh_token_enc === "string" ? meta.spotify_refresh_token_enc : "";
  if (!enc) throw new Error("spotify_not_connected");
  const refreshToken = decryptText(enc);
  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
  const nextRefresh = token.refresh_token?.trim();
  if (nextRefresh) {
    await patchAuth0UserAppMetadataGeneric(auth0UserId, {
      spotify_refresh_token_enc: encryptText(nextRefresh),
      spotify_updated_at: new Date().toISOString(),
    });
  }
  return token.access_token;
}

export async function disconnectSpotifyForUser(auth0UserId: string): Promise<void> {
  await patchAuth0UserAppMetadataGeneric(auth0UserId, {
    spotify_connected: false,
    spotify_account_id: null,
    spotify_product: null,
    spotify_scope: null,
    spotify_refresh_token_enc: null,
    spotify_updated_at: new Date().toISOString(),
  });
}

