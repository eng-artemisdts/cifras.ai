"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

import { sanitizeAuthReturnTo } from "@/lib/auth0-routes";

type Auth0CredentialsFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  /** login: apenas e-mail na Universal Login; signup: screen_hint=signup. */
  mode: "login" | "signup";
  children: ReactNode;
  returnTo?: string;
};

/**
 * Envia o utilizador para `/auth/login` da Auth0 com parâmetros opcionais.
 * A palavra-passe é sempre tratada na página segura da Auth0 (Universal Login).
 */
export function Auth0CredentialsForm({ mode, children, returnTo, ...formProps }: Auth0CredentialsFormProps) {
  return (
    <form
      {...formProps}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const email = (new FormData(form).get("email") as string | null)?.trim() ?? "";
        const params = new URLSearchParams();
        if (mode === "signup") params.set("screen_hint", "signup");
        if (email) params.set("login_hint", email);
        const safe = sanitizeAuthReturnTo(returnTo);
        if (safe) params.set("returnTo", safe);
        const q = params.toString();
        window.location.assign(`/auth/login${q ? `?${q}` : ""}`);
      }}
    >
      {children}
    </form>
  );
}
