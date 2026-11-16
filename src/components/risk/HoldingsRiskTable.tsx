import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Explain } from "@/components/Explain";
import { Badge } from "@/components/ui/badge";
import { ChartCard, CHART, fmtFrac, fmtFracSigned } from "@/components/charts";
import { fmtMoney, fmtPercent } from "@/i18n/format";
import { useT } from "@/i18n";
import { sectorLabel } from "@/lib/findingText";
import type { RiskHolding } from "@/services/riskApi";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { pctNum } from "./riskText";

type Key = "symbol" | "sector" | "value" | "weight" | "riskShare" | "volatility" | "beta" | "return1y" | "gainPct";

const COLS: { key: Key; label: string; align?: "right"; term?: GlossaryKey }[] = [
  { key: "symbol", label: "risk.colHolding" },
  { key: "sector", label: "risk.colSector" },
  { key: "value", label: "risk.colValue", align: "right" },
  { key: "weight", label: "risk.shareOfMoney", align: "right", term: "weight" },
  { key: "riskShare", label: "risk.shareOfRisk", align: "right", term: "riskShare" },
  { key: "volatility", label: "risk.colVolatility", align: "right", term: "volatility" },
  { key: "beta", label: "risk.colBeta", align: "right", term: "beta" },
  { key: "return1y", label: "risk.colReturn1y", align: "right", term: "return1y" },
  { key: "gainPct", label: "risk.colGain", align: "right" },
];

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="flex items-center justify-end gap-2">
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
    <span className="w-12 text-right font-mono">{fmtFrac(value)}</span>
  </div>
);

const toneOf = (v: number | null | undefined) =>
  v === null || v === undefined ? undefined : v >= 0 ? "text-success" : "text-destructive";

const fmtGain = (v: number | null | undefined) => fmtPercent(v, 1);

export const HoldingsRiskTable = ({ holdings, loading }: { holdings?: RiskHolding[]; loading?: boolean }) => {
  const { t } = useT();
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" }>({ key: "riskShare", dir: "desc" });

  const rows = useMemo(() => {
    const list = [...(holdings ?? [])];
    const { key, dir } = sort;
    list.sort((a, b) => {
      const av = a[key] as number | string | null;
      const bv = b[key] as number | string | null;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const c = typeof av === "string" ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return dir === "asc" ? c : -c;
    });
    return list;
  }, [holdings, sort]);

  const maxW = Math.max(0, ...rows.map((r) => r.weight));
  const maxR = Math.max(0, ...rows.map((r) => r.riskShare));
  const toggle = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "symbol" || key === "sector" ? "asc" : "desc" }));

  const top = useMemo(() => [...(holdings ?? [])].sort((a, b) => b.riskShare - a.riskShare)[0], [holdings]);
  const summary = top
    ? t("risk.tableSummary", { symbol: top.symbol, risk: pctNum(top.riskShare), weight: pctNum(top.weight) })
    : undefined;

  return (
    <ChartCard
      title={t("risk.tableTitle")}
      subtitle={summary}
      loading={loading}
      empty={rows.length === 0}
      emptyMessage={t("risk.tableEmpty")}
      height={240}
    >
      {/* Phone: one card per holding. Sorted by share of risk (default). */}
      <ul className="space-y-2 md:hidden" aria-label={t("risk.tableTitle")}>
        {rows.map((h) => (
          <li key={h.symbol} className="rounded-md border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/quarterly?symbol=${h.symbol}`} className="inline-flex min-h-[44px] items-center text-base font-semibold hover:underline">
                  {h.symbol}
                </Link>
                {!h.measured && (
                  <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[11px] font-normal">
                    {t("risk.estimated")}
                  </Badge>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {h.company} · {sectorLabel(h.sector)}
                </p>
              </div>
              <p className="shrink-0 pt-3 font-mono text-sm">{fmtMoney(h.value)}</p>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.shareOfMoney")}</dt>
                <dd><Bar value={h.weight} max={maxW} color={CHART.accentSoft} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.shareOfRisk")}</dt>
                <dd><Bar value={h.riskShare} max={maxR} color={CHART.accent} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.colVolatility")}</dt>
                <dd className="font-mono">{fmtFrac(h.volatility)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.colBeta")}</dt>
                <dd className="font-mono">{h.beta === null || h.beta === undefined ? "-" : h.beta.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.colReturn1y")}</dt>
                <dd className={cn("font-mono", toneOf(h.return1y))}>{fmtFracSigned(h.return1y)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("risk.colGain")}</dt>
                <dd className={cn("font-mono", toneOf(h.gainPct))}>{fmtGain(h.gainPct)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet and up: sortable table. */}
      <div id="holdings-risk-table" className="hidden max-h-[520px] overflow-auto rounded-md border border-border md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              {COLS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <span className={cn("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground" title={t("risk.sortHint")}>
                        {t(c.label)}
                        {active ? sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
                      </button>
                      {c.term && <Explain term={c.term} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((h) => (
              <tr key={h.symbol} className="hover:bg-muted/60">
                <td className="px-3 py-2">
                  <Link to={`/quarterly?symbol=${h.symbol}`} className="font-semibold hover:underline">
                    {h.symbol}
                  </Link>
                  {!h.measured && (
                    <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px] font-normal">
                      {t("risk.estimated")}
                    </Badge>
                  )}
                  <div className="max-w-[180px] truncate text-xs text-muted-foreground">{h.company}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{sectorLabel(h.sector)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(h.value)}</td>
                <td className="px-3 py-2"><Bar value={h.weight} max={maxW} color={CHART.accentSoft} /></td>
                <td className="px-3 py-2"><Bar value={h.riskShare} max={maxR} color={CHART.accent} /></td>
                <td className="px-3 py-2 text-right font-mono">{fmtFrac(h.volatility)}</td>
                <td className="px-3 py-2 text-right font-mono">{h.beta === null || h.beta === undefined ? "-" : h.beta.toFixed(2)}</td>
                <td className={cn("px-3 py-2 text-right font-mono", toneOf(h.return1y))}>{fmtFracSigned(h.return1y)}</td>
                <td className={cn("px-3 py-2 text-right font-mono", toneOf(h.gainPct))}>{fmtGain(h.gainPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 hidden text-xs text-muted-foreground md:block">{t("risk.sortHint")}</p>
    </ChartCard>
  );
};
