const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

let cancelPending: (() => void) | null = null;

/**
 * Scroll to a section by id and move focus to its heading. Data loads asynchronously, so wait
 * (up to `timeoutMs`) for the element to exist and for the page height to settle.
 */
export const jumpToSection = (id: string, timeoutMs = 10000): void => {
  cancelPending?.();
  const start = performance.now();
  let stopped = false;
  let timer = 0;
  cancelPending = () => {
    stopped = true;
    window.clearTimeout(timer);
  };

  const go = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    const heading = el.matches("h1,h2,h3,h4") ? el : el.querySelector<HTMLElement>("h1,h2,h3,h4");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  };

  // Charts and tables above the target finish loading after the first scroll and push it down.
  // Keep correcting for a few seconds, and stop as soon as the user scrolls or presses a key.
  const settle = (el: HTMLElement) => {
    const events = ["wheel", "touchstart", "mousedown", "keydown"] as const;
    const end = performance.now() + 4000;
    const stop = () => {
      events.forEach((ev) => window.removeEventListener(ev, onUser));
      window.clearTimeout(timer);
    };
    const onUser = () => {
      stopped = true;
      stop();
    };
    events.forEach((ev) => window.addEventListener(ev, onUser, { passive: true }));
    cancelPending = () => {
      stopped = true;
      stop();
    };
    const check = () => {
      if (stopped) return;
      const target = document.getElementById(id) ?? el;
      const top = target.getBoundingClientRect().top;
      const wanted = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (Math.abs(top - wanted) > 4) target.scrollIntoView({ behavior: "auto", block: "start" });
      const heading = target.matches("h1,h2,h3,h4") ? target : target.querySelector<HTMLElement>("h1,h2,h3,h4");
      if (heading && document.activeElement !== heading && (document.activeElement === document.body || !document.activeElement)) {
        heading.focus({ preventScroll: true });
      }
      if (performance.now() < end) timer = window.setTimeout(check, 250);
      else stop();
    };
    timer = window.setTimeout(check, 400);
  };

  const tick = () => {
    if (stopped) return;
    const el = document.getElementById(id);
    if (el) {
      go(el);
      settle(el);
      return;
    }
    if (performance.now() - start < timeoutMs) timer = window.setTimeout(tick, 100);
  };
  tick();
};

export const scrollToTop = (): void => {
  cancelPending?.();
  window.scrollTo({ top: 0, behavior: "auto" });
};
