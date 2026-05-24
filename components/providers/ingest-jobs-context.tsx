"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cifraEditHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { formatIngestProgressLabel } from "@/lib/library/ingest-stage-label";
import { getIngestJobStatus } from "@/lib/schubert-identify-service";
import type { SchubertIngestJobResponse } from "@/lib/schubert-identify-types";
import { fetchSchubertFromBrowser, type SchubertTrackJson } from "@/lib/schubert-api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cifra.ingestJobs.v1";
const MAX_JOBS = 40;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_MS = 2600;

export type IngestJobSource = "spotify" | "arquivo" | "url";

export type TrackedIngestJob = {
  jobId: string;
  title: string;
  artist: string;
  source: IngestJobSource;
  coverUrl?: string | null;
  createdAt: number;
  status: SchubertIngestJobResponse["status"];
  progressPercent: number;
  currentStage: string;
  stageLabel: string;
  error?: string | null;
  resultTrackId?: string | null;
};

type StoredJobV1 = Omit<TrackedIngestJob, "stageLabel"> & { stageLabel?: string };

function loadStored(): TrackedIngestJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const out: TrackedIngestJob[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const j = row as StoredJobV1;
      if (typeof j.jobId !== "string" || !j.jobId.trim()) continue;
      if (typeof j.createdAt !== "number" || now - j.createdAt > MAX_AGE_MS) continue;
      out.push({
        jobId: j.jobId.trim(),
        title: typeof j.title === "string" ? j.title : "Sem título",
        artist: typeof j.artist === "string" ? j.artist : "",
        source: j.source === "arquivo" || j.source === "url" || j.source === "spotify" ? j.source : "spotify",
        coverUrl: typeof j.coverUrl === "string" ? j.coverUrl : null,
        createdAt: j.createdAt,
        status: j.status ?? "queued",
        progressPercent: typeof j.progressPercent === "number" ? j.progressPercent : 0,
        currentStage: typeof j.currentStage === "string" ? j.currentStage : "queued",
        stageLabel: typeof j.stageLabel === "string" ? j.stageLabel : "A processar…",
        error: typeof j.error === "string" ? j.error : null,
        resultTrackId: typeof j.resultTrackId === "string" ? j.resultTrackId : null,
      });
    }
    return out.slice(-MAX_JOBS);
  } catch {
    return [];
  }
}

function persist(jobs: TrackedIngestJob[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(-MAX_JOBS)));
  } catch {
    /* quota */
  }
}

type CompletionModalState = {
  jobId: string;
  title: string;
  artist: string;
  resultTrackId: string;
} | null;

type IngestJobsContextValue = {
  jobs: TrackedIngestJob[];
  registerIngestJob: (input: {
    jobId: string;
    title: string;
    artist: string;
    source: IngestJobSource;
    coverUrl?: string | null;
  }) => void;
  dismissJob: (jobId: string) => void;
  clearCompletedFromList: () => void;
};

const IngestJobsContext = createContext<IngestJobsContextValue | null>(null);

export function useIngestJobs(): IngestJobsContextValue {
  const ctx = useContext(IngestJobsContext);
  if (!ctx) {
    throw new Error("useIngestJobs deve ser usado dentro de IngestJobsProvider.");
  }
  return ctx;
}

/** Versão opcional (ex.: Storybook) — não lança se o provider não existir. */
export function useIngestJobsOptional(): IngestJobsContextValue | null {
  return useContext(IngestJobsContext);
}

function mergeRemote(local: TrackedIngestJob, remote: SchubertIngestJobResponse): TrackedIngestJob {
  return {
    ...local,
    status: remote.status,
    progressPercent: remote.progressPercent,
    currentStage: remote.currentStage,
    stageLabel: formatIngestProgressLabel(remote),
    error: remote.error?.trim() || null,
    resultTrackId: remote.resultTrackId?.trim() || local.resultTrackId || null,
  };
}

