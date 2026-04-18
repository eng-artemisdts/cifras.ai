import { Auth0Provider } from "@auth0/nextjs-auth0/client";

import { getAuth0SessionCached } from "@/lib/auth0";

export default async function CifrasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuth0SessionCached();

  return <Auth0Provider user={session?.user}>{children}</Auth0Provider>;
}
