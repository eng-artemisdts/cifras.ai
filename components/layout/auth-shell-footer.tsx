import Link from "next/link";

import { ArtemisFooterBrand } from "@/components/layout/artemis-footer-brand";
import { cn } from "@/lib/utils";

export type AuthShellFooterProps = {
  links?: { href: string; label: string }[];
  versionNote?: string;
  className?: string;
};

const defaultLinks = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
  { href: "/suporte", label: "Suporte" },
];

export function AuthShellFooter({
  links = defaultLinks,
  versionNote = "v0.12 · laboratório",
  className,
}: AuthShellFooterProps) {
  return (
    <footer
      className={cn(
        "w-full border-t border-white/7 px-6 text-[11px] md:px-10",
        className
      )}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-[520px] flex-col gap-3 py-4">
        <div className="flex justify-center sm:justify-start">
          <ArtemisFooterBrand size="sm" />
        </div>
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
          )}
        >
          <p className="min-w-0 text-center text-cifra-muted sm:justify-self-start sm:text-left">
            {links.map((l, i) => (
              <span key={l.href}>
                {i > 0 && <span className="text-cifra-muted"> · </span>}
                <Link href={l.href} className="transition-colors hover:text-cifra-text">
                  {l.label}
                </Link>
              </span>
            ))}
          </p>
          <p className="text-center font-mono text-[10px] text-[#5c5c78] sm:justify-self-end sm:text-right">
            {versionNote}
          </p>
        </div>
      </div>
    </footer>
  );
}
