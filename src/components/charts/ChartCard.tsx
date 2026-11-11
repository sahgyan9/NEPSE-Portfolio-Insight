import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Explain } from "@/components/Explain";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  /** State the takeaway question, e.g. "Where is my risk out of proportion to my money?" */
  title: string;
  subtitle?: string;
  explain?: GlossaryKey;
  explainText?: string;
  /** Right-aligned controls (toggles, selects) */
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  /** Fixed body height keeps the layout stable while data loads */
  height?: number;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Card wrapper giving every chart the same title, loading and empty treatment. */
export const ChartCard = ({
  title,
  subtitle,
  explain,
  explainText,
  actions,
  loading,
  empty,
  emptyMessage = "Not enough data to draw this chart yet.",
  height,
  footer,
  className,
  children,
}: ChartCardProps) => (
  <section className={cn("surface p-4 sm:p-5", className)}>
    <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground sm:text-base">
          {title}
          {(explain || explainText) && (
            <Explain term={explain} text={explainText} title={explainText ? title : undefined} />
          )}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
    <div style={height ? { minHeight: height } : undefined}>
      {loading ? (
        <Skeleton className="w-full" style={{ height: height ?? 240 }} />
      ) : empty ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-sm text-muted-foreground"
          style={{ height: height ?? 160 }}
        >
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
    {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
  </section>
);
