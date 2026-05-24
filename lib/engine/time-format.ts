// @ts-nocheck
/**
 * Formatação de tempo para UI (m:ss).
 *
 * @module time-format
 */

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Duração efetiva: elemento audio se válido, senão fallback (ex.: último acorde).
 *
 * @param {HTMLMediaElement|null} audio
 * @param {boolean} audioReady
 * @param {number} fallbackSeconds
 * @returns {number}
 */
export function getEffectiveDuration(audio, audioReady, fallbackSeconds) {
  const d = audio?.duration;
  if (audioReady && d && Number.isFinite(d) && d > 0) return d;
  return fallbackSeconds > 0 ? fallbackSeconds : 1;
}
