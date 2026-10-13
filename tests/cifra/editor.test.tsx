import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { CifraTranscriptionEditor } from "@/components/cifra/cifra-transcription-editor";

import { chord, line } from "./helpers";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom não tem ResizeObserver (usado pelos menus/tooltips).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function mountEditor() {
  const host = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <CifraTranscriptionEditor
        initial={{
          chords: [chord("C", 16, 18), chord("G", 18, 20)],
          lyrics: [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5]])],
          sections: [{ start: 15, end: 21, label: "verse" }],
          meta: {},
        }}
      />,
    );
  });
  // As secções começam recolhidas: abre-as.
  for (const btn of host.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')) {
    act(() => btn.click());
  }
  return { host, root };
}

describe("editor: mesmo posicionamento do leitor", () => {
  it("mostra a palavra em sílabas com o acorde sobre a sílaba em que muda", () => {
    const { host, root } = mountEditor();
    const cell = host.querySelector<HTMLElement>('[data-cifra-word-cell="0-1"]')!;
    expect(cell).toBeTruthy();
    const pieces = [...cell.querySelectorAll<HTMLElement>("[data-cifra-syllable]")].map((el) => {
      const chips = [...el.querySelectorAll("[data-cifra-chord-slot]")].map((c) => c.textContent);
      return `${chips.length ? `[${chips.join(" ")}]` : ""}${el.querySelector("[data-cifra-word]")!.textContent}`;
    });
    expect(pieces.join("")).toBe("a[G]mor");
    act(() => root.unmount());
  });

  it("os rótulos das partes aparecem em português", () => {
    const { host, root } = mountEditor();
    expect(host.textContent).toContain("Verso");
    act(() => root.unmount());
  });
});
