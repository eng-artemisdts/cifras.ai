/** Modelo canónico alinhado à POC musicai-cifra-demo e ao Track do Schubert. */

export type MusicAiSection = {
  start: number;
  end: number;
  label: string;
};

export type MusicAiChordEvent = {
  start: number;
  end: number;
  start_bar?: number;
  start_beat?: number;
  end_bar?: number;
  end_beat?: number;
  chord_majmin?: string;
  chord_simple_pop?: string;
  chord_basic_pop?: string;
  chord_simple_jazz?: string;
  chord_basic_jazz?: string;
  chord_complex_pop?: string;
  chord_complex_nashville?: string;
  chord_simple_nashville?: string;
  chord_basic_nashville?: string;
  bass?: string | null;
};

export type MusicAiLyricWord = {
  word: string;
  start?: number;
  end?: number;
};

export type MusicAiLyricSegment = {
  start?: number;
  end?: number;
  text?: string;
  language?: string;
  words?: MusicAiLyricWord[];
};

export type MusicAiMeta = {
  id?: string;
  name?: string;
  sourcePathParam?: string;
  trackId?: string;
  lyricsVariant?: string;
  audioUrl?: string;
  duration_seconds?: number;
};

export type MusicAiDemoPayload = {
  chords?: MusicAiChordEvent[];
  lyrics?: MusicAiLyricSegment[];
  sections?: MusicAiSection[];
  meta?: MusicAiMeta;
  chordTimeOffsetSec?: number;
};

export type TimedWord = {
  text: string;
  start: number | null;
  end: number | null;
  g: number;
};
