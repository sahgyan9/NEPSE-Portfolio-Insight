import { useCallback, useEffect, useState } from "react";

const KEY = "pi_research_ticks_v1";

type Store = Record<string, string[]>;

const readStore = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
};

const writeStore = (store: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage can be blocked or full; ticks then last only for this visit.
  }
};

/** Checklist ticks saved in localStorage, kept separately for each symbol (or sector). */
export const useResearchTicks = (subject: string) => {
  const [ticked, setTicked] = useState<string[]>(() => readStore()[subject] ?? []);

  useEffect(() => {
    setTicked(readStore()[subject] ?? []);
  }, [subject]);

  const toggle = useCallback(
    (id: string) => {
      setTicked((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        const store = readStore();
        store[subject] = next;
        writeStore(store);
        return next;
      });
    },
    [subject]
  );

  return { ticked, toggle, isTicked: (id: string) => ticked.includes(id) };
};
