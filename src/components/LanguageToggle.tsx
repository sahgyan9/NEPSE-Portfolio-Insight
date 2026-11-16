import { useT, type Lang } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  /** "ने | EN" for the phone header bar; "नेपाली | English" elsewhere */
  compact?: boolean;
  className?: string;
}

/** Two-option language switch. One tap changes every screen. */
export const LanguageToggle = ({ compact = false, className }: Props) => {
  const { lang, setLang, t } = useT();
  const options: { value: Lang; full: string; short: string }[] = [
    { value: "ne", full: t("common.nepali"), short: t("common.nepaliShort") },
    { value: "en", full: t("common.english"), short: t("common.englishShort") },
  ];

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn("inline-flex shrink-0 items-center rounded-md border border-border bg-card p-0.5", className)}
    >
      {options.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            aria-label={compact ? o.full : undefined}
            title={compact ? o.full : undefined}
            onClick={() => {
              if (!active) setLang(o.value);
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
