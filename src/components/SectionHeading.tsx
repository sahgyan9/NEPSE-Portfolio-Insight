import type { ReactNode } from "react";
import { Keys } from "@/components/Kbd";
import { shortcutForRoute, shortcutForSection } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  hint?: string;
  /** Route and optional section id used to look up the shortcut shown at the right edge */
  route: string;
  section?: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: ReactNode;
}

/** Heading with its shortcut shown as muted key caps (desktop only). */
export const SectionHeading = ({ title, hint, route, section, as: Tag = "h2", className, children }: Props) => {
  const sc = section ? shortcutForSection(route, section) : shortcutForRoute(route);
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Tag className="text-lg font-semibold tracking-tight outline-none sm:text-xl" tabIndex={-1}>
          {title}
        </Tag>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        {sc && <Keys keys={sc.keys} className="mt-1.5 hidden md:inline-flex" />}
      </div>
    </div>
  );
};
