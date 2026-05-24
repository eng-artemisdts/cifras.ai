import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import type { Metadata } from "next";

import type { Auth0UserMenuUser } from "@/components/auth/auth0-user-menu";
import { LandingPage } from "@/components/landing-page";
import { getSiteUrl } from "@/components/seo/google-site-seo";
import { getAuth0SessionCached } from "@/lib/auth0";

export const metadata: Metadata = {
  alternates: { canonical: getSiteUrl() },
};

function sessionUserToLandingUser(
  sessionUser: NonNullable<Awaited<ReturnType<typeof getAuth0SessionCached>>>["user"],
): Auth0UserMenuUser {
  return {
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
    picture: sessionUser.picture ?? null,
  };
}

export default async function Home() {
  const session = await getAuth0SessionCached();
  const landingUser =
    session?.user != null ? sessionUserToLandingUser(session.user) : null;

  const body = <LandingPage user={landingUser} />;

  return session?.user ? <Auth0Provider user={session.user}>{body}</Auth0Provider> : body;
}
