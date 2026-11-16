import { useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GLOSSARY_GROUPS, getGlossaryEntry, type GlossaryKey } from "@/lib/glossary";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import enGlossary from "@/i18n/locales/en/glossary";
import neGlossary from "@/i18n/locales/ne/glossary";

const DICTS: Record<string, string>[] = [enGlossary, neGlossary];

/** Lower-case text to search for a term: titles in both languages plus the current explanation. */
const haystack = (key: GlossaryKey, currentText: string) =>
  [...DICTS.map((d) => d[`${key}_title`] ?? ""), key, currentText].join(" ").toLowerCase();

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  /** Term keys currently open */
  open: string[];
  onToggle: (key: GlossaryKey) => void;
}

/** Searchable, grouped list of every glossary word. Each word opens in place. */
export const GlossaryList = ({ query, onQueryChange, open, onToggle }: Props) => {
  const { t } = useT();
  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      GLOSSARY_GROUPS.map((g) => ({
        id: g.id,
        items: g.keys
          .map((key) => ({ key, entry: getGlossaryEntry(key) }))
          .filter(({ key, entry }) => !q || haystack(key, entry.text).includes(q)),
      })).filter((g) => g.items.length > 0),
    [q]
  );
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("learn.searchPlaceholder")}
          aria-label={t("learn.searchLabel")}
          className="h-11 pl-9 pr-11 text-base sm:text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label={t("learn.clearSearch")}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {count === 0 ? t("learn.noResults", { q: query.trim() }) : t("learn.resultCount", { n: count })}
      </p>

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`glossary-group-${g.id}`} className="space-y-2">
          <h3 id={`glossary-group-${g.id}`} className="text-sm font-semibold text-muted-foreground">
            {t(`learn.group_${g.id}`)}
          </h3>
          <ul className="surface divide-y divide-border">
            {g.items.map(({ key, entry }) => {
              const isOpen = !!q || open.includes(key);
              const panelId = `term-panel-${key}`;
              return (
                <li key={key} id={`term-${key}`} className="scroll-mt-20">
                  <button
                    type="button"
                    onClick={() => onToggle(key)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    disabled={!!q}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-medium leading-relaxed disabled:cursor-default"
                  >
                    <span className="min-w-0">{entry.title}</span>
                    {!q && <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground", isOpen && "rotate-180")} aria-hidden="true" />}
                  </button>
                  {isOpen && (
                    <div id={panelId} className="space-y-2 px-4 pb-4 text-sm leading-relaxed">
                      <p className="text-muted-foreground">{entry.text}</p>
                      {entry.example && (
                        <div className="border-t border-border pt-2">
                          <p className="text-xs font-semibold">{t("learn.example")}</p>
                          <p className="mt-0.5">{entry.example}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
