import type { AuthSidebarFeature, AuthShellNavItem } from "./types";

export const defaultAuthSidebarFeatures: AuthSidebarFeature[] = [
  {
    title: "Provedores ",
    description: "Google, Apple e Spotify com um clique.",
    accent: "teal",
  },
  {
    title: "E-mail e senha",
    description: "Ideal quando o SSO ainda não está ligado.",
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
    title: "Convites e papéis",
    description: "Administrador, editor e leitor com permissões claras.",
    accent: "teal",
  },
  {
    title: "Termos e privacidade",
    description: "Transparência no uso de dados e de modelos de IA.",
    accent: "muted",
  },
  {
    title: "OAuth ou formulário",
    description: "Escolha o caminho mais rápido para o seu time.",
    accent: "muted",
  },
];
