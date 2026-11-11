/**
 * Single registry of keyboard shortcuts. The key handler, the help dialog, the header tooltips
 * and the hints on section headings all read from here so they cannot disagree.
 */

export type ShortcutGroup = "Navigate" | "Actions";
export type ShortcutAction = "open-search" | "open-help" | "cycle-theme";

export interface Shortcut {
  id: string;
  /** Key sequence: ["g", "h"] means press g, then h within the sequence window */
  keys: string[];
  label: string;
  group: ShortcutGroup;
  /** Route to open (navigate shortcuts) */
  route?: string;
  /** Section id on that route to scroll to */
  section?: string;
  action?: ShortcutAction;
}

/** Time allowed between the two keys of a sequence */
export const SEQUENCE_WINDOW_MS = 1000;
/** Prefix key for "go to" sequences */
export const GO_PREFIX = "g";

export const SHORTCUTS: Shortcut[] = [
  { id: "go-overview", keys: ["g", "o"], label: "Overview", group: "Navigate", route: "/" },
  { id: "go-holdings", keys: ["g", "h"], label: "Holdings", group: "Navigate", route: "/", section: "holdings" },
  { id: "go-watchlist", keys: ["g", "w"], label: "Watchlist", group: "Navigate", route: "/", section: "watchlist" },
  { id: "go-news", keys: ["g", "n"], label: "News", group: "Navigate", route: "/", section: "news" },
  { id: "go-risk", keys: ["g", "r"], label: "Risk", group: "Navigate", route: "/risk" },
  { id: "go-money-vs-risk", keys: ["g", "k"], label: "Risk: money versus risk", group: "Navigate", route: "/risk", section: "money-vs-risk" },
  { id: "go-correlation", keys: ["g", "l"], label: "Risk: correlation", group: "Navigate", route: "/risk", section: "correlation" },
  { id: "go-research", keys: ["g", "c"], label: "Research checklist", group: "Navigate", route: "/research" },
  { id: "go-dividends", keys: ["g", "d"], label: "Dividends", group: "Navigate", route: "/dividends" },
  { id: "go-quarterly", keys: ["g", "q"], label: "Quarterly results", group: "Navigate", route: "/quarterly" },
  { id: "go-fundamentals", keys: ["g", "f"], label: "Fundamentals (valuation)", group: "Navigate", route: "/fundamentals" },
  { id: "go-market", keys: ["g", "m"], label: "Market", group: "Navigate", route: "/market" },
  { id: "go-screen", keys: ["g", "i"], label: "Sector screen", group: "Navigate", route: "/intelligence" },
  { id: "search", keys: ["/"], label: "Search for a stock", group: "Actions", action: "open-search" },
  { id: "theme", keys: ["t"], label: "Switch theme (Light, Dark, System)", group: "Actions", action: "cycle-theme" },
  { id: "help", keys: ["?"], label: "Show keyboard shortcuts", group: "Actions", action: "open-help" },
];

export const findShortcut = (route: string, section?: string): Shortcut | undefined =>
  SHORTCUTS.find((s) => s.route === route && s.section === section);

/** Shortcut that jumps to a section on a given route, for hints on headings. */
export const shortcutForSection = (route: string, section: string) => findShortcut(route, section);

/** Shortcut for a route's top, for header tooltips and page titles. */
export const shortcutForRoute = (route: string) => findShortcut(route, undefined);

export const hrefFor = (s: Shortcut): string => (s.route ?? "/") + (s.section ? `#${s.section}` : "");

/** Window events used to reach components that own their own open state. */
export const EVENT_OPEN_SEARCH = "pi:open-search";
export const EVENT_OPEN_HELP = "pi:open-help";
