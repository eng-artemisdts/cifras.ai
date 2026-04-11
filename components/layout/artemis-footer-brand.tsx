import Image from "next/image";

import { cn } from "@/lib/utils";

export const ARTEMIS_DIGITAL_URL = "https://www.artemisdigital.tech/";

type ArtemisFooterBrandProps = {
  className?: string;
  /** `sm` para rodapés compactos (auth); `md` para a landing. */
  size?: "sm" | "md";
};

export function ArtemisFooterBrand({
  className,
  size = "md",
}: ArtemisFooterBrandProps) {
  const markClass = size === "sm" ? "h-[22px] w-[24px]" : "h-[28px] w-[30px]";

  return (
    <a
      href={ARTEMIS_DIGITAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex shrink-0 rounded-md outline-none ring-cifra-teal/40 transition-opacity hover:opacity-90 focus-visible:ring-2",
        className
      )}
      aria-label="Artemis Digital Solutions — abre o site em nova aba"
    >
      <Image
        src="/logo-artemis.svg"
        alt=""
        width={92}
        height={86}
        className={cn("object-contain object-left", markClass)}
        unoptimized
      />
    </a>
  );
}
