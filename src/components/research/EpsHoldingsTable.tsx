import { Link } from "react-router-dom";
import { Explain } from "@/components/Explain";
import { useEpsInsights, type EpsFlag, type EpsHolding, type EpsSkipped } from "@/services/epsInsightsApi";
import { epsFlagText, epsNotes, skipReasonText } from "@/lib/epsText";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { dash, fmt, fmtPct, fmtRs, flagColor, flagIcon, flagLabel } from "@/components/research/EpsInsightCard";

const FlagChip = ({ flag }: { flag: EpsFlag }) => {
  const Icon = flagIcon(flag);
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={epsFlagText(flag)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", flagColor(flag))} aria-hidden />
      {flagLabel(flag)}
    </span>
  );
};

const th = "whitespace-nowrap px-2 py-2 text-right text-xs font-medium text-muted-foreground";
const td = "px-2 py-2 text-right font-mono text-sm";

const Notes = ({ h }: { h: EpsHolding }) => {
  const notes = epsNotes(h);
  return h.flags.length === 0 && notes.length === 0 ? (
    <span className="text-sm text-muted-foreground">{dash}</span>
  ) : (
    <div className="flex flex-col gap-0.5">
      {h.flags.map((f) => (
        <FlagChip key={f.code} flag={f} />
      ))}
      {notes.map((n) => (
        <span key={n} className="text-xs text-muted-foreground">
          {n}
        </span>
      ))}
    </div>
  );
};

/** "Not included" sentences, one per reason. Older insights without reason codes use the old grouping. */
const skippedText = (skipped: EpsSkipped[], t: (key: string, vars?: Record<string, string | number>) => string): string => {
  if (skipped.length === 0) return "";
  if (skipped.every((s) => s.reason_code)) {
    const groups = new Map<string, string[]>();
    for (const s of skipped) {
      const reason = skipReasonText(s) ?? t("research.eps_skippedNoData");
      groups.set(reason, [...(groups.get(reason) ?? []), s.symbol]);
    }
    return [...groups.entries()].map(([reason, list]) => t("research.eps_skipped", { list: list.join(", "), reason })).join(" ");
  }
  return t("research.eps_skipped", {
    list: skipped.map((s) => s.symbol).join(", "),
    reason: skipped.every((s) => s.reason.startsWith("mutual fund"))
      ? t("research.eps_skippedFunds")
      : t("research.eps_skippedNoData"),
  });
};

/** Research page section: earnings check for every holding. Cards on phones, a table from md up. */
export const EpsHoldingsTable = () => {
  const { t } = useT();
  const { data, isLoading, isError } = useEpsInsights();

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("research.eps_loading")}</p>;
  if (isError || !data) return <p className="text-sm text-muted-foreground">{t("research.eps_unavailable")}</p>;

  const growth = (h: EpsHolding) =>
    h.growth_state === "turned_profitable"
      ? t("research.eps_nowProfitable")
      : h.growth_state === "still_loss"
        ? t("research.eps_loss")
        : h.growth_state === "turned_to_loss"
          ? t("research.eps_toLoss")
          : fmtPct(h.growth_yoy_pct, 0, true);

  const p = data.portfolio;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">
        {t("research.eps_summary", {
          profit: fmtRs(p.share_of_yearly_profit, 0),
          onCost: fmtPct(p.earnings_yield_on_cost_pct, 2),
          atMarket: fmtPct(p.market_earnings_yield_pct, 2),
        })}{" "}
        <Explain term="shareOfProfit" /> <Explain term="yieldOnCost" />
      </p>

      {/* Phones: one card per holding */}
      <ul className="space-y-3 md:hidden">
        {data.holdings.map((h) => (
          <li key={h.symbol} className="surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/quarterly?symbol=${h.symbol}`} className="font-mono font-semibold text-primary hover:underline">
                {h.symbol}
              </Link>
              <span className="text-xs text-muted-foreground">{h.latest_quarter}</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_avgCost")}</dt>
                <dd className="font-mono">{fmt(h.avg_cost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_price")}</dt>
                <dd className="font-mono">{fmt(h.price)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("research.eps_ttm")} <Explain term="ttmEps" />
                </dt>
                <dd className="font-mono">{fmt(h.ttm_eps)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("research.eps_peAtCost")} <Explain term="peAtCost" />
                </dt>
                <dd className="font-mono">{fmt(h.pe_at_cost, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_marketPe")}</dt>
                <dd className="font-mono">{fmt(h.market_pe, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_sectorMedian")}</dt>
                <dd className="font-mono">{fmt(h.sector_median_pe, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_yieldOnCost")}</dt>
                <dd className="font-mono">{fmtPct(h.earnings_yield_on_cost_pct, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("research.eps_profitYoy")}</dt>
                <dd className="font-mono">{growth(h)}</dd>
              </div>
            </dl>
            {(h.flags.length > 0 || h.notes.length > 0) && (
              <div className="mt-3 border-t border-border pt-2">
                <Notes h={h} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Wider screens: table */}
      <div className="surface hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(th, "text-left")}>{t("research.eps_symbol")}</th>
              <th className={th}>{t("research.eps_avgCost")}</th>
              <th className={th}>{t("research.eps_price")}</th>
              <th className={th}>
                {t("research.eps_ttm")} <Explain term="ttmEps" />
              </th>
              <th className={th}>
                {t("research.eps_peAtCost")} <Explain term="peAtCost" />
              </th>
              <th className={th}>{t("research.eps_marketPe")}</th>
              <th className={th}>{t("research.eps_sectorMedian")}</th>
              <th className={th}>{t("research.eps_yieldOnCost")}</th>
              <th className={th}>{t("research.eps_profitYoy")}</th>
              <th className={cn(th, "text-left")}>{t("research.eps_notes")}</th>
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((h) => (
              <tr key={h.symbol} className="border-b border-border/60 last:border-b-0">
                <td className="whitespace-nowrap px-2 py-2 text-left">
                  <Link to={`/quarterly?symbol=${h.symbol}`} className="font-mono text-sm font-semibold hover:underline">
                    {h.symbol}
                  </Link>
                  <div className="text-xs text-muted-foreground">{h.latest_quarter}</div>
                </td>
                <td className={td}>{fmt(h.avg_cost)}</td>
                <td className={td}>{fmt(h.price)}</td>
                <td className={td}>
                  {fmt(h.ttm_eps)}
                  {h.annualized_eps != null && h.ttm_eps != null && Math.abs(h.annualized_eps - h.ttm_eps) >= 0.005 && (
                    <div className="text-xs font-normal text-muted-foreground">
                      {t("research.eps_annualizedShort", { v: fmt(h.annualized_eps) })}
                    </div>
                  )}
                </td>
                <td className={td}>{fmt(h.pe_at_cost, 1)}</td>
                <td className={td}>{fmt(h.market_pe, 1)}</td>
                <td className={td}>{fmt(h.sector_median_pe, 1)}</td>
                <td className={td}>{fmtPct(h.earnings_yield_on_cost_pct, 1)}</td>
                <td className={td}>{growth(h)}</td>
                <td className="px-2 py-2 text-left">
                  <Notes h={h} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("research.eps_footnote")}
        {data.skipped.length > 0 && ` ${skippedText(data.skipped, t)}`}
      </p>
    </div>
  );
};
