import {
  clearChordElement,
  drawChordIntoElement,
  getChordDiagramVariationCount,
  resolveChordDiagramVariation,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";

import { normalizeChordDiagramPrefKey } from "@/lib/cifra/chord-diagram/chord-diagram-pref-key";

/**
 * Hover na pré-visualização DOM (`cifra-view`): diagrama svguitar; clique fixa o painel e permite trocar variação.
 */
const HOVER_TARGET_CLASS = "cifra-chord-diagram-hover-target";

export type ChordDiagramHoverOptions = {
  /** Índice da variação preferida (0-based), actualizado quando as prefs chegam do servidor. */
  getVariationIndex: (normalizedLabelKey: string) => number;
  /** Opcional: persistir escolha (utilizador autenticado). */
  persistVariation?: (normalizedLabelKey: string, variationIndex: number) => void;
};

export function attachChordDiagramHoverDom(
  symbolEl: HTMLElement,
  label: string,
  getOptions?: () => ChordDiagramHoverOptions | undefined,
): () => void {
  const count = getChordDiagramVariationCount(label);
  if (count === 0) return () => {};

  const prefKey = normalizeChordDiagramPrefKey(label);

  symbolEl.classList.add(HOVER_TARGET_CLASS);
  symbolEl.setAttribute("tabindex", "0");

  let popup: HTMLDivElement | null = null;
  let chartHost: HTMLDivElement | null = null;
  let titleEl: HTMLParagraphElement | null = null;
  let controlsEl: HTMLDivElement | null = null;
  let variationLabelEl: HTMLSpanElement | null = null;
  let btnPrev: HTMLButtonElement | null = null;
  let btnNext: HTMLButtonElement | null = null;

  let pinned = false;
  let currentVariation = 0;
  let hideTimer: number | null = null;
  let persistTimer: number | null = null;
  let ro: ResizeObserver | null = null;
  let onScroll: (() => void) | null = null;
  let onResize: (() => void) | null = null;
  let onDocPointerDown: ((ev: MouseEvent) => void) | null = null;
  let onKeyDown: ((ev: KeyboardEvent) => void) | null = null;

  function getOpts() {
    return getOptions?.();
  }

  function clampVariation(i: number) {
    return Math.max(0, Math.min(count - 1, Math.floor(i)));
  }

  function readPreferredIndex() {
    const v = getOpts()?.getVariationIndex?.(prefKey);
    if (typeof v === "number" && Number.isFinite(v)) return clampVariation(v);
    return 0;
  }

  function position() {
    if (!popup || !symbolEl.isConnected) return;
    const r = symbolEl.getBoundingClientRect();
    const pw = popup.offsetWidth || 200;
    const ph = popup.offsetHeight || 140;
    let left = r.left + r.width / 2 - pw / 2;
    let top = r.top - ph - 14;
    if (top < 8) top = r.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      getOpts()?.persistVariation?.(prefKey, currentVariation);
    }, 240);
  }

  function renderVariation(idx: number) {
    currentVariation = clampVariation(idx);
    const resolved = resolveChordDiagramVariation(label, currentVariation);
    if (!resolved || !chartHost || !titleEl) return;
    titleEl.textContent = resolved.displayLabel;
    drawChordIntoElement(chartHost, resolved);
    if (variationLabelEl) variationLabelEl.textContent = `${currentVariation + 1} / ${count}`;
    if (btnPrev) btnPrev.disabled = currentVariation <= 0;
    if (btnNext) btnNext.disabled = currentVariation >= count - 1;
  }

  function syncControlsVisibility() {
    if (!controlsEl) return;
    controlsEl.style.display = pinned && count > 1 ? "flex" : "none";
  }

  function attachGlobalListeners() {
    if (onDocPointerDown) return;
    onDocPointerDown = (ev: MouseEvent) => {
      if (!pinned || !popup) return;
      const t = ev.target as Node;
      if (popup.contains(t) || symbolEl.contains(t)) return;
      pinned = false;
      if (popup) {
        popup.classList.remove("pointer-events-auto");
        popup.classList.add("pointer-events-none");
      }
      syncControlsVisibility();
      removeGlobalListeners();
      scheduleHide();
    };
    onKeyDown = (ev: KeyboardEvent) => {
      if (!pinned || ev.key !== "Escape") return;
      pinned = false;
      if (popup) {
        popup.classList.remove("pointer-events-auto");
        popup.classList.add("pointer-events-none");
      }
      syncControlsVisibility();
      removeGlobalListeners();
      scheduleHide();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function removeGlobalListeners() {
    if (onDocPointerDown) {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      onDocPointerDown = null;
    }
    if (onKeyDown) {
      document.removeEventListener("keydown", onKeyDown, true);
      onKeyDown = null;
    }
  }

  function destroyPopup() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    removeGlobalListeners();
    ro?.disconnect();
    ro = null;
    if (onScroll) {
      window.removeEventListener("scroll", onScroll, true);
      onScroll = null;
    }
    if (onResize) {
      window.removeEventListener("resize", onResize);
      onResize = null;
    }
    if (chartHost) {
      clearChordElement(chartHost);
      chartHost = null;
    }
    titleEl = null;
    controlsEl = null;
    variationLabelEl = null;
    btnPrev = null;
    btnNext = null;
    popup?.remove();
    popup = null;
    pinned = false;
  }

  function buildPopupShell() {
    destroyPopup();

    currentVariation = readPreferredIndex();

    popup = document.createElement("div");
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Diagrama do acorde");
    popup.className =
      "pointer-events-none fixed z-[200] flex flex-col items-center gap-1.5 rounded-[10px] border border-white/[0.07] bg-[#12121f] px-4 py-3 text-center shadow-lg";

    titleEl = document.createElement("p");
    titleEl.className =
      "m-0 w-full text-center font-mono text-[15px] font-semibold leading-tight tracking-tight text-[#0fd2c1]";

    chartHost = document.createElement("div");
    chartHost.className =
      "flex min-h-[128px] min-w-[112px] shrink-0 items-center justify-center [&_svg]:block";

    controlsEl = document.createElement("div");
    controlsEl.className =
      "mt-0.5 flex w-full max-w-[220px] items-center justify-center gap-2";
    controlsEl.style.display = "none";

    btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.className =
      "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/12 bg-[#0c0c16] text-sm font-semibold text-cifra-text transition hover:border-cifra-teal/40 hover:text-cifra-teal disabled:cursor-not-allowed disabled:opacity-35";
    btnPrev.setAttribute("aria-label", "Variação anterior");
    btnPrev.textContent = "‹";

    variationLabelEl = document.createElement("span");
    variationLabelEl.className =
      "min-w-[52px] text-center font-mono text-[11px] tabular-nums text-[#a8a8c0]";

    btnNext = document.createElement("button");
    btnNext.type = "button";
    btnNext.className = btnPrev.className;
    btnNext.setAttribute("aria-label", "Variação seguinte");
    btnNext.textContent = "›";

    const hintEl = document.createElement("p");
    hintEl.dataset.cifraDiagramHint = "1";
    hintEl.className = "m-0 text-[10px] leading-tight text-[#6a6a88]";
    hintEl.textContent = "";

    controlsEl.appendChild(btnPrev);
    controlsEl.appendChild(variationLabelEl);
    controlsEl.appendChild(btnNext);

    btnPrev.addEventListener("click", (ev) => {
      ev.stopPropagation();
      renderVariation(currentVariation - 1);
      schedulePersist();
    });
    btnNext.addEventListener("click", (ev) => {
      ev.stopPropagation();
      renderVariation(currentVariation + 1);
      schedulePersist();
    });

    popup.appendChild(titleEl);
    popup.appendChild(chartHost);
    popup.appendChild(controlsEl);
    popup.appendChild(hintEl);

    document.body.appendChild(popup);

    renderVariation(currentVariation);
    syncControlsVisibility();

    ro = new ResizeObserver(() => position());
    ro.observe(popup);
    onScroll = () => position();
    window.addEventListener("scroll", onScroll, true);
    onResize = () => position();
    window.addEventListener("resize", onResize);
  }

  function applyPinnedUi(active: boolean) {
    if (!popup) return;
    pinned = active;
    if (active) {
      popup.classList.remove("pointer-events-none");
      popup.classList.add("pointer-events-auto");
      syncControlsVisibility();
      attachGlobalListeners();
    } else {
      popup.classList.remove("pointer-events-auto");
      popup.classList.add("pointer-events-none");
      syncControlsVisibility();
      removeGlobalListeners();
    }
    const hint = popup.querySelector("[data-cifra-diagram-hint='1']") as HTMLParagraphElement | null;
    if (hint) {
      hint.textContent = active ? "Clique outra vez no acorde ou fora para fechar." : "";
    }
  }

  const scheduleHide = () => {
    if (pinned) return;
    hideTimer = window.setTimeout(() => {
      destroyPopup();
    }, 120);
  };

  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const onEnter = () => {
    cancelHide();
    if (popup && pinned) return;
    if (!popup) {
      buildPopupShell();
      applyPinnedUi(false);
      position();
      return;
    }
    position();
  };

  const onLeave = () => {
    if (pinned) return;
    scheduleHide();
  };

  const onChordClick = (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    cancelHide();
    if (!popup) {
      currentVariation = readPreferredIndex();
      buildPopupShell();
      applyPinnedUi(true);
      position();
      return;
    }
    if (pinned) {
      applyPinnedUi(false);
      scheduleHide();
    } else {
      applyPinnedUi(true);
      position();
    }
  };

  const onChordKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    symbolEl.click();
  };

  symbolEl.addEventListener("mouseenter", onEnter);
  symbolEl.addEventListener("mouseleave", onLeave);
  symbolEl.addEventListener("click", onChordClick);
  symbolEl.addEventListener("keydown", onChordKey);

  return () => {
    symbolEl.removeEventListener("mouseenter", onEnter);
    symbolEl.removeEventListener("mouseleave", onLeave);
    symbolEl.removeEventListener("click", onChordClick);
    symbolEl.removeEventListener("keydown", onChordKey);
    symbolEl.classList.remove(HOVER_TARGET_CLASS);
    symbolEl.removeAttribute("tabindex");
    destroyPopup();
  };
}
