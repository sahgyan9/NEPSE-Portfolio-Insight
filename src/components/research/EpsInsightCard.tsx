import { AlertTriangle, Info, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Explain } from "@/components/Explain";
import { useEpsInsights, type EpsFlag, type EpsHolding } from "@/services/epsInsightsApi";
import { cn } from "@/lib/utils";

export const dash = "—";

export const fmt = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v)
    ? dash
    : v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtRs = (v: number | null | undefined, digits = 2) => (v == null ? dash : `Rs ${fmt(v, digits)}`);

export const fmtPct = (v: number | null | undefined, digits = 1, signed = false) =>
  v == null ? dash : `${signed && v > 0 ? "+" : ""}${fmt(v, digits)}%`;

const FLAG_ICON: Record<string, LucideIcon> = {
  LOSS: AlertTriangle,
  PROFIT_FALLING: TrendingDown,
  PROFIT_RISING: TrendingUp,
  SEASONAL_ANNUALIZED: AlertTriangle,
  EXPENSIVE_AT_COST: AlertTriangle,
};

const FLAG_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-muted-foreground",
  info: "text-muted-foreground",
};

export const flagIcon = (f: EpsFlag): LucideIcon => FLAG_ICON[f.code] ?? Info;
export const flagColor = (f: EpsFlag) => (f.code === "PROFIT_RISING" ? "text-emerald-600" : FLAG_COLOR[f.severity]);

export const EpsFlagList = ({ flags }: { flags: EpsFlag[] }) => (
  <ul className="space-y-1.5">
    {flags.map((f) => {
      const Icon = flagIcon(f);
      return (
        <li key={f.code} className="flex items-start gap-2 text-sm">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", flagColor(f))} aria-hidden />
          <span>{f.text}</span>
        </li>
      );
    })}
  </ul>
);

const Row = ({ label, explain, children }: { label: string; explain?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
    <dt className="text-sm text-muted-foreground">
      {label} {explain}
    </dt>
    <dd className="text-right font-mono text-sm font-semibold">{children}</dd>
  </div>
);

const yoyText = (h: EpsHolding) => {
  if (h.growth_state === "turned_profitable") return "Turned profitable";
  if (h.growth_state === "still_loss") return "Loss in both periods";
  if (h.growth_state === "turned_to_loss") return `Turned to a loss (${fmtPct(h.growth_yoy_pct, 0, true)})`;
  return fmtPct(h.growth_yoy_pct, 1, true);
};

interface EpsInsightCardProps {
  symbol: string;
  /** Live last traded price from the quote; preferred over the stored close. */
  ltp?: number | null;
  className?: string;
}

/** Per-stock earnings view personalised to the user's average purchase price. */
export const EpsInsightCard = ({ symbol, ltp, className }: EpsInsightCardProps) => {
  const { data, isLoading, isError } = useEpsInsights();

  if (isLoading) return null;
  if (isError || !data) {
    return <p className="mb-5 text-xs text-muted-foreground">EPS insights unavailable.</p>;
  }
  const h = data.holdings.find((x) => x.symbol === symbol.toUpperCase());
  if (!h) return null;

  const price = ltp != null && ltp > 0 ? ltp : h.price;
  const marketPe = price != null && h.ttm_eps != null && h.ttm_eps > 0 ? price / h.ttm_eps : null;
  const showAnnualized =
    h.annualized_eps != null &&
    (h.ttm_eps == null || Math.abs(h.annualized_eps - h.ttm_eps) >= 0.005);

  return (
    <section
      aria-label="Your position: earnings"
      className={cn("rounded-xl border border-border bg-card p-4", className)}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Your position: earnings</h3>
        <p className="text-xs text-muted-foreground">
          {fmt(h.quantity, 0)} shares, based on {h.latest_quarter}
        </p>
      </div>

      <dl className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Row label="EPS (last 12 months)" explain={<Explain term="ttmEps" />}>
            {fmtRs(h.ttm_eps)}
          </Row>
          {showAnnualized && (
            <Row label="Annualized EPS" explain={<Explain term="annualizedEps" />}>
              {fmtRs(h.annualized_eps)}
            </Row>
          )}
          <Row label="You paid per share">{fmtRs(h.avg_cost)}</Row>
          <Row label="P/E at your cost" explain={<Explain term="peAtCost" />}>
            {fmt(h.pe_at_cost, 1)}
          </Row>
          <Row label="Earnings yield on your cost" explain={<Explain term="yieldOnCost" />}>
            {fmtPct(h.earnings_yield_on_cost_pct, 1)}
          </Row>
        </div>
        <div>
          <Row label="Market P/E">{fmt(marketPe, 1)}</Row>
          <Row label={`${h.sector} median P/E`}>{fmt(h.sector_median_pe, 1)}</Row>
          <Row label="Your share of yearly profit" explain={<Explain term="shareOfProfit" />}>
            {fmtRs(h.share_of_yearly_profit, 0)}
          </Row>
          <Row label="Profit vs same period last year">{yoyText(h)}</Row>
        </div>
      </dl>

      {h.notes.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{h.notes.join("; ")}</p>}
      {h.flags.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <EpsFlagList flags={h.flags} />
          {price !== h.price && h.price != null && h.flags.some((f) => f.code === "CHEAP_VS_SECTOR") && (
            <p className="mt-2 text-xs text-muted-foreground">
              Notes that mention the market P/E use the last close, Rs {fmt(h.price)}
              {h.price_date ? ` on ${h.price_date}` : ""}.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
