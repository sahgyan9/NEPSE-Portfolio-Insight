import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Gift,
  PiggyBank,
  FileBarChart,
  Brain,
  ShieldAlert,
  ClipboardCheck,
  Menu,
  Briefcase,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  TrendingUp,
  Activity,
  MoreHorizontal,
  ChevronDown,
  GraduationCap,
  Database,
  Power,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Keys } from "@/components/Kbd";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { useViewMode } from "@/hooks/useViewMode";
import { useT } from "@/i18n";
import { jumpToSection } from "@/lib/jumpTo";
import { EVENT_OPEN_HELP, EVENT_OPEN_PORTFOLIO, findShortcut } from "@/lib/shortcuts";
import { StockSearch } from "./StockSearch";
import { PortfolioManager } from "./PortfolioManager";
import { NewsTicker } from "./NewsTicker";
import { LanguageToggle } from "./LanguageToggle";
import { DateSystemToggle } from "./DateSystemToggle";
import { ViewModeToggle } from "./ViewModeToggle";
import { MobileTabBar } from "./MobileTabBar";
import { StopAppDialog } from "./StopAppDialog";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

interface NavItem {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  route: string;
  section?: string;
}

const ITEMS: Record<string, NavItem> = {
  overview: { key: "overview", labelKey: "nav.overview", icon: BarChart3, route: "/" },
  learn: { key: "learn", labelKey: "nav.learn", icon: GraduationCap, route: "/learn" },
  holdings: { key: "holdings", labelKey: "nav.holdings", icon: Briefcase, route: "/", section: "holdings" },
  myShares: { key: "holdings", labelKey: "nav.myShares", icon: Briefcase, route: "/", section: "holdings" },
  risk: { key: "risk", labelKey: "nav.risk", icon: ShieldAlert, route: "/risk" },
  research: { key: "research", labelKey: "nav.research", icon: ClipboardCheck, route: "/research" },
  dividends: { key: "dividends", labelKey: "nav.dividends", icon: Gift, route: "/dividends" },
  sip: { key: "sip", labelKey: "nav.sip", icon: PiggyBank, route: "/sip" },
  quarterly: { key: "quarterly", labelKey: "nav.quarterly", icon: FileBarChart, route: "/quarterly" },
  valuation: { key: "valuation", labelKey: "nav.valuation", icon: TrendingUp, route: "/fundamentals" },
  market: { key: "market", labelKey: "nav.market", icon: Activity, route: "/market" },
  screen: { key: "screen", labelKey: "nav.sectorScreen", icon: Brain, route: "/intelligence" },
  tools: { key: "tools", labelKey: "nav.tools", icon: MoreHorizontal, route: "/misc" },
};

// Simple view: the five places a new investor needs; everything else sits under "More".
const SIMPLE_PRIMARY = [ITEMS.overview, ITEMS.myShares, ITEMS.learn, ITEMS.dividends, ITEMS.risk];
const SIMPLE_MORE = [ITEMS.sip, ITEMS.research, ITEMS.quarterly, ITEMS.valuation, ITEMS.market, ITEMS.screen, ITEMS.tools];
// Advanced view: the full list.
const ADVANCED_PRIMARY = [ITEMS.overview, ITEMS.learn, ITEMS.holdings, ITEMS.risk, ITEMS.research, ITEMS.dividends, ITEMS.quarterly];
const ADVANCED_MORE = [ITEMS.sip, ITEMS.valuation, ITEMS.market, ITEMS.screen, ITEMS.tools];
// Advanced items that sit in the bar only from xl up; between lg and xl they move into "More" so the bar never overflows.
const WIDE_ONLY = new Set(["quarterly"]);

const hrefOf = (item: NavItem) => item.route + (item.section ? `#${item.section}` : "");

const THEME_OPTIONS: { value: ThemePreference; labelKey: string; icon: LucideIcon }[] = [
  { value: "light", labelKey: "common.themeLight", icon: Sun },
  { value: "dark", labelKey: "common.themeDark", icon: Moon },
  { value: "system", labelKey: "common.themeSystem", icon: Monitor },
];

