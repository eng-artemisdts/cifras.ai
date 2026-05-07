"use client";

export type PlaybackProvider = "internal" | "youtube" | "spotify";

export type PlaybackAdapter = {
  provider: PlaybackProvider;
  ready(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  destroy(): void;
};

type InternalAudioAdapterOptions = {
  audioEl: HTMLAudioElement;
  audioUrl?: string;
};

export function createInternalAudioAdapter(opts: InternalAudioAdapterOptions): PlaybackAdapter {
  const { audioEl, audioUrl } = opts;
  if (audioUrl) audioEl.src = audioUrl;
  audioEl.load();

  return {
    provider: "internal",
    async ready() {
      if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) return;
      await new Promise<void>((resolve) => {
        const onDone = () => {
          audioEl.removeEventListener("loadedmetadata", onDone);
          audioEl.removeEventListener("error", onDone);
          resolve();
        };
        audioEl.addEventListener("loadedmetadata", onDone, { once: true });
        audioEl.addEventListener("error", onDone, { once: true });
      });
    },
    async play() {
      await audioEl.play();
    },
    async pause() {
      audioEl.pause();
    },
    async seek(seconds: number) {
      if (!Number.isFinite(seconds)) return;
      audioEl.currentTime = Math.max(0, seconds);
    },
    getCurrentTime() {
      return Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
    },
    getDuration() {
      return Number.isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 0;
    },
    isPlaying() {
      return !audioEl.paused;
    },
    destroy() {
      audioEl.pause();
    },
  };
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume?: number;
        getOAuthToken: (cb: (token: string) => void) => void;
      }) => SpotifyWebPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

/** YouTube via `react-player` (elemento `<video is="youtube-video">` ou equivalente). */
type YoutubeMediaAdapterOptions = {
  getMediaElement: () => HTMLVideoElement | null;
};

export function createYoutubeMediaElementAdapter(opts: YoutubeMediaAdapterOptions): PlaybackAdapter {
  const { getMediaElement } = opts;

  async function waitForMediaReady(): Promise<HTMLVideoElement> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const el = getMediaElement();
      if (el) {
        if (Number.isFinite(el.duration) && el.duration > 0) return el;
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          el.addEventListener("loadedmetadata", done, { once: true });
          el.addEventListener("error", done, { once: true });
          window.setTimeout(done, 2500);
        });
        if (Number.isFinite(el.duration) && el.duration > 0) return el;
      }
      await new Promise((r) => window.setTimeout(r, 40));
    }
    throw new Error("youtube_player_timeout");
  }

  return {
    provider: "youtube",
    async ready() {
      await waitForMediaReady();
    },
    async play() {
      const el = getMediaElement();
      if (!el) return;
      await el.play().catch(() => undefined);
    },
    async pause() {
      const el = getMediaElement();
      el?.pause();
    },
    async seek(seconds: number) {
      if (!Number.isFinite(seconds)) return;
      const el = getMediaElement();
      if (!el) return;
      el.currentTime = Math.max(0, seconds);
    },
    getCurrentTime() {
      const el = getMediaElement();
      if (!el) return 0;
      const t = el.currentTime;
      return Number.isFinite(t) ? t : 0;
    },
    getDuration() {
      const el = getMediaElement();
      if (!el) return 0;
      const d = el.duration;
      return Number.isFinite(d) && d > 0 ? d : 0;
    },
    isPlaying() {
      const el = getMediaElement();
      return Boolean(el && !el.paused);
    },
    destroy() {
      const el = getMediaElement();
      el?.pause();
    },
  };
}

type SpotifyWebPlayerState = {
  paused: boolean;
  position: number;
  duration: number;
};

type SpotifyWebPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (
    eventName: string,
    cb: (state: SpotifyWebPlayerState | { device_id?: string; message?: string } | null) => void,
  ) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyWebPlayerState | null>;
};

async function spotifyApiCall(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function fetchSpotifyAccessToken(): Promise<string> {
  const res = await spotifyApiCall("/api/spotify/token");
  if (!res.ok) throw new Error("spotify_user_token_unavailable");
  const json = (await res.json()) as { ok?: boolean; accessToken?: string };
  if (!json.ok || !json.accessToken) throw new Error("spotify_user_token_invalid");
  return json.accessToken;
}

function ensureSpotifyWebPlaybackSdk(): Promise<NonNullable<Window["Spotify"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("window_unavailable"));
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.scdn.co/spotify-player.js"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => reject(new Error("spotify_script_load_failed"));
      document.head.appendChild(script);
    }
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      if (!window.Spotify?.Player) {
        reject(new Error("spotify_sdk_unavailable"));
        return;
      }
      resolve(window.Spotify);
    };
  });
}

type SpotifyAdapterOptions = {
  trackId: string;
  /** Duração conhecida da faixa (payload), em segundos — fallback quando o SDK ainda não reportou duração. */
  durationHintSec?: number;
  /** Quando definido, força o início no segundo indicado ao dar play. */
  startAtSec?: number;
  /** Iframe visível do Spotify Embed (quando usado na UI). */
  getIframeElement?: () => HTMLIFrameElement | null;
};

