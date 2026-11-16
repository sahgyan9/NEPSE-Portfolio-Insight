/**
 * Language support (Nepali / English).
 *
 * Text lives in namespace files:  src/i18n/locales/<lang>/<namespace>.ts
 * Each file default-exports a flat object of strings:
 *
 *     export default { title: "Overview", greeting: "Hello {name}" };
 *
 * Files are discovered automatically, so adding a namespace needs no
 * registration. Look a string up as "<namespace>.<key>":
 *
 *     const { t } = useT();
 *     t("home.title");
 *     t("home.greeting", { name: "Sita" });
 *
 * Lookup order: current language, then English, then the key itself.
 * Outside React (plain helper modules) use translate() and getLang().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, Fragment, type ReactNode } from "react";

export type Lang = "ne" | "en";
export type TVars = Record<string, string | number>;

const STORAGE_KEY = "pi_lang";
const DEFAULT_LANG: Lang = "ne";

type Dict = Record<string, string>;
const modules = import.meta.glob("./locales/*/*.ts", { eager: true }) as Record<string, { default: Dict }>;

const DICTS: Record<Lang, Record<string, Dict>> = { ne: {}, en: {} };
for (const [path, mod] of Object.entries(modules)) {
  const m = path.match(/\.\/locales\/(ne|en)\/([^/]+)\.ts$/);
  if (m && mod?.default) DICTS[m[1] as Lang][m[2]] = mod.default;
}

const readStoredLang = (): Lang => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ne" || v === "en") return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANG;
};

let currentLang: Lang = readStoredLang();

/** Current language, for code that runs outside React. */
export const getLang = (): Lang => currentLang;

const lookup = (lang: Lang, key: string): string | undefined => {
  const dot = key.indexOf(".");
  if (dot < 0) return undefined;
  return DICTS[lang][key.slice(0, dot)]?.[key.slice(dot + 1)];
};

/** Translate a key in the current language. Safe to call anywhere. */
export const translate = (key: string, vars?: TVars): string => {
  const raw = lookup(currentLang, key) ?? lookup("en", key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
};

/** Pick between two inline strings without a dictionary entry. Prefer t() for UI text. */
export const pick = (ne: string, en: string): string => (currentLang === "ne" ? ne : en);

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: TVars) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: currentLang,
  setLang: () => {},
  t: translate,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t: translate }), [lang, setLang]);

  // Keyed on the language so every screen re-renders with the new text and number formats.
  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
};

export const useT = () => useContext(LanguageContext);
