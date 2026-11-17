import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { useT } from "@/i18n";
import { fmtDate, fmtMoney, fmtNumber, fmtPercent } from "@/i18n/format";
import { useRealizedGains, type RealizedSale } from "@/services/realizedApi";
import { cn } from "@/lib/utils";

const tone = (v: number | null) => (v === null ? "" : v > 0 ? "text-success" : v < 0 ? "text-destructive" : "");
const signed = (v: number | null) => (v === null ? "-" : `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmtMoney(Math.abs(v))}`);

/** Small grey notes under a sale: where the buy price came from, fees, and the tax band. */
const Notes = ({ s }: { s: RealizedSale }) => {
  const { t } = useT();
  const notes: string[] = [];
  if (s.costBasis === "estimated") notes.push(t("realized.costEstimated"));
  if (s.costBasis === "unknown") notes.push(t("realized.costUnknown"));
  if (s.fees === "not_included") notes.push(t("realized.feesNotIncluded"));
  if (s.fees === "bill") notes.push(t("realized.feesBill"));
  if (s.shortTermQty !== null && s.costBasis !== "unknown") {
    notes.push(s.shortTermQty > 0 ? t("realized.shortTerm", { count: fmtNumber(s.shortTermQty) }) : t("realized.longTerm"));
  }
  if (notes.length === 0) return null;
  return <p className="text-xs leading-relaxed text-muted-foreground">{notes.join(" · ")}</p>;
};

const Profit = ({ s }: { s: RealizedSale }) => (
  <span className={cn("font-mono", tone(s.profit))}>
    {signed(s.profit)}
    {s.profitPct !== null && <span className="ml-1 text-xs">({fmtPercent(s.profitPct)})</span>}
  </span>
);

/** Every recorded sale with buy cost, money received and profit or loss. Newest first. */
export const SoldSharesTable = () => {
  const { t } = useT();
  const { data, isLoading, isError } = useRealizedGains();

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError) return <p className="text-sm text-muted-foreground">{t("realized.errLoad")}</p>;
  const sales = data?.sales ?? [];
  if (sales.length === 0) {
    return <p className="rounded-lg border border-border py-6 text-center text-sm text-muted-foreground">{t("realized.tableEmpty")}</p>;
  }

  return (
    <>
      {/* Phones: one card per sale */}
      <ul className="space-y-2 md:hidden">
        {sales.map((s, idx) => (
          <li key={`${s.date}-${s.symbol}-${idx}`} className="surface space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                <StockSymbolLink symbol={s.symbol} />
              </span>
              <Profit s={s} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colDate")}</dt>
                <dd>{fmtDate(s.date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colQty")}</dt>
                <dd className="num">{fmtNumber(s.quantity)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colReceived")}</dt>
                <dd className="num">{fmtMoney(s.received)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colBuy")}</dt>
                <dd className="num">{fmtMoney(s.costPerShare, true)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colSell")}</dt>
                <dd className="num">{fmtMoney(s.sellPrice, true)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("realized.colHeld")}</dt>
                <dd>{fmtDate(s.heldFrom)}</dd>
              </div>
            </dl>
            <Notes s={s} />
          </li>
        ))}
      </ul>

      {/* Wider screens: table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("realized.colDate")}</TableHead>
              <TableHead>{t("realized.colSymbol")}</TableHead>
              <TableHead className="text-right">{t("realized.colQty")}</TableHead>
              <TableHead className="text-right">{t("realized.colBuy")}</TableHead>
              <TableHead className="text-right">{t("realized.colSell")}</TableHead>
              <TableHead className="text-right">{t("realized.colReceived")}</TableHead>
              <TableHead className="text-right">{t("realized.colProfit")}</TableHead>
              <TableHead>{t("realized.colHeld")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s, idx) => (
              <TableRow key={`${s.date}-${s.symbol}-${idx}`}>
                <TableCell className="text-sm">{fmtDate(s.date)}</TableCell>
                <TableCell className="font-medium">
                  <StockSymbolLink symbol={s.symbol} />
                </TableCell>
                <TableCell className="text-right">{fmtNumber(s.quantity)}</TableCell>
                <TableCell className="text-right">{fmtMoney(s.costPerShare, true)}</TableCell>
                <TableCell className="text-right">{fmtMoney(s.sellPrice, true)}</TableCell>
                <TableCell className="text-right">{fmtMoney(s.received)}</TableCell>
                <TableCell className="text-right">
                  <Profit s={s} />
                </TableCell>
                <TableCell className="text-sm">
                  {fmtDate(s.heldFrom)}
                  <Notes s={s} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
