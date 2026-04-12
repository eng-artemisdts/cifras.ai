"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Music2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

import type { LibraryImportDialogLayout } from "@/components/library/library-import-dialog-layout";

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

export type ChordFoundAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  artistName: string;
  coverImageUrl?: string | null;
  chordHref: string;
  onAccessClick?: () => void;
  layout?: LibraryImportDialogLayout;
};

export function ChordFoundAccessDialog({
  open,
  onOpenChange,
  songTitle,
  artistName,
  coverImageUrl,
  chordHref,
  onAccessClick,
  layout = "default",
}: ChordFoundAccessDialogProps) {
  const isSplit = layout === "split";

  const handleAgoraNao = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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
                    Cifra e música encontradas
                  </Dialog.Title>
                  <p className="text-sm font-semibold leading-snug text-cifra-text">{songTitle}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cifra-teal">
                    {artistName}
                  </p>
                </div>

                <Dialog.Description className="text-[12px] leading-[1.5] text-cifra-muted">
                  A identificação encontrou esta música e já existe uma cifra correspondente na biblioteca. Deseja
                  aceder à cifra agora?
                </Dialog.Description>
              </div>
            </div>

            <div
              className={cn(
                "mt-5 flex flex-col gap-2.5",
                isSplit && "md:mt-6 md:flex-row md:flex-wrap md:justify-end"
              )}
            >
              <Link
                href={chordHref}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cifra-teal px-4 py-2.5 text-[12px] font-semibold text-cifra-bg transition-opacity hover:opacity-95",
                  isSplit && "md:w-auto"
                )}
                onClick={() => {
                  onAccessClick?.();
                  onOpenChange(false);
                }}
              >
                Aceder à cifra
              </Link>
              <button
                type="button"
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] px-4 py-2.5 text-[12px] font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35 hover:bg-white/[0.04]",
                  isSplit && "md:w-auto"
                )}
                onClick={handleAgoraNao}
              >
                Agora não
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
