import { EVENT_OPEN_SEARCH } from "@/lib/shortcuts";
import { StockResearchBlock } from "@/components/research/StockResearchBlock";
import { useState, useCallback, useEffect } from "react";
import { Search, X, Loader2, BookOpen, TrendingUp, TrendingDown, Building2, DollarSign, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMerolaganiFundamentals, MerolaganiFundamentals } from "@/services/merolaganiApi";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { fmtMoney, fmtMoneyCompact, fmtPercent } from "@/i18n/format";

/** Plain ratio with two decimals; "-" when missing. */
const fmtRatio = (v: number | null | undefined): string =>
    v === null || v === undefined || Number.isNaN(v) ? "-" : v.toFixed(2);

export const StockSearch = () => {
    const { t } = useT();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const open = () => setIsOpen(true);
        window.addEventListener(EVENT_OPEN_SEARCH, open);
        return () => window.removeEventListener(EVENT_OPEN_SEARCH, open);
    }, []);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [stockData, setStockData] = useState<MerolaganiFundamentals | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async (targetSymbol?: string) => {
        const query = (targetSymbol || searchQuery).trim().toUpperCase();
        if (!query) {
            toast({
                title: t("nav.searchEmptyTitle"),
                description: t("nav.searchEmptyBody"),
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        setError(null);
        setStockData(null);

        try {
            const data = await fetchMerolaganiFundamentals(query);

            if (data) {
                setStockData(data);
            } else {
                setError(t("nav.searchNotFound", { symbol: query }));
            }
        } catch (err) {
            setError(t("nav.searchFailed"));
            console.error("Search error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, t]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setSearchQuery("");
        setStockData(null);
        setError(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 lg:h-9 lg:w-9"
                    aria-label={t("nav.searchOpen")}
                    title={t("nav.searchOpen")}
                >
                    <Search className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        {t("nav.searchTitle")}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder={t("nav.searchPlaceholder")}
                                aria-label={t("nav.searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                className="h-11 pr-10 uppercase placeholder:normal-case lg:h-10"
                                autoFocus
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setSearchQuery("")}
                                    aria-label={t("nav.searchClear")}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <Button
                            onClick={() => handleSearch()}
                            disabled={isLoading}
                            className="h-11 lg:h-10"
                            aria-label={t("nav.searchGo")}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !isLoading && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Results */}
                    {stockData && !isLoading && (
                        <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold">{stockData.symbol}</h3>
                                    {stockData.sector && (
                                        <Badge variant="secondary" className="mt-1">
                                            <Building2 className="h-3 w-3 mr-1" />
                                            {stockData.sector}
                                        </Badge>
                                    )}
                                </div>
                                <Badge
                                    variant={stockData.isLiveData ? "default" : "outline"}
                                    className={stockData.isLiveData ? "bg-success" : ""}
                                >
                                    {stockData.source === "live"
                                        ? t("nav.sourceLive")
                                        : stockData.source === "cache"
                                          ? t("nav.sourceCache")
                                          : t("nav.sourceFallback")}
                                </Badge>
                            </div>

                            {/* Book Value - Highlighted */}
                            <Card className="border-2 border-primary bg-primary/5">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-primary/20 rounded-xl">
                                                <BookOpen className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground font-medium">{t("nav.bookValue")}</p>
                                                <p className="text-3xl font-bold text-primary">
                                                    {fmtMoney(stockData.bookValue, true)}
                                                </p>
                                            </div>
                                        </div>
                                        {stockData.pbRatio !== null && (
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">{t("nav.pbRatio")}</p>
                                                <p className="text-lg font-semibold">{fmtRatio(stockData.pbRatio)}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Other Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* EPS */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{t("nav.eps")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtMoney(stockData.eps, true)}
                                        </p>
                                        {stockData.epsInfo && (
                                            <p className="text-xs text-muted-foreground">{stockData.epsInfo}</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* P/E Ratio */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{t("nav.pe")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtRatio(stockData.peRatio)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* LTP */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{t("nav.ltp")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtMoney(stockData.lastTradedPrice, true)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Market Cap */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{t("nav.marketCap")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtMoneyCompact(stockData.marketCap)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* 52 Week High */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
                                            <span className="text-xs text-muted-foreground">{t("nav.high52")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtMoney(stockData.week52High, true)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* 52 Week Low */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
                                            <span className="text-xs text-muted-foreground">{t("nav.low52")}</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {fmtMoney(stockData.week52Low, true)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* ROE */}
                                {stockData.roe !== null && (
                                    <Card>
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{t("nav.roe")}</span>
                                            </div>
                                            <p className="text-lg font-semibold mt-1">
                                                {fmtPercent(stockData.roe, 2, false)}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Dividend Yield */}
                                {stockData.dividendYield !== null && (
                                    <Card>
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{t("nav.divYield")}</span>
                                            </div>
                                            <p className="text-lg font-semibold mt-1">
                                                {fmtPercent(stockData.dividendYield, 2, false)}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            <StockResearchBlock symbol={stockData.symbol} sector={stockData.sector} narrow />

                            {/* Source Info */}
                            <p className="text-xs text-muted-foreground text-center">
                                {stockData.sourceDetails}
                            </p>
                        </div>
                    )}

                    {/* Initial State */}
                    {!stockData && !error && !isLoading && (
                        <div className="py-8 text-center">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                {t("nav.searchIntro")}
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {["NABIL", "NICA", "SBI", "UPPER", "NLIC"].map((symbol) => (
                                    <Button
                                        key={symbol}
                                        variant="outline"
                                        size="sm"
                                        className="h-11 lg:h-8"
                                        onClick={() => {
                                            setSearchQuery(symbol);
                                            handleSearch(symbol);
                                        }}
                                    >
                                        {symbol}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
