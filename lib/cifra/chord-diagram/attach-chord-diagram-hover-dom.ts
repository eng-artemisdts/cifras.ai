import {
  clearChordElement,
  drawChordIntoElement,
  resolveChordDiagram,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";

/**
 * Hover na pré-visualização DOM (`cifra-view`): popup fixo com o mesmo diagrama svguitar do editor.
 */
const HOVER_TARGET_CLASS = "cifra-chord-diagram-hover-target";

export function attachChordDiagramHoverDom(symbolEl: HTMLElement, label: string): () => void {
  const resolved = resolveChordDiagram(label);
  if (!resolved) return () => { };

  symbolEl.classList.add(HOVER_TARGET_CLASS);

  let popup: HTMLDivElement | null = null;
  let chartHost: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let ro: ResizeObserver | null = null;
  let onScroll: (() => void) | null = null;
  let onResize: (() => void) | null = null;

  const position = () => {
    if (!popup || !symbolEl.isConnected) return;
    const r = symbolEl.getBoundingClientRect();
    const pw = popup.offsetWidth || 200;
    const ph = popup.offsetHeight || 140;
    let left = r.left + r.width / 2 - pw / 2;
    let top = r.top - ph - 14;
    if (top < 8) top = r.bottom;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  };

  const destroyPopup = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
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
    popup?.remove();
    popup = null;
  };

  const show = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (popup) return;

    popup = document.createElement("div");
    popup.setAttribute("role", "tooltip");
    popup.className =
      "pointer-events-none fixed z-[200] flex flex-col items-center gap-1 rounded-[10px] border border-white/[0.07] bg-[#12121f] px-4 py-3 text-center shadow-lg";

    const titleEl = document.createElement("p");
    titleEl.textContent = resolved.displayLabel;
    titleEl.className =
      "m-0 w-full text-center font-mono text-[15px] font-semibold leading-tight tracking-tight text-[#0fd2c1]";

    chartHost = document.createElement("div");
    chartHost.className =
      "flex min-h-[128px] min-w-[112px] shrink-0 items-center justify-center [&_svg]:block";
    popup.appendChild(titleEl);
    popup.appendChild(chartHost);
    document.body.appendChild(popup);

    drawChordIntoElement(chartHost, resolved);
    position();

    ro = new ResizeObserver(() => position());
    ro.observe(popup);
    onScroll = () => position();
    window.addEventListener("scroll", onScroll, true);
    onResize = () => position();
    window.addEventListener("resize", onResize);
  };

  const scheduleHide = () => {
    hideTimer = setTimeout(() => {
      destroyPopup();
    }, 100);
  };

  const onEnter = () => show();
  const onLeave = () => scheduleHide();

  symbolEl.addEventListener("mouseenter", onEnter);
  symbolEl.addEventListener("mouseleave", onLeave);

  return () => {
    symbolEl.removeEventListener("mouseenter", onEnter);
    symbolEl.removeEventListener("mouseleave", onLeave);
    symbolEl.classList.remove(HOVER_TARGET_CLASS);
    destroyPopup();
  };
}