export function IngestJobsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<TrackedIngestJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [completionModal, setCompletionModal] = useState<CompletionModalState>(null);
  const [editLoading, setEditLoading] = useState(false);
  const completionShownRef = useRef(new Set<string>());
  const jobsRef = useRef(jobs);

  useEffect(() => {
    jobsRef.current = jobs;
  });

  const activePollCount = useMemo(
    () => jobs.filter((j) => j.status === "queued" || j.status === "running").length,
    [jobs],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hidratação única do localStorage no cliente */
    setJobs(loadStored());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persist(jobs);
  }, [jobs, hydrated]);

  const registerIngestJob = useCallback((input: {
    jobId: string;
    title: string;
    artist: string;
    source: IngestJobSource;
    coverUrl?: string | null;
  }) => {
    const id = input.jobId.trim();
    if (!id) return;
    const now = Date.now();
    setJobs((prev) => {
      const without = prev.filter((j) => j.jobId !== id);
      const next: TrackedIngestJob = {
        jobId: id,
        title: input.title.trim() || "Sem título",
        artist: input.artist.trim() || "",
        source: input.source,
        coverUrl: input.coverUrl ?? null,
        createdAt: now,
        status: "queued",
        progressPercent: 0,
        currentStage: "queued",
        stageLabel: "Na fila…",
        error: null,
        resultTrackId: null,
      };
      return [...without, next].slice(-MAX_JOBS);
    });
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  const clearCompletedFromList = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status !== "completed" && j.status !== "failed" && j.status !== "cancelled"));
  }, []);

  /** Polling em segundo plano — intervalo só quando há jobs activos (contagem estável entre polls de progresso). */
  useEffect(() => {
    if (!hydrated || activePollCount === 0) return;

    const runTick = async () => {
      const list = jobsRef.current;
      const active = list.filter((j) => j.status === "queued" || j.status === "running");
      if (active.length === 0) return;

      const updates = await Promise.all(
        active.map(async (j) => {
          try {
            const remote = await getIngestJobStatus(j.jobId);
            return { jobId: j.jobId, remote };
          } catch {
            return null;
          }
        }),
      );

      setJobs((prev) => {
        const map = new Map(prev.map((x) => [x.jobId, x]));
        for (const u of updates) {
          if (!u) continue;
          const cur = map.get(u.jobId);
          if (!cur) continue;
          const merged = mergeRemote(cur, u.remote);
          map.set(u.jobId, merged);

          if (
            u.remote.status === "completed" &&
            u.remote.resultTrackId?.trim() &&
            !completionShownRef.current.has(u.jobId)
          ) {
            completionShownRef.current.add(u.jobId);
            queueMicrotask(() => {
              setCompletionModal({
                jobId: u.jobId,
                title: cur.title,
                artist: cur.artist,
                resultTrackId: u.remote.resultTrackId!.trim(),
              });
            });
          }
        }
        return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
      });
    };

    void runTick();
    const id = setInterval(() => void runTick(), POLL_MS);
    return () => clearInterval(id);
  }, [hydrated, activePollCount]);

  const resolveEditHref = useCallback(async (resultTrackId: string): Promise<string | null> => {
    const res = await fetchSchubertFromBrowser(`tracks/by-key/${encodeURIComponent(resultTrackId)}`, {
      method: "GET",
    });
    if (!res.ok) return null;
    const track = (await res.json()) as SchubertTrackJson;
    const pair = resolveCifraSlugPairFromTrack(track);
    if (pair) return cifraEditHref(pair.artistSlug, pair.songSlug);
    const tid = typeof track.trackId === "string" && track.trackId.trim() ? track.trackId.trim() : "";
    if (tid) return `/cifras/edit?trackId=${encodeURIComponent(tid)}`;
    return null;
  }, []);

  const handleEditClick = useCallback(async () => {
    if (!completionModal?.resultTrackId) return;
    setEditLoading(true);
    try {
      const href = await resolveEditHref(completionModal.resultTrackId);
      setCompletionModal(null);
      if (href) router.push(href);
    } finally {
      setEditLoading(false);
    }
  }, [completionModal, resolveEditHref, router]);

  const value = useMemo(
    () => ({
      jobs,
      registerIngestJob,
      dismissJob,
      clearCompletedFromList,
    }),
    [jobs, registerIngestJob, dismissJob, clearCompletedFromList],
  );

  return (
    <IngestJobsContext.Provider value={value}>
      {children}
      <Dialog
        open={completionModal !== null}
        onOpenChange={(open) => {
          if (!open) setCompletionModal(null);
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-[400px]" showCloseButton>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Cifra pronta</DialogTitle>
            <DialogDescription>
              A ingestão de{" "}
              <span className="font-medium text-cifra-text">
                {completionModal?.title ?? ""}
              </span>{" "}
              terminou. Quer abrir o editor?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-white/8 px-5 py-4 sm:justify-stretch">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className={cn("border-white/15 bg-white/5")}
                disabled={editLoading}
                onClick={() => setCompletionModal(null)}
              >
                Agora não
              </Button>
              <Button
                type="button"
                className="bg-cifra-teal text-cifra-bg hover:bg-cifra-teal/90"
                disabled={editLoading}
                onClick={() => void handleEditClick()}
              >
                {editLoading ? "A abrir…" : "Editar cifra"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IngestJobsContext.Provider>
  );
}
