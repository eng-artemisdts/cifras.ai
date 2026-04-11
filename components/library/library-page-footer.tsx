import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type LibraryPageFooterProps = {
  brandNote?: string;
  className?: string;
};

export function LibraryPageFooter({
  brandNote = "© 2026 Artemis Digital Tech",
  className,
}: LibraryPageFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto flex w-full flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-5 md:px-8",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative block size-5 overflow-hidden rounded">
          <Image
            src="/logo.svg"
            alt=""
            width={828}
            height={220}
            className="h-full w-full object-contain object-left"
            unoptimized
          />
        </span>
        <span className="font-mono text-[10px] text-cifra-muted">{brandNote}</span>
      </div>
      <p className="text-[11px] text-cifra-muted">
        <Link href="/privacidade" className="transition-colors hover:text-cifra-text">
          Privacidade
        </Link>
        <span className="text-cifra-muted"> · </span>
        <Link href="/termos" className="transition-colors hover:text-cifra-text">
          Termos
        </Link>
        <span className="text-cifra-muted"> · </span>
        <Link href="/suporte" className="transition-colors hover:text-cifra-text">
          Suporte
        </Link>
      </p>
    </footer>
  );
}
