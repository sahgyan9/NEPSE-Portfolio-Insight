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
  /** Translation key for the label shown in the help dialog */
  labelKey: string;
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
  { id: "go-overview", keys: ["g", "o"], labelKey: "nav.overview", group: "Navigate", route: "/" },
  { id: "go-holdings", keys: ["g", "h"], labelKey: "nav.holdings", group: "Navigate", route: "/", section: "holdings" },
  { id: "go-watchlist", keys: ["g", "w"], labelKey: "nav.watchlist", group: "Navigate", route: "/", section: "watchlist" },
  { id: "go-news", keys: ["g", "n"], labelKey: "nav.news", group: "Navigate", route: "/", section: "news" },
  { id: "go-risk", keys: ["g", "r"], labelKey: "nav.risk", group: "Navigate", route: "/risk" },
  { id: "go-money-vs-risk", keys: ["g", "k"], labelKey: "nav.scMoneyVsRisk", group: "Navigate", route: "/risk", section: "money-vs-risk" },
  { id: "go-correlation", keys: ["g", "l"], labelKey: "nav.scCorrelation", group: "Navigate", route: "/risk", section: "correlation" },
  { id: "go-research", keys: ["g", "c"], labelKey: "nav.scResearch", group: "Navigate", route: "/research" },
  { id: "go-dividends", keys: ["g", "d"], labelKey: "nav.dividends", group: "Navigate", route: "/dividends" },
  { id: "go-quarterly", keys: ["g", "q"], labelKey: "nav.scQuarterly", group: "Navigate", route: "/quarterly" },
  { id: "go-fundamentals", keys: ["g", "f"], labelKey: "nav.scValuation", group: "Navigate", route: "/fundamentals" },
  { id: "go-market", keys: ["g", "m"], labelKey: "nav.market", group: "Navigate", route: "/market" },
  { id: "go-screen", keys: ["g", "i"], labelKey: "nav.sectorScreen", group: "Navigate", route: "/intelligence" },
  { id: "search", keys: ["/"], labelKey: "nav.scSearch", group: "Actions", action: "open-search" },
  { id: "theme", keys: ["t"], labelKey: "nav.scTheme", group: "Actions", action: "cycle-theme" },
  { id: "help", keys: ["?"], labelKey: "nav.scHelp", group: "Actions", action: "open-help" },
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
export const EVENT_OPEN_PORTFOLIO = "pi:open-portfolio";
