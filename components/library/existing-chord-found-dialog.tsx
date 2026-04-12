"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Music2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

export type ExistingChordDialogLayout = "default" | "split";

function DialogCoverArt({ url }: { url: string | null | undefined }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return <Music2 className="size-10 text-cifra-muted/45" strokeWidth={1.35} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica da API / catálogo
    <img
      src={url}
      alt=""
      className="size-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export type ExistingChordFoundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  artistName: string;
  coverImageUrl?: string | null;
  chordHref: string;
  /** Quando o utilizador prefere seguir com uma nova detecção em vez de abrir a cifra existente. */
  onContinueWithNewDetection: () => void;
  /** `default` — cartão centrado; `split` — variante com imagem à esquerda em ecrãs médios (alinhada ao frame de variante no Pencil). */
  layout?: ExistingChordDialogLayout;
};

export function ExistingChordFoundDialog({
  open,
  onOpenChange,
  songTitle,
  artistName,
  coverImageUrl,
  chordHref,
  onContinueWithNewDetection,
  layout = "default",
}: ExistingChordFoundDialogProps) {
  const isSplit = layout === "split";

  const handleContinue = useCallback(() => {
    onContinueWithNewDetection();
    onOpenChange(false);
  }, [onContinueWithNewDetection, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Viewport className="fixed inset-0 z-[200] flex items-center justify-center p-4 outline-none">
          <Dialog.Backdrop className="fixed inset-0 bg-[#080810]/72 backdrop-blur-[2px]" />
          <Dialog.Popup
            className={cn(
              "relative z-10 w-full max-w-[400px] rounded-2xl border border-white/[0.09] bg-[#12121f] p-6 pt-9 shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none",
              isSplit && "max-w-[440px] md:max-w-[480px]"
            )}
          >
            <Dialog.Close
              className="absolute right-3 top-3 rounded-md p-1.5 text-cifra-muted transition-colors hover:bg-white/[0.06] hover:text-cifra-text"
              aria-label="Fechar"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </Dialog.Close>

            <div
              className={cn(
                "flex flex-col gap-4",
                isSplit && "md:flex-row md:items-start md:gap-5 md:text-left"
              )}
            >
              <div
                className={cn(
                  "relative flex size-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0c0c16] ring-1 ring-white/[0.06]",
                  !isSplit && "mx-auto",
                  isSplit && "mx-auto md:mx-0"
                )}
              >
                <DialogCoverArt key={coverImageUrl ?? "none"} url={coverImageUrl} />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className={cn("space-y-1", !isSplit && "text-center")}>
                  <Dialog.Title className="font-serif text-[22px] font-normal leading-tight tracking-tight text-cifra-text">
                    Cifra já encontrada
                  </Dialog.Title>
                  <p className="text-sm font-semibold leading-snug text-cifra-text">{songTitle}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cifra-teal">
                    {artistName}
                  </p>
                </div>

                <Dialog.Description className="text-[12px] leading-[1.5] text-cifra-muted">
                  A detecção identificou uma cifra que já corresponde a esta música na base. Quer abrir a cifra
                  existente ou continuar com uma nova detecção a partir do áudio enviado?
                </Dialog.Description>
              </div>
            </div>

            <div
              className={cn(
                "mt-5 flex flex-col gap-2.5",
                isSplit && "md:mt-6 md:flex-row md:justify-end"
              )}
            >
              <Link
                href={chordHref}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cifra-teal px-4 py-2.5 text-[12px] font-semibold text-cifra-bg transition-opacity hover:opacity-95",
                  isSplit && "md:w-auto"
                )}
                onClick={() => onOpenChange(false)}
              >
                Abrir cifra existente
              </Link>
              <Dialog.Close
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] px-4 py-2.5 text-[12px] font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35 hover:bg-white/[0.04]",
                  isSplit && "md:w-auto"
                )}
                onClick={handleContinue}
              >
                Continuar com detecção nova
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