const ThemeMenu = () => {
  const { t } = useT();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("common.theme")}>
              <Icon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          {t("common.theme")} <Keys keys={["t"]} />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          {THEME_OPTIONS.map((o) => {
            const OIcon = o.icon;
            return (
              <DropdownMenuRadioItem key={o.value} value={o.value} className="gap-2">
                <OIcon className="h-4 w-4" /> {t(o.labelKey)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Theme choice as a plain radio list, for the phone menu. */
const ThemeList = () => {
  const { t } = useT();
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label={t("common.theme")} className="space-y-1">
      {THEME_OPTIONS.map((o) => {
        const OIcon = o.icon;
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
            )}
          >
            <OIcon className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">{t(o.labelKey)}</span>
            <span
              aria-hidden="true"
              className={cn(
                "h-4 w-4 rounded-full border-2",
                active ? "border-primary bg-primary shadow-[inset_0_0_0_2px_hsl(var(--card))]" : "border-border"
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

export const Header = ({ onRefresh, isRefreshing }: HeaderProps) => {
  const { t } = useT();
  const { isSimple } = useViewMode();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Set when the menu's "Manage my shares" is tapped; the dialog opens once the sheet has closed.
  const openPortfolioAfterClose = useRef(false);
  const [stopOpen, setStopOpen] = useState(false);
  // Same pattern for "Stop app": open the confirm dialog only after the sheet has closed.
  const stopAfterClose = useRef(false);

  const primary = isSimple ? SIMPLE_PRIMARY : ADVANCED_PRIMARY;
  const more = isSimple ? SIMPLE_MORE : ADVANCED_MORE;
  const wideOnly = isSimple ? [] : primary.filter((i) => WIDE_ONLY.has(i.key));
  const hashId = location.hash.slice(1);

  const isActive = (item: NavItem): boolean => {
    if (location.pathname !== item.route) return false;
    if (item.section) return hashId === item.section;
    return !(item.route === "/" && hashId === "holdings");
  };
  const isMoreActive = more.some(isActive);

  // Same page and same section: the URL does not change, so scroll directly.
  const onSamePage = (item: NavItem) => {
    if (item.section && location.pathname === item.route && hashId === item.section) jumpToSection(item.section);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-4 xl:gap-6">
            <Link to="/" className="flex shrink-0 items-center" aria-label={t("common.appName")}>
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
            </Link>

            {/* Desktop navigation. Icons appear only when there is room for them. */}
            <nav aria-label={t("nav.mainNav")} className="hidden items-center lg:flex xl:gap-0.5">
              {primary.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const sc = findShortcut(item.route, item.section);
                const wide = !isSimple && WIDE_ONLY.has(item.key);
                const link = (
                  <Link
                    to={hrefOf(item)}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onSamePage(item)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-2 text-sm font-medium transition-colors xl:px-2.5",
                      wide && "hidden xl:inline-flex",
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="hidden h-4 w-4 min-[1400px]:block" aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                );
                if (!sc) return <span key={item.key} className="contents">{link}</span>;
                return (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                      {t(item.labelKey)} <Keys keys={sc.keys} />
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Secondary destinations grouped under one menu to keep the bar lean */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("gap-1 px-2 xl:px-2.5", isMoreActive && "bg-primary/10 text-primary")}
                  >
                    {t("nav.more")}
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {wideOnly.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.key} asChild className="xl:hidden">
                        <Link to={hrefOf(item)} className={cn("cursor-pointer gap-2", isActive(item) && "text-primary")}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {t(item.labelKey)}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  {more.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <DropdownMenuItem key={item.key} asChild>
                        <Link
                          to={hrefOf(item)}
                          aria-current={active ? "page" : undefined}
                          className={cn("cursor-pointer gap-2", active && "text-primary")}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {t(item.labelKey)}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          {/* Phones: search, language, refresh, menu. Desktop adds manage, view, shortcuts, theme. */}
          <div className="flex shrink-0 items-center gap-1.5 xl:gap-2">
            <StockSearch />

            <PortfolioManager onPortfolioChange={onRefresh} triggerClassName="hidden lg:inline-flex" />

            <ViewModeToggle compact className="hidden lg:inline-flex" />

            <LanguageToggle compact className="xl:hidden" />
            <LanguageToggle className="hidden xl:inline-flex" />
            <DateSystemToggle compact className="hidden lg:inline-flex" />

            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 xl:inline-flex"
              aria-label={t("nav.keyboardShortcuts")}
              title={`${t("nav.keyboardShortcuts")} (?)`}
              onClick={() => window.dispatchEvent(new CustomEvent(EVENT_OPEN_HELP))}
            >
              <Keyboard className="h-4 w-4" />
            </Button>

            <div className="hidden lg:block">
              <ThemeMenu />
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label={t("nav.refreshData")}
              title={t("nav.refreshData")}
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-11 w-11 hover:bg-primary/10 lg:h-9 lg:w-9"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-9 w-9 hover:bg-destructive/10 hover:text-destructive lg:inline-flex"
                  aria-label={t("nav.stopApp")}
                  onClick={() => setStopOpen(true)}
                >
                  <Power className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("nav.stopApp")}</TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 lg:hidden"
              aria-label={t("nav.openMenu")}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Phone and tablet menu: every page plus the settings that do not fit in the bar */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="flex w-[300px] max-w-[85vw] flex-col border-r border-border bg-card p-0"
          onCloseAutoFocus={(e) => {
            if (stopAfterClose.current) {
              stopAfterClose.current = false;
              e.preventDefault();
              setStopOpen(true);
              return;
            }
            if (!openPortfolioAfterClose.current) return;
            openPortfolioAfterClose.current = false;
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(EVENT_OPEN_PORTFOLIO));
          }}
        >
          <div className="flex items-center gap-3 border-b border-border p-5 pr-12">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <SheetTitle className="text-base font-semibold">{t("common.appName")}</SheetTitle>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            <nav aria-label={t("nav.menuPages")} className="space-y-1">
              {[...primary, ...more].map((item, i) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <div key={item.key}>
                    {i === primary.length && (
                      <p className="mb-1 mt-3 px-3 text-xs font-medium text-muted-foreground">{t("nav.morePages")}</p>
                    )}
                    <Link
                      to={hrefOf(item)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        onSamePage(item);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {t(item.labelKey)}
                    </Link>
                  </div>
                );
              })}
            </nav>

            <section aria-label={t("nav.menuSettings")} className="space-y-4 border-t border-border pt-4">
              <h2 className="px-3 text-xs font-medium text-muted-foreground">{t("nav.menuSettings")}</h2>
              <div className="space-y-1.5 px-3">
                <p className="text-sm font-medium">{t("common.language")}</p>
                <LanguageToggle className="flex w-full [&>button]:flex-1" />
              </div>
              <div className="space-y-1.5 px-3">
                <p className="text-sm font-medium">{t("common.dateSystem")}</p>
                <DateSystemToggle className="flex w-full [&>button]:flex-1" />
              </div>
              <div className="space-y-1.5 px-3">
                <p className="text-sm font-medium">{t("common.viewMode")}</p>
                <ViewModeToggle className="flex w-full" />
              </div>
              <div className="space-y-1.5">
                <p className="px-3 text-sm font-medium">{t("common.theme")}</p>
                <ThemeList />
              </div>
              <button
                type="button"
                onClick={() => {
                  openPortfolioAfterClose.current = true;
                  setMenuOpen(false);
                }}
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                {t("nav.pmOpen")}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopAfterClose.current = true;
                  setMenuOpen(false);
                }}
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {t("nav.stopApp")}
              </button>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <StopAppDialog open={stopOpen} onOpenChange={setStopOpen} />

      <NewsTicker />
      <MobileTabBar onOpenMore={() => setMenuOpen(true)} />
    </>
  );
};
