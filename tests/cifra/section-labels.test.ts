import { describe, expect, it } from "vitest";

import { sectionDisplayName } from "@/lib/cifra/section-labels";

describe("sectionDisplayName", () => {
  it.each([
    ["chorus", "Refrão"],
    ["Chorus", "Refrão"],
    ["Verse 2", "Verso 2"],
    ["pre-chorus", "Pré-refrão"],
    ["Bridge", "Ponte"],
    ["outro", "Final"],
    ["Intro", "Intro"],
    ["Solo", "Solo"],
    ["Coda", "Coda"],
    ["", "—"],
  ])("%s → %s", (label, expected) => {
    expect(sectionDisplayName(label)).toBe(expected);
  });
});
