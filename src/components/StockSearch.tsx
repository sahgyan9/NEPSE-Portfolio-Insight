import { useState, useCallback } from "react";
import { Search, X, Loader2, BookOpen, TrendingUp, Building2, DollarSign, BarChart3 } from "lucide-react";
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

export const StockSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [stockData, setStockData] = useState<MerolaganiFundamentals | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async (targetSymbol?: string) => {
        const query = (targetSymbol || searchQuery).trim().toUpperCase();
        if (!query) {
            toast({
                title: "Enter a symbol",
                description: "Please enter a stock symbol to search",
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
                setError(`No data found for "${query}". Make sure the symbol is correct.`);
            }
        } catch (err) {
            setError("Failed to fetch stock data. Please try again.");
            console.error("Search error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery]);

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

    const formatNumber = (value: number | null, decimals = 2): string => {
        if (value === null || value === undefined) return "N/A";
        return value.toLocaleString("en-NP", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const formatLargeNumber = (value: number | null): string => {
        if (value === null || value === undefined) return "N/A";
        if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
        if (value >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
        return value.toLocaleString();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                    <Search className="h-4 w-4" />
                    <span className="hidden xl:inline">Search</span>
                </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden">
                    <Search className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Stock Search
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Enter stock symbol (e.g., NABIL, NICA)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                className="pr-8 uppercase"
                                autoFocus
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading}>
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
                                <p className="text-sm text-muted-foreground">Fetching data...</p>
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
                                    className={stockData.isLiveData ? "bg-green-500" : ""}
                                >
                                    {stockData.source === "live" ? "Live" : stockData.source === "cache" ? "Cached" : "Fallback"}
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
                                                <p className="text-sm text-muted-foreground font-medium">Book Value</p>
                                                <p className="text-3xl font-bold text-primary">
                                                    Rs. {formatNumber(stockData.bookValue)}
                                                </p>
                                            </div>
                                        </div>
                                        {stockData.pbRatio !== null && (
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">P/B Ratio</p>
                                                <p className="text-lg font-semibold">{formatNumber(stockData.pbRatio)}</p>
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
                                            <span className="text-xs text-muted-foreground">EPS</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            Rs. {formatNumber(stockData.eps)}
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
                                            <span className="text-xs text-muted-foreground">P/E Ratio</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {formatNumber(stockData.peRatio)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* LTP */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Last Traded Price</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            Rs. {formatNumber(stockData.lastTradedPrice)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Market Cap */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Market Cap</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">
                                            {formatLargeNumber(stockData.marketCap)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* 52 Week High */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-green-500" />
                                            <span className="text-xs text-muted-foreground">52W High</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1 text-green-600">
                                            Rs. {formatNumber(stockData.week52High)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* 52 Week Low */}
                                <Card>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                                            <span className="text-xs text-muted-foreground">52W Low</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1 text-red-600">
                                            Rs. {formatNumber(stockData.week52Low)}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* ROE */}
                                {stockData.roe !== null && (
                                    <Card>
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">ROE</span>
                                            </div>
                                            <p className="text-lg font-semibold mt-1">
                                                {formatNumber(stockData.roe)}%
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
                                                <span className="text-xs text-muted-foreground">Div. Yield</span>
                                            </div>
                                            <p className="text-lg font-semibold mt-1">
                                                {formatNumber(stockData.dividendYield)}%
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

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
                                Enter a NEPSE stock symbol to see its fundamental data
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {["NABIL", "NICA", "SBI", "UPPER", "NLIC"].map((symbol) => (
                                    <Badge
                                        key={symbol}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-primary/10"
                                        onClick={() => {
                                            setSearchQuery(symbol);
                                            handleSearch(symbol);
                                        }}
                                    >
                                        {symbol}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
