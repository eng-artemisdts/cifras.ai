import type { SchubertIngestJobResponse } from "@/lib/schubert-identify-types";

export function humanizeIngestStage(stage: string): string {
  const map: Record<string, string> = {
    queued: "Na fila…",
    resolveSource: "A preparar origem…",
    downloadSpotifySource: "A obter áudio…",
    uploadAudio: "A processar áudio…",
    recognizeSong: "A reconhecer música…",
    resolveChordsAndSections: "Acordes e secções…",
    resolveLyrics: "Letra…",
    resolveYoutube: "YouTube…",
    persistTrack: "A guardar…",
    processIngest: "A preparar a cifra…",
    completed: "Concluído",
    failed: "Falhou",
  };
  return map[stage] ?? "A processar…";
}

export function formatIngestProgressLabel(job: SchubertIngestJobResponse): string {
  const stages = job.stages ?? [];
  const running = [...stages].reverse().find((s) => s.status === "running");
  if (running?.stageName) return humanizeIngestStage(running.stageName);
  if (job.currentStage) return humanizeIngestStage(job.currentStage);
  return "A processar…";
}
