/**
 * Nome em português das partes da música devolvidas pela Music.ai (em inglês), como se lê numa
 * cifra: Intro, Verso, Pré-refrão, Refrão, Ponte, Solo, Final. Números de ocorrência são mantidos
 * («Verse 2» → «Verso 2»); rótulos desconhecidos ficam como estão.
 */

const NAMES: [RegExp, string][] = [
  [/^pre[\s_-]?chorus$/, "Pré-refrão"],
  [/^post[\s_-]?chorus$/, "Pós-refrão"],
  [/^chorus$/, "Refrão"],
  [/^refrain$/, "Refrão"],
  [/^verse$/, "Verso"],
  [/^intro$/, "Intro"],
  [/^outro$/, "Final"],
  [/^ending$/, "Final"],
  [/^bridge$/, "Ponte"],
  [/^instrumental$/, "Instrumental"],
  [/^interlude$/, "Interlúdio"],
  [/^break$/, "Interlúdio"],
  [/^solo$/, "Solo"],
  [/^hook$/, "Refrão"],
];

export function sectionDisplayName(label: string | null | undefined): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "—";
  const m = raw.match(/^(.*?)(?:\s*(\d+))?$/);
  const base = (m?.[1] ?? raw).trim().toLowerCase();
  const num = m?.[2];
  for (const [re, name] of NAMES) {
    if (re.test(base)) return num ? `${name} ${num}` : name;
  }
  return raw;
}
