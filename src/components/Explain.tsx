import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

interface ExplainProps {
  /** Key into the glossary, or pass custom text */
  term?: GlossaryKey;
  text?: string;
  title?: string;
  className?: string;
}

/** Small info icon that opens a plain-language definition. */
export const Explain = ({ term, text, title, className }: ExplainProps) => {
  const entry = term ? GLOSSARY[term] : undefined;
  const body = text ?? entry?.text;
  const heading = title ?? entry?.title;
  if (!body) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does ${heading ?? "this"} mean?`}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="start">
        {heading && <p className="mb-1 font-semibold">{heading}</p>}
        <p className="leading-relaxed text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
};
