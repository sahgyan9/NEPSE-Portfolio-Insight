import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Explain } from "@/components/Explain";
import { Badge } from "@/components/ui/badge";
import { ChartCard, CHART, fmtFrac, fmtFracSigned, fmtRs } from "@/components/charts";
import type { RiskHolding } from "@/services/riskApi";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

type Key = "symbol" | "sector" | "value" | "weight" | "riskShare" | "volatility" | "beta" | "return1y" | "gainPct";

const COLS: { key: Key; label: string; align?: "right"; term?: GlossaryKey }[] = [
  { key: "symbol", label: "Holding" },
  { key: "sector", label: "Sector" },
  { key: "value", label: "Value", align: "right" },
  { key: "weight", label: "Share of money", align: "right", term: "weight" },
  { key: "riskShare", label: "Share of risk", align: "right", term: "riskShare" },
  { key: "volatility", label: "Volatility", align: "right", term: "volatility" },
  { key: "beta", label: "Beta", align: "right", term: "beta" },
  { key: "return1y", label: "1-year return", align: "right", term: "return1y" },
  { key: "gainPct", label: "Gain on cost", align: "right" },
];

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="flex items-center justify-end gap-2">
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
    <span className="w-12 text-right font-mono">{fmtFrac(value)}</span>
  </div>
);

export const HoldingsRiskTable = ({ holdings, loading }: { holdings?: RiskHolding[]; loading?: boolean }) => {
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

  return (
    <ChartCard
      title="Which individual holdings add the most risk?"
      subtitle="Click a column heading to sort."
      loading={loading}
      empty={rows.length === 0}
      height={240}
    >
      <div id="holdings-risk-table" className="max-h-[520px] overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              {COLS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <span className={cn("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {c.label}
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
                      estimated
                    </Badge>
                  )}
                  <div className="max-w-[180px] truncate text-xs text-muted-foreground">{h.company}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{h.sector}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtRs(h.value)}</td>
                <td className="px-3 py-2"><Bar value={h.weight} max={maxW} color={CHART.accentSoft} /></td>
                <td className="px-3 py-2"><Bar value={h.riskShare} max={maxR} color={CHART.accent} /></td>
                <td className="px-3 py-2 text-right font-mono">{fmtFrac(h.volatility)}</td>
                <td className="px-3 py-2 text-right font-mono">{h.beta === null || h.beta === undefined ? "-" : h.beta.toFixed(2)}</td>
                <td className={cn("px-3 py-2 text-right font-mono", h.return1y !== null && h.return1y !== undefined && (h.return1y >= 0 ? "text-success" : "text-destructive"))}>
                  {fmtFracSigned(h.return1y)}
                </td>
                <td className={cn("px-3 py-2 text-right font-mono", h.gainPct >= 0 ? "text-success" : "text-destructive")}>
                  {h.gainPct > 0 ? "+" : ""}
                  {h.gainPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
};
