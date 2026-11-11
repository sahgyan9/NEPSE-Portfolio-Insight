import { Link, useNavigate } from "react-router-dom";
import { Keys } from "@/components/Kbd";
import { jumpToSection } from "@/lib/jumpTo";
import { findShortcut } from "@/lib/shortcuts";

const LINKS: { label: string; route: string; section?: string; }[] = [
  { label: "Holdings", route: "/", section: "holdings" },
  { label: "Watchlist", route: "/", section: "watchlist" },
  { label: "News", route: "/", section: "news" },
  { label: "Dividends", route: "/dividends" },
  { label: "Risk", route: "/risk" },
  { label: "Research", route: "/research" },
];

/** Plain "Jump to" links for mouse and touch users; key caps show on desktop. */
export const JumpLinks = () => {
  const navigate = useNavigate();
  return (
    <nav aria-label="Jump to" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      <span className="text-muted-foreground">Jump to</span>
      {LINKS.map((l) => {
        const sc = findShortcut(l.route, l.section);
        const href = l.route + (l.section ? `#${l.section}` : "");
        return (
          <Link
            key={l.label}
            to={href}
            onClick={(e) => {
              // Already on this page: the hash may not change, so scroll directly.
              if (l.route === window.location.pathname && l.section) {
                e.preventDefault();
                navigate(href, { replace: true });
                jumpToSection(l.section);
              }
            }}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            {l.label}
            {sc && <Keys keys={sc.keys} className="hidden md:inline-flex" />}
          </Link>
        );
      })}
    </nav>
  );
};
