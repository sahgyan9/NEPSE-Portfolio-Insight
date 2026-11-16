import { Link, useLocation } from "react-router-dom";
import { BarChart3, Briefcase, GraduationCap, Gift, Menu, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";
import { jumpToSection, scrollToTop } from "@/lib/jumpTo";
import { cn } from "@/lib/utils";

interface Props {
  /** Opens the side sheet that lists every page */
  onOpenMore: () => void;
}

interface Tab {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  route: string;
  section?: string;
}

const TABS: Tab[] = [
  { key: "overview", labelKey: "nav.overview", icon: BarChart3, route: "/" },
  { key: "holdings", labelKey: "nav.myShares", icon: Briefcase, route: "/", section: "holdings" },
  { key: "learn", labelKey: "nav.learn", icon: GraduationCap, route: "/learn" },
  { key: "dividends", labelKey: "nav.dividends", icon: Gift, route: "/dividends" },
];

const itemClass =
  "relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-medium leading-normal transition-colors";

/** Indicator bar shown on top of the active tab, so the state is not shown by colour alone. */
const Indicator = () => <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-primary" />;

/** Fixed bottom navigation for phones and tablets (below lg). Rendered by Header on every page. */
export const MobileTabBar = ({ onOpenMore }: Props) => {
  const { t } = useT();
  const { pathname, hash } = useLocation();
  const onHome = pathname === "/";
  const sectionHash = hash.slice(1);

  const isActive = (tab: Tab): boolean => {
    if (tab.section) return pathname === tab.route && sectionHash === tab.section;
    if (tab.route === "/") return onHome && sectionHash !== "holdings";
    return pathname === tab.route;
  };
  const moreActive = !TABS.some(isActive);

  return (
    <nav
      aria-label={t("nav.mobileNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          const href = tab.route + (tab.section ? `#${tab.section}` : "");
          return (
            <li key={tab.key} className="flex flex-1">
              <Link
                to={href}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  // Same place already: the URL does not change, so scroll directly.
                  if (pathname !== tab.route) return;
                  if (tab.section && sectionHash === tab.section) jumpToSection(tab.section);
                  else if (!tab.section && !hash) scrollToTop();
                }}
                className={cn(itemClass, active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                {active && <Indicator />}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="whitespace-nowrap">{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            aria-haspopup="dialog"
            className={cn(itemClass, moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {moreActive && <Indicator />}
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="whitespace-nowrap">{t("nav.more")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};
