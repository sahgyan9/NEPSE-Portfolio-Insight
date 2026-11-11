import { ExternalLink } from "lucide-react";
import type { ResearchSource } from "@/data/researchGuide";

/** External links open in a new tab; sources without a URL are shown as plain text. */
export const SourceLinks = ({ sources }: { sources: ResearchSource[] }) => {
  if (sources.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {sources.map((s, i) => (
        <li key={`${s.name}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {s.name}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="font-medium">{s.name}</span>
          )}
          <span className="text-muted-foreground">{s.what}</span>
        </li>
      ))}
    </ul>
  );
};
