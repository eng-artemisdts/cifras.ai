import type { ReactNode } from "react";

import type { AuthMarketingSidebarProps } from "@/components/layout/auth-marketing-sidebar";
import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import { AuthShellFooter } from "@/components/layout/auth-shell-footer";
import type { AuthShellHeaderProps } from "@/components/layout/auth-shell-header";
import { AuthShellHeader } from "@/components/layout/auth-shell-header";
import { authShellMainColumnClass } from "@/lib/auth-layout/shell-classes";
import { cn } from "@/lib/utils";

export type AuthSplitShellProps = {
  children: ReactNode;
  /** Props extras para o painel esquerdo (textos, features, etc.). */
  sidebarProps?: Partial<AuthMarketingSidebarProps>;
  headerProps?: Partial<AuthShellHeaderProps>;
  className?: string;
};

/**
 * Layout em duas colunas: sidebar de marketing (SjJ7e) + área principal com header dock, conteúdo e rodapé.
 * Reutilizável em login, cadastro, recuperação de senha, etc.
 */
export function AuthSplitShell({
  children,
  sidebarProps,
  headerProps,
  className,
}: AuthSplitShellProps) {
  return (
    <div className={cn("flex min-h-dvh bg-cifra-bg", className)}>
      <AuthMarketingSidebar className="hidden shrink-0 lg:flex" {...sidebarProps} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <AuthShellHeader className="shrink-0" {...headerProps} />
        <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
          <div className={cn("flex flex-1 flex-col justify-center", authShellMainColumnClass)}>
            {children}
          </div>
        </main>
        <AuthShellFooter className="mt-auto shrink-0" />
      </div>
    </div>
  );
}
