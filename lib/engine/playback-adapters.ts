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
    YT?: {
      Player: new (element: HTMLElement, config: Record<string, unknown>) => YouTubePlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
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

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

function ensureYoutubeApi(): Promise<NonNullable<Window["YT"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("window_unavailable"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("youtube_script_load_failed"));
      document.head.appendChild(script);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("youtube_api_unavailable"));
    };
  });
}

type YouTubeAdapterOptions = {
  hostEl: HTMLElement;
  videoId: string;
};

export function createYoutubeAdapter(opts: YouTubeAdapterOptions): PlaybackAdapter {
  const { hostEl, videoId } = opts;
  let player: YouTubePlayer | null = null;

  return {
    provider: "youtube",
    async ready() {
      const YT = await ensureYoutubeApi();
      await new Promise<void>((resolve, reject) => {
        player = new YT.Player(hostEl, {
          videoId,
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: () => resolve(),
            onError: () => reject(new Error("youtube_player_error")),
          },
        });
      });
    },
    async play() {
      player?.playVideo();
    },
    async pause() {
      player?.pauseVideo();
    },
    async seek(seconds: number) {
      if (!player || !Number.isFinite(seconds)) return;
      player.seekTo(Math.max(0, seconds), true);
    },
    getCurrentTime() {
      if (!player) return 0;
      const t = player.getCurrentTime();
      return Number.isFinite(t) ? t : 0;
    },
    getDuration() {
      if (!player) return 0;
      const d = player.getDuration();
      return Number.isFinite(d) && d > 0 ? d : 0;
    },
    isPlaying() {
      if (!player || !window.YT?.PlayerState) return false;
      return player.getPlayerState() === window.YT.PlayerState.PLAYING;
    },
    destroy() {
      player?.destroy();
      player = null;
      hostEl.innerHTML = "";
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
  hostEl: HTMLElement;
  trackId: string;
  /** Duração conhecida da faixa (payload), em segundos — fallback quando embed manda duration=0. */
  durationHintSec?: number;
};

type SpotifyEmbedPlaybackEvent = CustomEvent<{
  trackId?: string;
  isPaused?: boolean;
  positionMs?: number;
  durationMs?: number;
}>;

export function createSpotifyAdapter(opts: SpotifyAdapterOptions): PlaybackAdapter {
  const { trackId, durationHintSec } = opts;
  let player: SpotifyWebPlayer | null = null;
  let deviceId = "";
  let isPaused = true;
  let positionMs = 0;
  let durationMs = 0;
  let hasPrimedPlayback = false;
  let onEmbedPlaybackRef: ((raw: Event) => void) | null = null;
  /** Relógio local derivado dos eventos do embed (sem polling na API Spotify). */
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

  return {
    provider: "spotify",
    async ready() {
      const onEmbedPlayback = (raw: Event) => {
        const evt = raw as SpotifyEmbedPlaybackEvent;
        if (evt.detail?.trackId !== trackId) return;
        if (typeof evt.detail?.isPaused === "boolean") {
          isPaused = evt.detail.isPaused;
        }
        if (Number.isFinite(evt.detail?.durationMs) && Number(evt.detail?.durationMs) > 0) {
          durationMs = Number(evt.detail?.durationMs);
        }
        applyDurationHintIfNeeded();

        const nextPos = Number.isFinite(evt.detail?.positionMs) ? Number(evt.detail?.positionMs) : undefined;
        if (typeof nextPos === "number") {
          syncPlaybackClockFromEmbed(nextPos, isPaused);
          if (isPaused) positionMs = nextPos;
          else positionMs = nextPos;
        } else if (isPaused === false) {
          // Sem posição explícita: inicia relógio local no play para não ficar preso em 0:00.
          syncPlaybackClockFromEmbed(positionMs > 0 ? positionMs : 0, false);
        }
        if (isPaused === false) hasPrimedPlayback = true;
      };
      onEmbedPlaybackRef = onEmbedPlayback;
      window.addEventListener("cifra:spotify-embed-playback", onEmbedPlayback as EventListener);

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
      await new Promise<void>((resolve, reject) => {
        if (!player) {
          reject(new Error("spotify_player_init_failed"));
          return;
        }
        player.addListener("initialization_error", () => reject(new Error("spotify_initialization_error")));
        player.addListener("authentication_error", () => reject(new Error("spotify_authentication_error")));
        player.addListener("account_error", () => reject(new Error("spotify_account_error")));
        player.addListener("playback_error", () => reject(new Error("spotify_playback_error")));
        player.addListener("ready", (info) => {
          const data = info as { device_id?: string } | null;
          deviceId = typeof data?.device_id === "string" ? data.device_id : "";
          resolve();
        });
        player.addListener("player_state_changed", (state) => {
          const s = state as SpotifyWebPlayerState | null;
          if (!s) return;
          isPaused = s.paused;
          positionMs = s.position;
          durationMs = s.duration;
        });
        void player.connect().then((ok) => {
          if (!ok) reject(new Error("spotify_connect_failed"));
        });
      });
      const current = await player.getCurrentState().catch(() => null);
      if (current) {
        isPaused = current.paused;
        positionMs = current.position;
        durationMs = current.duration;
        hasPrimedPlayback = true;
      }

      // Garante que o embed carregue a faixa correta para eventos/play local.
      window.dispatchEvent(new CustomEvent("cifra:spotify-embed-command", { detail: { action: "load", trackId } }));
    },
    async play() {
      window.dispatchEvent(new CustomEvent("cifra:spotify-embed-command", { detail: { action: "play", trackId } }));
      const payload = {
        ...(deviceId ? { deviceId } : {}),
        spotifyTrackId: trackId,
      };
      if (player) {
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
    },
    async pause() {
      window.dispatchEvent(new CustomEvent("cifra:spotify-embed-command", { detail: { action: "pause", trackId } }));
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
      window.dispatchEvent(
        new CustomEvent("cifra:spotify-embed-command", {
          detail: { action: "seek", trackId, positionMs: ms },
        }),
      );
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
      player?.disconnect();
      window.dispatchEvent(new CustomEvent("cifra:spotify-embed-command", { detail: { action: "pause", trackId } }));
      if (onEmbedPlaybackRef) {
        window.removeEventListener("cifra:spotify-embed-playback", onEmbedPlaybackRef as EventListener);
      }
      onEmbedPlaybackRef = null;
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
