"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { Menu } from "@base-ui/react/menu";
import { LogOut } from "lucide-react";
import Image from "next/image";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { AUTH0_LOGOUT_PATH } from "@/lib/auth0-routes";
import { cn } from "@/lib/utils";

export type Auth0UserMenuUser = {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

function initialsFromUser(user: Auth0UserMenuUser) {
  const raw = (user.name || user.email || "?").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase() || "?";
}

function summarizeClientUser(
  u: NonNullable<ReturnType<typeof useUser>["user"]>,
): Auth0UserMenuUser {
  return {
    name: u.name ?? null,
    email: u.email ?? null,
    picture: u.picture ?? null,
  };
}

const popupClass =
  "min-w-[220px] rounded-xl border border-white/[0.08] bg-cifra-surface py-1.5 shadow-lg shadow-black/40 outline-none z-50";

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-cifra-text outline-none data-highlighted:bg-white/[0.06]";

const linkItemClass = cn(itemClass, "no-underline");

export type Auth0UserMenuProps = {
  /** Dados da sessão no servidor; alinhado com o fallback do `Auth0Provider` e `useUser()`. */
  user: Auth0UserMenuUser;
  className?: string;
};

/**
 * Menu do utilizador com rotas do SDK Auth0 (`/auth/logout`, etc.) e `useUser()` para consistência com `/auth/profile`.
 */
export function Auth0UserMenu({ user: serverUser, className }: Auth0UserMenuProps) {
  const { user: clientUser, error } = useUser();
  const user = clientUser && !error ? summarizeClientUser(clientUser) : serverUser;
  const label = user.name || user.email || "Conta";
  const hasPicture = Boolean(user.picture);

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={cn(
          "relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-cifra-surface ring-1 ring-white/10 outline-none transition-[box-shadow,ring-color] hover:ring-cifra-teal/35 focus-visible:ring-2 focus-visible:ring-cifra-teal/50 data-[popup-open]:ring-cifra-teal/40",
          className,
        )}
        aria-label={`Menu da conta: ${label}`}
        title={label}
      >
        {hasPicture && user.picture ? (
          <Image
            src={user.picture}
            alt={label}
            width={36}
            height={36}
            className="size-full object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden className="text-[11px] font-semibold tracking-wide text-cifra-teal">
            {initialsFromUser(user)}
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup className={popupClass}>
            <Menu.Viewport className="px-1.5">
              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <p className="truncate text-[13px] font-medium text-cifra-text">{user.name || "Conta"}</p>
                {user.email ? (
                  <p className="truncate text-[11px] text-cifra-muted">{user.email}</p>
                ) : null}
              </div>
              <Menu.Group className="py-1">
                <Menu.LinkItem
                  href="/explorar"
                  closeOnClick
                  className={linkItemClass}
                  onClick={() =>
                    trackAnalyticsEvent(GA_EVENTS.ACCOUNT_MENU_NAV, { destination: "explorar" })
                  }
                >
                  Explorar
                </Menu.LinkItem>
                <Menu.LinkItem
                  href="/biblioteca"
                  closeOnClick
                  className={linkItemClass}
                  onClick={() =>
                    trackAnalyticsEvent(GA_EVENTS.ACCOUNT_MENU_NAV, { destination: "biblioteca" })
                  }
                >
                  Biblioteca
                </Menu.LinkItem>
                <Menu.LinkItem
                  href="/conta/assinatura"
                  closeOnClick
                  className={linkItemClass}
                  onClick={() =>
                    trackAnalyticsEvent(GA_EVENTS.ACCOUNT_MENU_NAV, { destination: "assinatura" })
                  }
                >
                  Assinatura
                </Menu.LinkItem>
              </Menu.Group>
              <Menu.Separator className="my-1 h-px bg-white/[0.06]" />
              <Menu.Group>
                <Menu.LinkItem
                  href={AUTH0_LOGOUT_PATH}
                  closeOnClick
                  className={cn(linkItemClass, "text-cifra-muted hover:text-cifra-text")}
                  onClick={() => trackAnalyticsEvent(GA_EVENTS.LOGOUT_CLICK)}
                >
                  <LogOut className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  Terminar sessão
                </Menu.LinkItem>
              </Menu.Group>
            </Menu.Viewport>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
