"use client";

import Link from "next/link";
import type { MusicCatalogCard as MusicCatalogCardModel } from "@/lib/library/types";
import { musicCoverClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";
import {
  deleteMyVariationByTrackId,
  removeTrackFromLibraryByTrackKey,
} from "@/lib/library/beethoven-library-variations";
import { EllipsisVertical, Eye, Music2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MusicCatalogCardProps = {
  item: MusicCatalogCardModel;
  onDeleted?: (id: string) => void;
  className?: string;
};

const tagStyles = {
  teal: "border-cifra-teal/20 bg-cifra-teal/12 text-cifra-teal",
  amber: "border-cifra-gold/20 bg-cifra-gold/12 text-cifra-gold",
} as const;

export function MusicCatalogCard({ item, onDeleted, className }: MusicCatalogCardProps) {
  const coverUrl = item.coverImageUrl?.trim();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<"delete-version" | "remove-library">("delete-version");
  const canManageVersion = item.isOwnerVersion === true && Boolean(item.trackKey?.trim());
  const canManageLibraryItem = item.isOwnerVersion !== true && Boolean(item.accessHref || item.isSaved);

  async function handleDelete() {
    const trackKey = item.trackKey?.trim();
    if (!trackKey || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      if (confirmMode === "delete-version") {
        await deleteMyVariationByTrackId(trackKey);
      } else {
        await removeTrackFromLibraryByTrackKey(trackKey);
      }
      setOpen(false);
      setConfirmOpen(false);
      onDeleted?.(item.id);
    } catch {
      setDeleteError("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface p-3.5",
        className
      )}
    >
      <div
        className={cn("h-[120px] w-full rounded-lg", musicCoverClass[item.coverTone])}
        aria-hidden
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- origem externa dinâmica
          <img src={coverUrl} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-black/25">
            <Music2 className="size-7 text-cifra-muted/60" strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-cifra-text">{item.title}</h3>
        <p className="text-xs text-cifra-muted">{item.subtitle}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex w-fit rounded px-2 py-0.5 font-mono text-[9px] font-normal",
            tagStyles[item.tagVariant]
          )}
        >
          {item.tagLabel}
        </span>
        {canManageVersion || canManageLibraryItem ? (
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger
              aria-label={`Ações da versão ${item.title}`}
              className="inline-flex size-7 items-center justify-center rounded-md border border-white/10 text-cifra-muted transition-colors hover:border-cifra-teal/45 hover:text-cifra-text"
            >
              <EllipsisVertical className="size-4" strokeWidth={1.8} />
            </PopoverTrigger>
            <PopoverContent side="top" align="end" sideOffset={8} className="min-w-[180px] p-1.5">
              <div className="flex flex-col gap-1">
                {item.accessHref ? (
                  <Link
                    href={item.accessHref}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-cifra-text transition-colors hover:bg-white/6"
                  >
                    <Eye className="size-3.5 text-cifra-muted" />
                    Acessar versão
                  </Link>
                ) : null}
                {item.editHref ? (
                  <Link
                    href={item.editHref}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-cifra-text transition-colors hover:bg-white/6"
                  >
                    <Pencil className="size-3.5 text-cifra-muted" />
                    Editar versão
                  </Link>
                ) : null}
                {canManageVersion ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setConfirmMode("delete-version");
                      setOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Excluir versão
                  </button>
                ) : null}
                {canManageLibraryItem && item.isSaved && item.trackKey ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setConfirmMode("remove-library");
                      setOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-cifra-muted transition-colors hover:bg-white/6 hover:text-cifra-text disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Remover da biblioteca
                  </button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[min(100vw-1.5rem,26rem)]">
          <DialogHeader>
            <DialogTitle>
              {confirmMode === "delete-version" ? "Excluir versão?" : "Remover da biblioteca?"}
            </DialogTitle>
            <DialogDescription>
              {confirmMode === "delete-version" ? (
                <>
                  Esta ação remove permanentemente sua versão de <span className="text-cifra-text">“{item.title}”</span> da
                  biblioteca.
                </>
              ) : (
                <>
                  A música <span className="text-cifra-text">“{item.title}”</span> será removida dos seus salvos da
                  biblioteca.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="px-5 py-2 text-xs text-red-300/90" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35 hover:bg-white/6 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="inline-flex items-center justify-center rounded-lg bg-red-500/90 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {deleting
                ? confirmMode === "delete-version"
                  ? "Excluindo..."
                  : "Removendo..."
                : confirmMode === "delete-version"
                  ? "Sim, excluir"
                  : "Sim, remover"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
