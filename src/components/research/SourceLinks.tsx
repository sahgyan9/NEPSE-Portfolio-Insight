import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ResearchSource } from "@/data/researchGuide";
import { useT } from "@/i18n";

/** External links open in a new tab; in-app links stay in the app; sources without a URL are plain text. */
export const SourceLinks = ({ sources }: { sources: ResearchSource[] }) => {
  const { t } = useT();
  if (sources.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm leading-relaxed">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
          {s.url.startsWith("/") ? (
            <Link to={s.url} className="font-medium text-primary hover:underline">
              {s.name}
            </Link>
          ) : s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {s.name}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">{t("research.opensNewTab")}</span>
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
