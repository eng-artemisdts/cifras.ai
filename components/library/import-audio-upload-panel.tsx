"use client";

import {
  AudioLines,
  FolderOpen,
  Lightbulb,
  Music2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";
import { useCallback, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a";
const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type QueuedFile = {
  id: string;
  file: File;
};

export function ImportAudioUploadPanel({ className }: { className?: string }) {
  const inputId = useId();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const ingestLabel =
    queue.length === 0 ? "Nenhum arquivo ainda" : "1 arquivo · pronto para processar";

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => {
      const okType =
        f.type.startsWith("audio/") || /\.(mp3|wav|m4a)$/i.test(f.name);
      return okType && f.size <= MAX_BYTES;
    });
    const file = incoming[0];
    if (!file) return;
    setQueue([
      {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`,
        file,
      },
    ]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-[14px] md:gap-[18px]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <AudioLines className="size-[18px] shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
          <h2 className="text-[13px] font-semibold leading-none text-cifra-text">Ingestão de áudio</h2>
        </div>
        <p className="text-right font-mono text-[10px] leading-tight text-cifra-teal">{ingestLabel}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-3.5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface">
          <div className="h-[5px] w-full shrink-0 bg-cifra-teal" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-[22px] py-3.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-cifra-muted">CAPTURA</span>
            <span className="font-mono text-[9px] text-cifra-muted">MP3 · WAV · M4A · máx. 50 MB</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Abrir seletor de um arquivo de áudio ou soltar o arquivo aqui"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                addInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "flex shrink-0 cursor-pointer flex-col items-center gap-2 border-b border-white/6 bg-[#12121f] px-5 py-5 text-center transition-colors",
              dragOver && "bg-cifra-teal/8 ring-1 ring-inset ring-cifra-teal/30"
            )}
            onClick={() => addInputRef.current?.click()}
          >
            <Upload className="size-[30px] text-cifra-teal" strokeWidth={1.5} aria-hidden />
            <p className="text-[15px] font-medium text-cifra-text">Solte o arquivo aqui ou escolha no disco</p>
            <p className="max-w-[280px] text-center text-[12px] leading-[1.45] text-cifra-muted">
              Um arquivo por vez — MP3, WAV ou M4A (máx. 50 MB). Novo envio substitui o anterior.
            </p>
            <input
              ref={addInputRef}
              id={inputId}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-white/6 px-[22px] py-3">
              <span className="text-[12px] font-semibold text-cifra-text">Fila atual</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearQueue();
                }}
                disabled={queue.length === 0}
                className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover disabled:opacity-40"
              >
                Esvaziar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border-b border-white/6 px-[22px] py-10 text-center">
                  <Music2 className="size-5 text-cifra-muted/50" strokeWidth={1.5} aria-hidden />
                  <p className="text-[12px] text-cifra-muted">Nenhum arquivo na fila</p>
                  <p className="font-mono text-[10px] text-[#5c5c78]">Escolha um arquivo de áudio</p>
                </div>
              ) : (
                queue.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3.5 border-b border-white/6 bg-[#0c0c16] px-[22px] py-3.5"
                  >
                    <Music2 className="size-5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-[13px] font-semibold text-cifra-text">{q.file.name}</p>
                      <p className="font-mono text-[10px] text-cifra-muted">
                        {formatBytes(q.file.size)} · aguardando análise
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-cifra-teal/30 bg-cifra-teal/10 px-2.5 py-1 font-mono text-[9px] text-cifra-teal">
                      Pronto
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(q.id)}
                      className="shrink-0 rounded-md p-1 text-cifra-muted transition-colors hover:bg-white/6 hover:text-cifra-text"
                      aria-label={`Remover ${q.file.name}`}
                    >
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-white/6 bg-[#080810]/35 px-[22px] py-3.5">
              <button
                type="button"
                onClick={() => addInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-[10px] border border-cifra-border px-4 py-2.5 text-[12px] font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35"
              >
                <FolderOpen className="size-4" strokeWidth={1.75} aria-hidden />
                Trocar arquivo
              </button>
              <button
                type="button"
                disabled={queue.length === 0}
                className="inline-flex items-center gap-2 rounded-[10px] bg-cifra-teal px-5 py-3 text-[12px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                Rodar detecção
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-cifra-border bg-cifra-border sm:grid-cols-3">
          <div className="bg-cifra-surface-2 px-[18px] py-3.5 sm:border-r sm:border-white/6">
            <p className="text-[11px] font-semibold leading-tight text-cifra-text">Um arquivo</p>
            <p className="mt-1.5 text-[11px] leading-[1.4] text-cifra-muted">
              Remova ou troque o arquivo antes de rodar a detecção.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-[18px] py-3.5 sm:border-r sm:border-white/6">
            <p className="text-[11px] font-semibold leading-tight text-cifra-text">Qualidade do sinal</p>
            <p className="mt-1.5 text-[11px] leading-[1.4] text-cifra-muted">
              Takes secos e menos compressão ajudam o modelo.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-[18px] py-3.5">
            <p className="text-[11px] font-semibold leading-tight text-cifra-gold">Exportação</p>
            <p className="mt-1.5 text-[11px] leading-[1.4] text-cifra-muted">
              Editar acordes, salvar versão, exportar texto ou PDF.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-[11px] leading-[1.45] text-cifra-muted">
            Grave com poucos instrumentos sobrepostos; o modelo lê melhor o núcleo harmônico central do mix.
          </p>
        </div>

        <p className="text-center text-[12px] text-cifra-muted md:text-left">
          <Link href="/biblioteca/importar" className="font-medium text-cifra-teal hover:text-cifra-teal-hover">
            ← Voltar à escolha de origem
          </Link>
        </p>
      </div>
    </div>
  );
}