export function createSpotifyAdapter(opts: SpotifyAdapterOptions): PlaybackAdapter {
  const { trackId, durationHintSec, startAtSec, getIframeElement } = opts;
  type SpotifyIframeController = {
    loadUri: (uri: string, preferVideo?: boolean, startAt?: number) => void;
    play: () => void;
    pause: () => void;
    resume: () => void;
    seek: (positionMs: number) => void;
    addListener: (
      event: "ready" | "playback_update",
      listener: (ev: { data?: { isPaused?: boolean; position?: number; duration?: number } }) => void,
    ) => void;
    destroy: () => void;
  };
  type SpotifyIframeApi = {
    createController: (
      element: HTMLIFrameElement,
      options: { uri: string; width?: string | number; height?: string | number },
      callback: (controller: SpotifyIframeController) => void,
    ) => void;
  };
  let player: SpotifyWebPlayer | null = null;
  let iframeController: SpotifyIframeController | null = null;
  let deviceId = "";
  let isPaused = true;
  let positionMs = 0;
  let durationMs = 0;
  let hasPrimedPlayback = false;
  let queuedStartMs =
    typeof startAtSec === "number" && Number.isFinite(startAtSec) && startAtSec >= 0
      ? Math.round(startAtSec * 1000)
      : null;
  /** Relógio local entre eventos do Web Playback SDK. */
  let playbackAnchorWallMs = 0;
  let playbackAnchorPositionMs = 0;

  function applyDurationHintIfNeeded() {
    if (durationMs > 0) return;
    if (!Number.isFinite(durationHintSec) || !durationHintSec || durationHintSec <= 0) return;
    durationMs = Math.round(durationHintSec * 1000);
  }

  function syncPlaybackClockFromEmbed(position: number, paused: boolean) {
    if (!Number.isFinite(position) || position < 0) return;
    playbackAnchorWallMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    playbackAnchorPositionMs = position;
    if (paused) {
      positionMs = position;
    }
  }

  function currentPositionMsFromClock(): number {
    if (isPaused) return positionMs;
    const wall = typeof performance !== "undefined" ? performance.now() : Date.now();
    const delta = Math.max(0, wall - playbackAnchorWallMs);
    return playbackAnchorPositionMs + delta;
  }

  function ensureSpotifyIframeApi(): Promise<SpotifyIframeApi> {
    if (typeof window === "undefined") return Promise.reject(new Error("window_unavailable"));
    const w = window as Window & {
      SpotifyIframeApi?: SpotifyIframeApi;
      onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    };
    if (w.SpotifyIframeApi) return Promise.resolve(w.SpotifyIframeApi);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://open.spotify.com/embed/iframe-api/v1";
        script.async = true;
        script.onerror = () => reject(new Error("spotify_iframe_api_load_failed"));
        document.head.appendChild(script);
      }
      const previous = w.onSpotifyIframeApiReady;
      w.onSpotifyIframeApiReady = (api) => {
        previous?.(api);
        w.SpotifyIframeApi = api;
        resolve(api);
      };
    });
  }

  return {
    provider: "spotify",
    async ready() {
      /**
       * O estado vem dos eventos do Iframe API (`playback_update`) ou do Web Playback SDK
       * (`player_state_changed`). Não fazemos polling de `/me/player/currently-playing`:
       * o endpoint `/api/spotify/currently-playing` não existe e o sync cross-device não é
       * suportado nesta UI.
       */
      const iframeEl = getIframeElement?.();
      if (iframeEl) {
        try {
          const iframeApi = await ensureSpotifyIframeApi();
          await new Promise<void>((resolve, reject) => {
            let resolved = false;
            iframeApi.createController(
              iframeEl,
              { uri: `spotify:track:${trackId}`, width: "100%", height: 152 },
              (controller) => {
                iframeController = controller;
                controller.addListener("ready", () => {
                  if (resolved) return;
                  resolved = true;
                  applyDurationHintIfNeeded();
                  resolve();
                });
                controller.addListener("playback_update", (ev) => {
                  const data = ev.data;
                  if (!data) return;
                  const paused = data.isPaused !== false;
                  const position = Number.isFinite(data.position) ? Math.max(0, Number(data.position)) : positionMs;
                  const duration = Number.isFinite(data.duration) ? Math.max(0, Number(data.duration)) : durationMs;
                  isPaused = paused;
                  positionMs = position;
                  if (duration > 0) durationMs = duration;
                  applyDurationHintIfNeeded();
                  syncPlaybackClockFromEmbed(position, paused);
                  if (!paused) hasPrimedPlayback = true;
                });
              },
            );
            window.setTimeout(() => {
              if (resolved) return;
              reject(new Error("spotify_iframe_controller_timeout"));
            }, 5000);
          });
          return;
        } catch {
          iframeController = null;
        }
      }

      try {
        const Spotify = await ensureSpotifyWebPlaybackSdk();
        player = new Spotify.Player({
          name: "cifra.ai Web Player",
          getOAuthToken: async (cb) => {
            try {
              cb(await fetchSpotifyAccessToken());
            } catch {
              cb("");
            }
          },
        });
        await new Promise<void>((resolve) => {
          if (!player) {
            resolve();
            return;
          }
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          player.addListener("initialization_error", () => {
            player = null;
            finish();
          });
          player.addListener("authentication_error", () => {
            player = null;
            finish();
          });
          player.addListener("account_error", () => {
            player = null;
            finish();
          });
          player.addListener("playback_error", () => {
            finish();
          });
          player.addListener("ready", (info) => {
            const data = info as { device_id?: string } | null;
            deviceId = typeof data?.device_id === "string" ? data.device_id : "";
            finish();
          });
          player.addListener("player_state_changed", (state) => {
            const s = state as SpotifyWebPlayerState | null;
            if (!s) return;
            isPaused = s.paused;
            positionMs = s.position;
            durationMs = s.duration;
            applyDurationHintIfNeeded();
            syncPlaybackClockFromEmbed(s.position, s.paused);
            if (!s.paused) hasPrimedPlayback = true;
          });
          void player.connect().then((ok) => {
            if (!ok) {
              player = null;
              finish();
            }
          });
          window.setTimeout(finish, 2500);
        });
        if (player) {
          const current = await player.getCurrentState().catch(() => null);
          if (current) {
            isPaused = current.paused;
            positionMs = current.position;
            durationMs = current.duration;
            applyDurationHintIfNeeded();
            syncPlaybackClockFromEmbed(current.position, current.paused);
            hasPrimedPlayback = true;
          }
        }
      } catch {
        // Sem SDK, mantemos sincronização por polling de currently playing.
      }
    },
    async play() {
      if (iframeController) {
        if (queuedStartMs != null) {
          iframeController.seek(Math.max(0, queuedStartMs));
          positionMs = queuedStartMs;
          queuedStartMs = null;
        }
        iframeController.play();
        isPaused = false;
        hasPrimedPlayback = true;
        syncPlaybackClockFromEmbed(positionMs, false);
        return;
      }
      const payload = {
        ...(deviceId ? { deviceId } : {}),
        spotifyTrackId: trackId,
        ...(queuedStartMs != null ? { positionMs: queuedStartMs } : {}),
      };
      if (player && queuedStartMs == null) {
        try {
          await player.resume();
          isPaused = false;
          hasPrimedPlayback = true;
          return;
        } catch {
          // fallback para API abaixo
        }

      }
      const res = await spotifyApiCall("/api/spotify/play", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("spotify_play_failed");
      hasPrimedPlayback = true;
      isPaused = false;
      if (queuedStartMs != null) {
        positionMs = queuedStartMs;
        playbackAnchorPositionMs = queuedStartMs;
        playbackAnchorWallMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        queuedStartMs = null;
      }
    },
    async pause() {
      if (iframeController) {
        iframeController.pause();
        isPaused = true;
        positionMs = currentPositionMsFromClock();
        return;
      }
      if (player) {
        try {
          await player.pause();
        } catch {
          // fallback below
        }
      }
      const res = await spotifyApiCall("/api/spotify/pause", {
        method: "POST",
        body: JSON.stringify(deviceId ? { deviceId } : {}),
      });
      if (!res.ok) throw new Error("spotify_pause_failed");
      isPaused = true;
      positionMs = currentPositionMsFromClock();
    },
    async seek(seconds: number) {
      if (!Number.isFinite(seconds)) return;
      const ms = Math.max(0, Math.round(seconds * 1000));
      if (iframeController) {
        iframeController.seek(ms);
        positionMs = ms;
        syncPlaybackClockFromEmbed(ms, isPaused);
        return;
      }
      if (player) {
        try {
          await player.seek(ms);
        } catch {
          // fallback via API below
        }
      }
      const res = await spotifyApiCall("/api/spotify/seek", {
        method: "POST",
        body: JSON.stringify({ positionMs: ms, ...(deviceId ? { deviceId } : {}) }),
      });
      if (!res.ok) throw new Error("spotify_seek_failed");
      positionMs = ms;
    },
    getCurrentTime() {
      const ms = currentPositionMsFromClock();
      return ms / 1000;
    },
    getDuration() {
      return durationMs > 0 ? durationMs / 1000 : 0;
    },
    isPlaying() {
      return !isPaused;
    },
    destroy() {
      iframeController?.destroy();
      iframeController = null;
      player?.disconnect();
      player = null;
      deviceId = "";
      isPaused = true;
      positionMs = 0;
      durationMs = 0;
      hasPrimedPlayback = false;
    },
  };
}

export function extractYoutubeVideoId(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").trim();
    if (url.searchParams.get("v")) return url.searchParams.get("v")?.trim() ?? "";
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].trim();
  } catch {
    return "";
  }
  return "";
}
