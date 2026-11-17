import { useT, type Calendar } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  /** "BS | AD" for the header bar; "Nepali date (BS) | English date (AD)" in the menu */
  compact?: boolean;
  className?: string;
}

/** Two-option date-system switch. Independent of language; one tap changes every date. */
export const DateSystemToggle = ({ compact = false, className }: Props) => {
  const { calendar, setCalendar, t } = useT();
  const options: { value: Calendar; full: string; short: string }[] = [
    { value: "bs", full: t("common.bsFull"), short: t("common.bsShort") },
    { value: "ad", full: t("common.adFull"), short: t("common.adShort") },
  ];

  return (
    <div
      role="group"
      aria-label={t("common.dateSystem")}
      className={cn("inline-flex shrink-0 items-center rounded-md border border-border bg-card p-0.5", className)}
    >
      {options.map((o) => {
        const active = calendar === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={compact ? o.full : undefined}
            title={compact ? o.full : undefined}
            onClick={() => {
              if (!active) setCalendar(o.value);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-[5px] text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "h-11 min-w-[40px] px-1.5 lg:h-8 lg:min-w-[32px]" : "h-11 px-3 lg:h-8",
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
