import { Link, useNavigate } from "react-router-dom";
import { Keys } from "@/components/Kbd";
import { jumpToSection } from "@/lib/jumpTo";
import { findShortcut } from "@/lib/shortcuts";
import { useT } from "@/i18n";

const LINKS: { labelKey: string; route: string; section?: string }[] = [
  { labelKey: "nav.holdings", route: "/", section: "holdings" },
  { labelKey: "nav.watchlist", route: "/", section: "watchlist" },
  { labelKey: "nav.news", route: "/", section: "news" },
  { labelKey: "nav.dividends", route: "/dividends" },
  { labelKey: "nav.risk", route: "/risk" },
  { labelKey: "nav.research", route: "/research" },
];

/** Plain "Jump to" links for mouse and touch users; key caps show on wide screens only. */
export const JumpLinks = () => {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <nav aria-label={t("nav.jumpTo")} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      <span className="text-muted-foreground">{t("nav.jumpTo")}</span>
      {LINKS.map((l) => {
        const sc = findShortcut(l.route, l.section);
        const href = l.route + (l.section ? `#${l.section}` : "");
        return (
          <Link
            key={l.labelKey}
            to={href}
            onClick={(e) => {
              // Already on this page: the hash may not change, so scroll directly.
              if (l.route === window.location.pathname && l.section) {
                e.preventDefault();
                navigate(href, { replace: true });
                jumpToSection(l.section);
              }
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 font-medium lg:min-h-0 text-primary hover:underline"
          >
            {t(l.labelKey)}
            {sc && <Keys keys={sc.keys} className="hidden lg:inline-flex" />}
          </Link>
        );
      })}
    </nav>
  );
};
