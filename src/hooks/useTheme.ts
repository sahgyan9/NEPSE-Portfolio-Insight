import { useSyncExternalStore } from "react";

/**
 * Theme: Light, Dark or System. Light is the default for a first visit.
 * The same logic runs once in index.html before first paint so there is no flash.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "pi_theme";
const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#f8fafc", dark: "#080c0a" };

const readPreference = (): ThemePreference => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // storage blocked: fall back to the default
  }
  return "light";
};

const systemDark = (): boolean => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

const resolve = (pref: ThemePreference): ResolvedTheme => (pref === "system" ? (systemDark() ? "dark" : "light") : pref);

let preference: ThemePreference = readPreference();
let resolved: ResolvedTheme = resolve(preference);
const listeners = new Set<() => void>();

const apply = () => {
  resolved = resolve(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[resolved]));
  listeners.forEach((l) => l());
};

export const setThemePreference = (next: ThemePreference) => {
  preference = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // choice lasts for this visit only
  }
  apply();
};

/** Light -> Dark -> System -> Light */
export const cycleTheme = () => {
  const order: ThemePreference[] = ["light", "dark", "system"];
  setThemePreference(order[(order.indexOf(preference) + 1) % order.length]);
};

if (typeof window !== "undefined") {
  apply();
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (preference === "system") apply();
    });
  } catch {
    // older browsers: System is then evaluated on load only
  }
  // Keep tabs in sync
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) {
      preference = readPreference();
      apply();
    }
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useTheme = () => {
  const pref = useSyncExternalStore(subscribe, () => preference);
  const res = useSyncExternalStore(subscribe, () => resolved);
  return { theme: pref, resolvedTheme: res, setTheme: setThemePreference };
};
