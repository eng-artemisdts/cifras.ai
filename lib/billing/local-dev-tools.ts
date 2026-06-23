/** Sync manual Stripe ↔ Auth0 — só em `next dev` (NODE_ENV=development). */
export function isLocalBillingDevToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
