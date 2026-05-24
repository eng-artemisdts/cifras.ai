import { spotifyAccessTokenForUser } from "@/lib/spotify-auth";

export async function spotifyApiForUser(
  auth0UserId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await spotifyAccessTokenForUser(auth0UserId);
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`https://api.spotify.com/v1${p}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

