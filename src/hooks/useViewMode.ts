import { useCallback, useEffect, useState } from "react";

/** "simple" is the plain-language view for new investors; "advanced" shows every chart and table. */
export type ViewMode = "simple" | "advanced";

const STORAGE_KEY = "pi_view_mode";
const EVENT = "pi:view-mode";

const read = (): ViewMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "advanced" ? "advanced" : "simple";
  } catch {
    return "simple";
  }
};

/** Shared across components: changing it in one place updates every user of the hook. */
export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>(read);

  useEffect(() => {
    const sync = () => setModeState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { mode, setMode, isSimple: mode === "simple" };
}
