import { useMemo } from "react";
import { CalendarClock, ExternalLink, Info, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { fmtDate } from "@/i18n/format";
import { useNewsEvents, type NewsEvent } from "@/services/newsEventsApi";
import {
  EVENT_ICON,
  actionKindLabel,
  daysUntil,
  daysWords,
  eventLabel,
  eventMeaning,
  eventSentence,
  isInterpreted,
  isPopularityItem,
} from "./eventText";

/**
 * The props are a fixed contract used by the home page: do not change them.
 */
export interface NewsEventsCardProps {
  /** Symbols the user holds; only events for these are shown. */
  symbols: string[];
  /** Maximum number of events to list. */
  limit?: number;
}

const keyOf = (ev: NewsEvent) => `${ev.id}-${ev.symbol}`;

const ArticleLink = ({ ev }: { ev: NewsEvent }) => {
  const { t } = useT();
  if (!ev.link) return null;
  return (
    <a
      href={ev.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("news.readArticleAria", { symbol: ev.symbol })}
      className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-0 sm:text-xs"
    >
      {t("news.readArticle")}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
};

const EventRow = ({ ev }: { ev: NewsEvent }) => {
  const { t } = useT();
  const interpreted = isInterpreted(ev);
  const Icon = interpreted ? EVENT_ICON[ev.event_type] : Newspaper;
  const label = interpreted ? eventLabel(t, ev) : t("news.newsLabel");
  const sentence = eventSentence(t, ev);
  const meaning = eventMeaning(t, ev);
  const popular = isPopularityItem(ev);

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={interpreted ? "inline-flex items-center gap-1 font-semibold text-primary" : "inline-flex items-center gap-1 font-semibold text-muted-foreground"}>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {label}
        </span>
        <span className="font-mono font-semibold">{ev.symbol}</span>
        {ev.date && <span className="text-muted-foreground">{fmtDate(ev.date)}</span>}
      </div>

      {/* Interpreted: generated sentence. Otherwise: the original headline, nothing added. */}
      <p className="mt-1.5 text-sm font-medium leading-relaxed">{sentence ?? ev.headline}</p>
      {meaning && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meaning}</p>}
      {popular && (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("news.popularCaution")}</span>
        </p>
      )}
      <ArticleLink ev={ev} />
    </li>
  );
};

export const NewsEventsCard = ({ symbols, limit = 8 }: NewsEventsCardProps) => {
  const { t } = useT();
  const wanted = useMemo(() => Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort(), [symbols]);
  const hasSymbols = wanted.length > 0;
  const { data, isLoading, isError, refetch, isFetching } = useNewsEvents(wanted, hasSymbols);

  const upcoming = useMemo(() => {
    const seen = new Set<string>();
    return (data?.upcoming ?? []).filter((ev) => {
      const k = `${ev.symbol}-${ev.action_kind}-${ev.action_date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data]);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    return (data?.events ?? [])
      .filter((ev) => !ev.is_roundup || isPopularityItem(ev))
      .filter((ev) => {
        const k = keyOf(ev);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, limit);
  }, [data, limit]);

  return (
    <Card className="surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Newspaper className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("news.title")}
        </CardTitle>
        <CardDescription className="leading-relaxed">{t("news.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasSymbols ? (
          <p className="py-6 text-center text-sm leading-relaxed text-muted-foreground">{t("news.emptyNoSymbols")}</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {t("common.loading")}
          </div>
        ) : isError ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("news.error")}</p>
            <Button variant="outline" className="min-h-[44px]" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <>
            <section aria-labelledby="news-dates-title">
              <h3 id="news-dates-title" className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("news.datesTitle")}
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{t("news.datesEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((ev) => {
                    const days = daysUntil(ev.action_date!);
                    return (
                      <li key={`${keyOf(ev)}-up`} className="flex items-start justify-between gap-3 rounded-md border border-l-4 border-border border-l-warning bg-card p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-relaxed">
                            <span className="font-mono">{ev.symbol}</span>
                            <span className="text-muted-foreground"> · </span>
                            {actionKindLabel(t, ev.action_kind)}
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">{fmtDate(ev.action_date)}</p>
                        </div>
                        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-semibold">{daysWords(t, days)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="news-recent-title">
              <h3 id="news-recent-title" className="mb-2 text-sm font-semibold">
                {t("news.recentTitle")}
              </h3>
              {recent.length === 0 ? (
                <p className="py-4 text-center text-sm leading-relaxed text-muted-foreground">{t("news.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((ev) => (
                    <EventRow key={keyOf(ev)} ev={ev} />
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("news.sourceNote")} {t("common.notAdvice")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
