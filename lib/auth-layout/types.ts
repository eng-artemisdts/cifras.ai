export type AuthSidebarFeatureAccent = "teal" | "muted";

export type AuthSidebarFeature = {
  title: string;
  description: string;
  accent?: AuthSidebarFeatureAccent;
};

export type AuthShellNavItem = {
  href: string;
  label: string;
  current?: boolean;
};
