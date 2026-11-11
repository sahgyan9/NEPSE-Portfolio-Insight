import type { ReactNode } from "react";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Shared tooltip shell used by all Recharts tooltips. */
export const TooltipBox = ({ title, rows, footer }: { title?: ReactNode; rows: TooltipRow[]; footer?: ReactNode }) => (
  <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
    {title && <p className="mb-1 font-semibold text-foreground">{title}</p>}
    <div className="space-y-0.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-mono text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
    {footer && <div className="mt-1 text-muted-foreground">{footer}</div>}
  </div>
);
