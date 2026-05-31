"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const QUERY_FLAG = "ingest-blocked";

/**
 * Modal na página Explorar quando o utilizador tenta iniciar outra ingestão
 * enquanto já existe uma em curso (`?ingest-blocked=1`).
 */
export function ExplorarIngestBlockedDialog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const flagged = searchParams.get(QUERY_FLAG) === "1";

  const clearQuery = () => {
    router.replace("/explorar");
  };

  return (
    <Dialog
      open={flagged}
      onOpenChange={(next) => {
        if (!next) clearQuery();
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-[420px]" showCloseButton>
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Cifra em preparação</DialogTitle>
          <DialogDescription>
            Já existe um pedido de criação de cifra em progresso. Aguarde a conclusão ou acompanhe
            em Cifras em progresso antes de iniciar outro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t border-white/8 px-5 py-4">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 bg-white/5"
              onClick={() => {
                clearQuery();
              }}
            >
              Entendi
            </Button>
            <Link
              href="/biblioteca/ingestoes"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-cifra-teal px-3 text-sm font-medium text-cifra-bg transition hover:bg-cifra-teal/90"
            >
              Ver em progresso
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
