"use client";

import { Apple, Music2 } from "lucide-react";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

type Flow = "login" | "signup";

type Props = {
  flow: Flow;
  hrefGoogle: string;
  hrefApple: string;
  hrefSpotify: string;
};

function trackOAuth(connection: string, flow: Flow) {
  trackAnalyticsEvent(GA_EVENTS.OAUTH_PROVIDER_CLICK, {
    connection,
    auth_flow: flow,
  });
}

const signupWrap = "flex flex-col gap-2 pt-0.5";
const loginWrap = "flex flex-col gap-2.5 pt-1";

const signupGoogle =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/9 bg-white py-2.5 pl-3 pr-3 text-sm font-semibold text-[#1a1a2e] transition-opacity hover:opacity-95";
const loginGoogle =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/9 bg-white py-3 pl-3.5 pr-3.5 text-sm font-semibold text-[#1a1a2e] transition-opacity hover:opacity-95";

const signupApple =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface-2 py-2.5 pl-3 pr-3 text-sm font-semibold text-cifra-text transition-colors hover:border-white/15";
const loginApple =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface-2 py-3 pl-3.5 pr-3.5 text-sm font-semibold text-cifra-text transition-colors hover:border-white/15";

const signupSpotify =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#1DB954]/27 bg-cifra-surface-2 py-2.5 pl-3 pr-3 text-sm font-semibold text-cifra-text transition-colors hover:border-[#1DB954]/50";
const loginSpotify =
  "flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#1DB954]/27 bg-cifra-surface-2 py-3 pl-3.5 pr-3.5 text-sm font-semibold text-cifra-text transition-colors hover:border-[#1DB954]/50";

/** Links OAuth com métrica de clique (Auth0 Universal Login). */
export function AuthOauthProviderLinks({ flow, hrefGoogle, hrefApple, hrefSpotify }: Props) {
  const isSignup = flow === "signup";
  return (
    <div className={cn(isSignup ? signupWrap : loginWrap)}>
      <a
        href={hrefGoogle}
        className={isSignup ? signupGoogle : loginGoogle}
        onClick={() => trackOAuth("google", flow)}
      >
        <span className="flex size-[22px] items-center justify-center rounded-[11px] bg-[#4285F4] font-[system-ui] text-[11px] font-bold text-white">
          G
        </span>
        Continuar com Google
      </a>
      <a
        href={hrefApple}
        className={isSignup ? signupApple : loginApple}
        onClick={() => trackOAuth("apple", flow)}
      >
        <Apple className="size-5 text-white" strokeWidth={1.5} />
        Continuar com Apple
      </a>
      <a
        href={hrefSpotify}
        className={isSignup ? signupSpotify : loginSpotify}
        onClick={() => trackOAuth("spotify", flow)}
      >
        <Music2 className="size-5 text-[#1DB954]" strokeWidth={1.75} />
        Continuar com Spotify
      </a>
    </div>
  );
}
