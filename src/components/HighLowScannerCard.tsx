import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react';
import { fetchHighLowScanner, HighLowScannerRow } from '@/services/investmentApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { useT } from '@/i18n';
import { fmtMoney, fmtPercent } from '@/i18n/format';

export const HighLowScannerCard = () => {
    const { t } = useT();
    const [rows, setRows] = useState<HighLowScannerRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'near_high' | 'near_low' | 'all'>('near_high');

    const loadData = async () => {
        setIsLoading(true);
        const data = await fetchHighLowScanner();
        setRows(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredRows = useMemo(() => {
        if (viewMode === 'near_high') {
            // Sorted by closeness to high (pct_from_high closest to 0)
            return [...rows]
                .sort((a, b) => Math.abs(a.pct_from_high) - Math.abs(b.pct_from_high))
                .slice(0, 15);
        }
        if (viewMode === 'near_low') {
            // Sorted by closeness to low (pct_from_low closest to 0)
            return [...rows]
                .sort((a, b) => Math.abs(a.pct_from_low) - Math.abs(b.pct_from_low))
                .slice(0, 15);
        }
        return rows.slice(0, 15);
    }, [rows, viewMode]);

    const highBadge = (r: HighLowScannerRow) => {
        const near = Math.abs(r.pct_from_high) <= 2.0;
        return (
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                {near && <span className="text-xs font-medium text-success">{t('market.badgeNearHigh')}</span>}
                <Badge
                    variant="outline"
                    className={`font-mono text-xs ${near ? 'border-success/40 bg-success/10 font-semibold text-success' : 'text-muted-foreground'}`}
                >
                    {fmtPercent(r.pct_from_high, 2)}
                </Badge>
            </span>
        );
    };

    const lowBadge = (r: HighLowScannerRow) => {
        const near = Math.abs(r.pct_from_low) <= 2.0;
        return (
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                {near && <span className="text-xs font-medium text-destructive">{t('market.badgeNearLow')}</span>}
                <Badge
                    variant="outline"
                    className={`font-mono text-xs ${near ? 'border-destructive/40 bg-destructive/10 font-semibold text-destructive' : 'text-muted-foreground'}`}
                >
                    {fmtPercent(r.pct_from_low, 2)}
                </Badge>
            </span>
        );
    };

    return (
        <Card className="mt-8 border shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
                            {t('market.scanTitle')}
                        </CardTitle>
                        <CardDescription className="leading-relaxed">{t('market.scanSubtitle')}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-1 rounded-lg border bg-muted/60 p-1 sm:flex-none">
                            <Button
                                variant={viewMode === 'near_high' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('near_high')}
                                aria-pressed={viewMode === 'near_high'}
                                className="min-h-[44px] flex-1 gap-1.5 text-xs md:h-8 md:min-h-0"
                            >
                                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('market.nearHigh')}
                            </Button>
                            <Button
                                variant={viewMode === 'near_low' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('near_low')}
                                aria-pressed={viewMode === 'near_low'}
                                className="min-h-[44px] flex-1 gap-1.5 text-xs md:h-8 md:min-h-0"
                            >
                                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('market.nearLow')}
                            </Button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={isLoading}
                            className="h-11 w-11 shrink-0 p-0 md:h-8 md:w-8"
                            title={t('market.scanRefresh')}
                            aria-label={t('market.scanRefresh')}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        </Button>
                    </div>
                </div>
                <p className="mt-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    {t('market.scanCaution')}
                </p>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                        <span className="text-sm">{t('market.scanLoading')}</span>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">{t('market.scanEmpty')}</div>
                ) : (
                    <>
                        {/* Phones: one card per share */}
                        <ul className="space-y-3 md:hidden">
                            {filteredRows.map((r) => (
                                <li key={r.symbol} className="surface p-4">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="font-semibold"><StockSymbolLink symbol={r.symbol} /></span>
                                        <span className="font-mono text-lg font-semibold">{fmtMoney(r.ltp, true)}</span>
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground" title={r.company_name}>{r.company_name}</p>
                                    <p className="text-xs text-muted-foreground">{r.sector}</p>
                                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm leading-relaxed">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('market.colHigh')}</dt>
                                            <dd className="font-mono">{fmtMoney(r.high_52, true)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('market.colFromHigh')}</dt>
                                            <dd>{highBadge(r)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('market.colLow')}</dt>
                                            <dd className="font-mono">{fmtMoney(r.low_52, true)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('market.colFromLow')}</dt>
                                            <dd>{lowBadge(r)}</dd>
                                        </div>
                                    </dl>
                                </li>
                            ))}
                        </ul>

                        {/* Tablets and desktops: table */}
                        <div className="hidden overflow-x-auto rounded-md border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40">
                                        <TableHead className="w-[90px]">{t('market.colSymbol')}</TableHead>
                                        <TableHead>{t('market.colCompany')}</TableHead>
                                        <TableHead>{t('market.colSector')}</TableHead>
                                        <TableHead className="text-right">{t('market.colLtp')}</TableHead>
                                        <TableHead className="text-right">{t('market.colHigh')}</TableHead>
                                        <TableHead className="text-right">{t('market.colFromHigh')}</TableHead>
                                        <TableHead className="text-right">{t('market.colLow')}</TableHead>
                                        <TableHead className="text-right">{t('market.colFromLow')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRows.map((r) => (
                                        <TableRow key={r.symbol} className="hover:bg-muted/30">
                                            <TableCell className="font-semibold">
                                                <StockSymbolLink symbol={r.symbol} />
                                            </TableCell>
                                            <TableCell className="max-w-[220px] truncate text-sm text-foreground/90">
                                                {r.company_name}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{r.sector}</TableCell>
                                            <TableCell className="text-right font-mono font-medium">{fmtMoney(r.ltp, true)}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{fmtMoney(r.high_52, true)}</TableCell>
                                            <TableCell className="text-right">{highBadge(r)}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{fmtMoney(r.low_52, true)}</TableCell>
                                            <TableCell className="text-right">{lowBadge(r)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
