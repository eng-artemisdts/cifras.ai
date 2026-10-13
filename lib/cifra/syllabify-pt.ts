/**
 * Separação silábica do português (regras ortográficas usuais), usada para posicionar acordes
 * sobre a sílaba em que a harmonia muda. Pontuação e apóstrofos ficam colados à sílaba vizinha;
 * a concatenação das sílabas devolvidas é sempre igual à palavra original.
 *
 * Regras:
 * - cada sílaba tem um núcleo vocálico; ditongos decrescentes (ai, ei, oi, ui, au, eu, iu, ou),
 *   nasais (ãe, ão, õe, ãi) e «qu/gu + vogal» ficam juntos; vogais fortes seguidas (a, e, o)
 *   e vogal fraca + forte (di-a, ri-o) formam hiato;
 * - uma consoante entre vogais vai para a sílaba seguinte (ca-sa);
 * - encontros inseparáveis (consoante + l/r, ch, lh, nh) vão juntos para a seguinte (pa-lha, li-vro);
 * - nos demais grupos, só a última consoante vai para a seguinte (car-ro, nas-cer, pers-pi-caz).
 */

const VOWELS = "aeiouáéíóúâêôãõàüy";
const STRONG = "aeoáéóâêôãõà";
const WEAK = "iuíúü";
const INSEPARABLE = new Set([
  "bl", "br", "cl", "cr", "dl", "dr", "fl", "fr", "gl", "gr", "kl", "kr",
  "pl", "pr", "tl", "tr", "vl", "vr", "ch", "lh", "nh",
]);

const isLetter = (c: string) => /\p{L}/u.test(c);
const isVowel = (c: string) => VOWELS.includes(c);

/** Duas vogais seguidas pertencem ao mesmo núcleo (ditongo) — `prev` é a letra antes de `a`. */
function sameNucleus(a: string, b: string, prev: string | undefined): boolean {
  const pair = a + b;
  if (["ãe", "ão", "õe", "ãi", "õi"].includes(pair)) return true;
  // qu/gu + vogal: o «u» é parte do onset, não núcleo.
  if (a === "u" && (prev === "q" || prev === "g") && STRONG.includes(b)) return true;
  if (STRONG.includes(a) && STRONG.includes(b)) return false; // hiato: le-ão, po-e-ta
  if (WEAK.includes(a) && STRONG.includes(b)) return false; // hiato: di-a, ri-o
  if (STRONG.includes(a) && WEAK.includes(b)) {
    // decrescente (pai, meu); acento na fraca indica hiato (sa-í-da, ba-ú)
    return !"íú".includes(b);
  }
  if (WEAK.includes(a) && WEAK.includes(b)) return a !== b; // fui, ruim → ditongo; xi-i
  return false;
}

export function syllabifyPt(word: string): string[] {
  if (!word) return [];
  const chars = [...word];
  const lower = chars.map((c) => c.toLowerCase());

  // Índices de letras e núcleos vocálicos (grupos de vogais da mesma sílaba).
  const letterIdx: number[] = [];
  for (let i = 0; i < chars.length; i++) if (isLetter(chars[i]!)) letterIdx.push(i);
  const nuclei: { from: number; to: number }[] = [];
  for (let k = 0; k < letterIdx.length; k++) {
    const i = letterIdx[k]!;
    if (!isVowel(lower[i]!)) continue;
    const prevLetter = k > 0 ? lower[letterIdx[k - 1]!] : undefined;
    const last = nuclei[nuclei.length - 1];
    if (last && last.to === letterIdx[k - 1]) {
      const prevInNucleus = lower[last.to]!;
      const beforePrev = k > 1 ? lower[letterIdx[k - 2]!] : undefined;
      if (sameNucleus(prevInNucleus, lower[i]!, beforePrev) && last.to - last.from < 2) {
        last.to = i;
        continue;
      }
    }
    // «qu/gu»: o u já foi tratado como onset quando seguido de vogal forte
    if (lower[i] === "u" && (prevLetter === "q" || prevLetter === "g")) {
      const next = k + 1 < letterIdx.length ? lower[letterIdx[k + 1]!] : undefined;
      if (next && STRONG.includes(next)) {
        nuclei.push({ from: i, to: i });
        // o próximo laço junta a vogal forte a este núcleo via sameNucleus
        continue;
      }
    }
    nuclei.push({ from: i, to: i });
  }
  if (nuclei.length <= 1) return [word];

  // Ponto de corte entre núcleos consecutivos (índice em `chars` onde começa a sílaba seguinte).
  const cuts: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const end = nuclei[n]!.to;
    const nextStart = nuclei[n + 1]!.from;
    const cons = letterIdx.filter((i) => i > end && i < nextStart);
    let cut: number;
    if (cons.length === 0) {
      cut = nextStart; // hiato
    } else if (cons.length === 1) {
      cut = cons[0]!;
    } else {
      const lastTwo = lower[cons[cons.length - 2]!]! + lower[cons[cons.length - 1]!]!;
      cut = INSEPARABLE.has(lastTwo) ? cons[cons.length - 2]! : cons[cons.length - 1]!;
    }
    cuts.push(cut);
  }

  const out: string[] = [];
  let from = 0;
  for (const c of cuts) {
    out.push(chars.slice(from, c).join(""));
    from = c;
  }
  out.push(chars.slice(from).join(""));
  return out.filter((s) => s.length > 0);
}
