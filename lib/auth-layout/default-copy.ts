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

export const defaultAuthShellNav: AuthShellNavItem[] = [
  { href: "/", label: "Explorar" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/login", label: "Entrar", current: true },
];

export const signupAuthShellNav: AuthShellNavItem[] = [
  { href: "/", label: "Explorar" },
  { href: "/biblioteca", label: "Biblioteca" },
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
