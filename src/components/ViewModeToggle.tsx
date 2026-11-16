import { useT } from "@/i18n";
import { useViewMode, type ViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

interface Props {
  /** Short labels ("Simple | Advanced") for the desktop header; full labels in the phone menu */
  compact?: boolean;
  className?: string;
}

/** Labelled two-option switch between the simple and the advanced view. */
export const ViewModeToggle = ({ compact = false, className }: Props) => {
  const { t } = useT();
  const { mode, setMode } = useViewMode();
  const options: { value: ViewMode; full: string; short: string }[] = [
    { value: "simple", full: t("common.simpleView"), short: t("common.simpleShort") },
    { value: "advanced", full: t("common.advancedView"), short: t("common.advancedShort") },
  ];

  return (
    <div
      role="group"
      aria-label={t("common.viewMode")}
      className={cn("inline-flex shrink-0 items-center rounded-md border border-border bg-card p-0.5", className)}
    >
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={compact ? o.full : undefined}
            onClick={() => {
              if (!active) setMode(o.value);
            }}
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-[5px] px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "h-8 px-2.5" : "h-11",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {compact ? o.short : o.full}
          </button>
        );
      })}
    </div>
  );
};
