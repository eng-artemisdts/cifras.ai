import type { AuthSidebarFeature, AuthShellNavItem } from "./types";

export const defaultAuthSidebarFeatures: AuthSidebarFeature[] = [
  {
    title: "Provedores ",
    description: "Google, Apple e Spotify com um clique.",
    accent: "teal",
  },
  {
    title: "E-mail e senha",
    description: "Ideal quando prefere entrar com e-mail e palavra-passe.",
    accent: "muted",
  },
  {
    title: "Biblioteca unificada",
    description: "Preferências e histórico acompanhados na nuvem.",
    accent: "muted",
  },
];

/** Sidebar da tela de login: um único destaque. */
export const loginAuthSidebarFeatures: AuthSidebarFeature[] = [
  {
    title: "Provedores ",
    description: "Google, Apple e Spotify com um clique.",
    accent: "teal",
  },
];

/** Header em `/login`: utilizador ainda não autenticado — sem link à biblioteca (área protegida). */
export const defaultAuthShellNav: AuthShellNavItem[] = [
  { href: "/explorar", label: "Explorar" },
  { href: "/login", label: "Entrar", current: true },
];

/** Header em `/cadastro`: mesmo critério que `defaultAuthShellNav`. */
export const signupAuthShellNav: AuthShellNavItem[] = [
  { href: "/explorar", label: "Explorar" },
  { href: "/cadastro", label: "Cadastro", current: true },
];

export const signupAuthSidebarFeatures: AuthSidebarFeature[] = [
  {
    title: "Comunidade de músicos",
    description: "Gere cifras, guarde na biblioteca e partilhe com a banda.",
    accent: "teal",
  },
  {
    title: "Termos e privacidade",
    description: "Transparência no uso de dados e de modelos de IA.",
    accent: "muted",
  },
  {
    title: "Entrada rápida",
    description: "Google, Apple ou e-mail — escolha o caminho mais cómodo.",
    accent: "muted",
  },
];
