import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { SignupAuthCard } from "@/components/auth/signup-auth-card";
import { getAuth0Session } from "@/lib/auth0";
import {
  signupAuthShellNav,
  signupAuthSidebarFeatures,
} from "@/lib/auth-layout/default-copy";

export const metadata: Metadata = {
  title: "Criar conta",
  description:
    "Cadastre-se no cifra.ai com Google, Apple ou formulário completo.",
  alternates: { canonical: "/cadastro" },
};

export default async function CadastroPage() {
  const session = await getAuth0Session();
  if (session?.user) redirect("/explorar");

  return (
    <AuthSplitShell
      headerProps={{ items: signupAuthShellNav }}
      sidebarProps={{
        contextLabel: "AUTH · CONTA",
        titleLine1: "Criar",
        titleLine2: "sua conta",
        introText:
          "Convide o time, aceite os termos e comece com OAuth ou formulário completo.",
        features: signupAuthSidebarFeatures,
      }}
    >
      <SignupAuthCard className="mx-auto" />
    </AuthSplitShell>
  );
}
