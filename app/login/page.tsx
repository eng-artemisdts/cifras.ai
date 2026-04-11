import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { LoginAuthCard } from "@/components/auth/login-auth-card";
import { loginAuthSidebarFeatures } from "@/lib/auth-layout/default-copy";
import { getAuth0Session } from "@/lib/auth0";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta cifra.ai com Google, Apple, Spotify ou e-mail (Auth0).",
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  const session = await getAuth0Session();
  if (session?.user) redirect("/biblioteca");

  return (
    <AuthSplitShell sidebarProps={{ features: loginAuthSidebarFeatures }}>
      <LoginAuthCard className="mx-auto" />
    </AuthSplitShell>
  );
}
