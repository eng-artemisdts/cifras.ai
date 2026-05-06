import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { LoginAuthCard } from "@/components/auth/login-auth-card";
import { loginAuthSidebarFeatures } from "@/lib/auth-layout/default-copy";
import { getAuth0Session } from "@/lib/auth0";
import { sanitizeAuthReturnTo } from "@/lib/auth0-routes";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta cifra.ai com Google, Apple ou e-mail (Auth0).",
  alternates: { canonical: "/login" },
};

type LoginPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAuth0Session();
  const sp = searchParams ? await searchParams : {};
  const rawReturn =
    typeof sp.returnTo === "string" ? sp.returnTo : Array.isArray(sp.returnTo) ? sp.returnTo[0] : undefined;
  const returnTo = sanitizeAuthReturnTo(rawReturn);

  if (session?.user) {
    redirect(returnTo ?? "/explorar");
  }

  return (
    <AuthSplitShell sidebarProps={{ features: loginAuthSidebarFeatures }}>
      <LoginAuthCard className="mx-auto" returnTo={returnTo} />
    </AuthSplitShell>
  );
}
