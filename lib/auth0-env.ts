export function isAuth0Configured(): boolean {
  return (
    Boolean(process.env.AUTH0_DOMAIN?.trim()) &&
    Boolean(process.env.AUTH0_CLIENT_ID?.trim()) &&
    Boolean(process.env.AUTH0_SECRET?.trim()) &&
    Boolean(
      process.env.AUTH0_CLIENT_SECRET?.trim() ||
        process.env.AUTH0_CLIENT_ASSERTION_SIGNING_KEY?.trim(),
    )
  );
}
