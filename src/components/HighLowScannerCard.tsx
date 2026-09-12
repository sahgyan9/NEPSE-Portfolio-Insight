import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { fetchHighLowScanner, HighLowScannerRow } from '@/services/investmentApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';

export const HighLowScannerCard = () => {
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

    return (
        <Card className="border shadow-sm mt-8">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            52-Week High & Low Breakout Scanner
                        </CardTitle>
                        <CardDescription>
                            Identify momentum leaders approaching 52-week highs and deep-value candidates near 52-week lows
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-muted/60 p-1 rounded-lg border">
                            <Button
                                variant={viewMode === 'near_high' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('near_high')}
                                className="h-8 text-xs gap-1.5"
                            >
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                Near 52w High
                            </Button>
                            <Button
                                variant={viewMode === 'near_low' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('near_low')}
                                className="h-8 text-xs gap-1.5"
                            >
                                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                                Near 52w Low
                            </Button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={isLoading}
                            className="h-8 w-8 p-0"
                            title="Refresh scanner"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="py-10 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Scanning market for 52-week breakouts...</span>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                        No scanner records available currently.
                    </div>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="w-[90px]">Symbol</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Sector</TableHead>
                                    <TableHead className="text-right">LTP (NPR)</TableHead>
                                    <TableHead className="text-right">52w High</TableHead>
                                    <TableHead className="text-right">% From High</TableHead>
                                    <TableHead className="text-right">52w Low</TableHead>
                                    <TableHead className="text-right">% From Low</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.map((r) => {
                                    const isBreakout = Math.abs(r.pct_from_high) <= 2.0;
                                    const isBottom = Math.abs(r.pct_from_low) <= 2.0;

                                    return (
                                        <TableRow key={r.symbol} className="hover:bg-muted/30">
                                            <TableCell className="font-semibold">
                                                <StockSymbolLink symbol={r.symbol} />
                                            </TableCell>
                                            <TableCell className="text-sm text-foreground/90 max-w-[220px] truncate">
                                                {r.company_name}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {r.sector}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                                Rs. {r.ltp.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {r.high_52.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant="outline"
                                                    className={`font-mono text-xs ${
                                                        isBreakout
                                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {r.pct_from_high > 0 ? `+${r.pct_from_high}%` : `${r.pct_from_high}%`}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {r.low_52.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant="outline"
                                                    className={`font-mono text-xs ${
                                                        isBottom
                                                            ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {r.pct_from_low > 0 ? `+${r.pct_from_low}%` : `${r.pct_from_low}%`}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
