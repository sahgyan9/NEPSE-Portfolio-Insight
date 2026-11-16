import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getGlossaryEntry, type GlossaryKey } from "@/lib/glossary";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

interface ExplainProps {
  /** Key into the glossary, or pass custom text */
  term?: GlossaryKey;
  text?: string;
  title?: string;
  /** Custom example, shown on its own line. Glossary terms bring their own. */
  example?: string;
  className?: string;
}

/** Small info icon that opens a plain-language definition on tap. */
export const Explain = ({ term, text, title, example, className }: ExplainProps) => {
  const { t } = useT();
  const entry = term ? getGlossaryEntry(term) : undefined;
  const body = text ?? entry?.text;
  const heading = title ?? entry?.title;
  const sample = example ?? (text ? undefined : entry?.example);
  if (!body) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={heading ? t("glossary.ui_whatIs", { term: heading }) : t("glossary.ui_whatIsThis")}
          className={cn(
            // The visible icon stays small; the padding gives a larger tap area without shifting text.
            "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground before:absolute before:-inset-3 before:content-[''] hover:text-foreground",
            className
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] text-sm" align="start" collisionPadding={16}>
        {heading && <p className="mb-1 font-semibold leading-relaxed">{heading}</p>}
        <p className="leading-relaxed text-muted-foreground">{body}</p>
        {sample && (
          <div className="mt-2 border-t border-border pt-2">
            <p className="text-xs font-semibold text-foreground">{t("glossary.ui_example")}</p>
            <p className="mt-0.5 leading-relaxed text-foreground">{sample}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
