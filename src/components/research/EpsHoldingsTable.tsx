import { Link } from "react-router-dom";
import { Explain } from "@/components/Explain";
import { useEpsInsights, type EpsFlag } from "@/services/epsInsightsApi";
import { cn } from "@/lib/utils";
import { dash, fmt, fmtPct, fmtRs, flagColor, flagIcon } from "@/components/research/EpsInsightCard";

const FLAG_LABEL: Record<string, string> = {
  LOSS: "Loss",
  PROFIT_FALLING: "Profit falling",
  PROFIT_RISING: "Profit rising",
  SEASONAL_ANNUALIZED: "Seasonal EPS",
  ANNUALIZED_GAP: "Annualized gap",
  EXPENSIVE_AT_COST: "High P/E at cost",
  CHEAP_VS_SECTOR: "Low P/E for sector",
};

const FlagChip = ({ flag }: { flag: EpsFlag }) => {
  const Icon = flagIcon(flag);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs" title={flag.text}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", flagColor(flag))} aria-hidden />
      {FLAG_LABEL[flag.code] ?? flag.code}
    </span>
  );
};

const th = "whitespace-nowrap px-2 py-2 text-right text-xs font-medium text-muted-foreground";
const td = "px-2 py-2 text-right font-mono text-sm";

/** Research page section: earnings check for every holding, high-severity rows first. */
export const EpsHoldingsTable = () => {
  const { data, isLoading, isError } = useEpsInsights();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading earnings check.</p>;
  if (isError || !data) return <p className="text-sm text-muted-foreground">EPS insights unavailable.</p>;

  const p = data.portfolio;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Your shares earned about <span className="font-semibold">{fmtRs(p.share_of_yearly_profit, 0)}</span> of company
        profit over the last 12 months <Explain term="shareOfProfit" />. That is{" "}
        <span className="font-semibold">{fmtPct(p.earnings_yield_on_cost_pct, 2)}</span> on what you paid{" "}
        <Explain term="yieldOnCost" /> and <span className="font-semibold">{fmtPct(p.market_earnings_yield_pct, 2)}</span>{" "}
        at today's prices.
      </p>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(th, "text-left")}>Symbol</th>
              <th className={th}>Avg cost</th>
              <th className={th}>Price</th>
              <th className={th}>
                EPS (12 mo) <Explain term="ttmEps" />
              </th>
              <th className={th}>
                P/E at cost <Explain term="peAtCost" />
              </th>
              <th className={th}>Market P/E</th>
              <th className={th}>Sector median</th>
              <th className={th}>Yield on cost</th>
              <th className={th}>Profit YoY</th>
              <th className={cn(th, "text-left")}>Notes</th>
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
                    <div className="text-xs font-normal text-muted-foreground">annualized {fmt(h.annualized_eps)}</div>
                  )}
                </td>
                <td className={td}>{fmt(h.pe_at_cost, 1)}</td>
                <td className={td}>{fmt(h.market_pe, 1)}</td>
                <td className={td}>{fmt(h.sector_median_pe, 1)}</td>
                <td className={td}>{fmtPct(h.earnings_yield_on_cost_pct, 1)}</td>
                <td className={td}>
                  {h.growth_state === "turned_profitable"
                    ? "Now profitable"
                    : h.growth_state === "still_loss"
                      ? "Loss"
                      : h.growth_state === "turned_to_loss"
                        ? "To loss"
                        : fmtPct(h.growth_yoy_pct, 0, true)}
                </td>
                <td className="px-2 py-2 text-left">
                  {h.flags.length === 0 && h.notes.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{dash}</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {h.flags.map((f) => (
                        <FlagChip key={f.code} flag={f} />
                      ))}
                      {h.notes.map((n) => (
                        <span key={n} className="text-xs text-muted-foreground">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        EPS is the profit of the last 12 months, not the annualized figure shown on many sites. Hover a note, or open the
        stock, for the full explanation.
        {data.skipped.length > 0 &&
          ` Not included: ${data.skipped.map((s) => s.symbol).join(", ")} (${
            data.skipped.every((s) => s.reason.startsWith("mutual fund")) ? "mutual funds have no EPS" : "no usable earnings data"
          }).`}
      </p>
    </div>
  );
};
