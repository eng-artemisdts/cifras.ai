/**
 * Access tokens da API Auth0 (RS256) são JWT com 3 segmentos.
 * Tokens opacos ou `undefined` falham no passport-jwt com "jwt malformed".
 */
export function isAccessTokenLikelyJwt(token: string | undefined): token is string {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}
