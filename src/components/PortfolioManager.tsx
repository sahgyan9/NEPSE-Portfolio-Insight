import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { REALIZED_QUERY_KEY } from "@/services/realizedApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, Database, RefreshCw, Trash2, AlertCircle, Upload, CheckCircle2 } from "lucide-react";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { PortfolioImportZone } from "@/components/PortfolioImportZone";
import {
    getHoldings,
    addStock,
    sellStock,
    deleteStock,
    isServerRunning,
    DBHolding,
    getTransactions,
    DBTransaction,
} from "@/services/portfolioDb";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { fmtDate, fmtMoney, fmtNumber } from "@/i18n/format";
import { EVENT_OPEN_PORTFOLIO } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

interface PortfolioManagerProps {
    onPortfolioChange?: () => void;
    /** Extra classes for the header button (the header hides it on phones; the menu opens it by event). */
    triggerClassName?: string;
}

export const PortfolioManager = ({ onPortfolioChange, triggerClassName }: PortfolioManagerProps) => {
    const { t } = useT();
    const [holdings, setHoldings] = useState<DBHolding[]>([]);
    const [transactions, setTransactions] = useState<DBTransaction[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    // Form states for adding stock
    const [addForm, setAddForm] = useState({
        symbol: "",
        company: "",
        quantity: "",
        avgCost: "",
    });

    // Form states for recording a sale
    const [sellForm, setSellForm] = useState({
        symbol: "",
        quantity: "",
        sellPrice: "",
        netReceived: "",
    });
    const queryClient = useQueryClient();

    // The phone menu opens this dialog by event, because its own trigger is hidden there.
    useEffect(() => {
        const open = () => setIsOpen(true);
        window.addEventListener(EVENT_OPEN_PORTFOLIO, open);
        return () => window.removeEventListener(EVENT_OPEN_PORTFOLIO, open);
    }, []);

    const checkConnection = async () => {
        const connected = await isServerRunning();
        setIsConnected(connected);
        return connected;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const connected = await checkConnection();
            if (connected) {
                const [holdingsData, transactionsData] = await Promise.all([
                    getHoldings(),
                    getTransactions(),
                ]);
                setHoldings(holdingsData);
                setTransactions(transactionsData);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const showError = (error: unknown) => {
        toast({
            title: t("common.error"),
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
        });
    };

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await addStock(
                addForm.symbol,
                addForm.company,
                Number(addForm.quantity),
                Number(addForm.avgCost)
            );

            setHoldings(result.holdings);
            setAddForm({ symbol: "", company: "", quantity: "", avgCost: "" });

            toast({
                title: result.action === "added" ? t("nav.pmAddedTitle") : t("nav.pmUpdatedTitle"),
                description: t("nav.pmAddedBody", { symbol: addForm.symbol }),
            });

            const txns = await getTransactions();
            setTransactions(txns);
            onPortfolioChange?.();
        } catch (error) {
            showError(error);
        }
    };

    const handleSellStock = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await sellStock(
                sellForm.symbol,
                Number(sellForm.quantity),
                sellForm.sellPrice ? Number(sellForm.sellPrice) : undefined,
                sellForm.netReceived ? Number(sellForm.netReceived) : undefined
            );

            setHoldings(result.holdings);
            setSellForm({ symbol: "", quantity: "", sellPrice: "", netReceived: "" });

            toast({
                title: t("nav.pmSoldTitle"),
                description: t("nav.pmSoldBody", { qty: sellForm.quantity, symbol: sellForm.symbol }),
            });

            const txns = await getTransactions();
            setTransactions(txns);
            queryClient.invalidateQueries({ queryKey: REALIZED_QUERY_KEY });
            onPortfolioChange?.();
        } catch (error) {
            showError(error);
        }
    };

    const handleDeleteStock = async (symbol: string) => {
        if (!confirm(t("nav.pmRemoveConfirm", { symbol }))) {
            return;
        }

        try {
            const result = await deleteStock(symbol);
            setHoldings(result.holdings);
            toast({
                title: t("nav.pmRemovedTitle"),
                description: t("nav.pmRemovedBody", { symbol }),
            });
            onPortfolioChange?.();
        } catch (error) {
            showError(error);
        }
    };

    const removeButton = (symbol: string) => (
        <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive hover:text-destructive md:h-8 md:w-8"
            onClick={() => handleDeleteStock(symbol)}
            aria-label={t("nav.pmRemoveAria", { symbol })}
            title={t("nav.pmRemoveAria", { symbol })}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );

    const typeBadge = (type: DBTransaction["type"]) => (
        <Badge variant={type === "BUY" ? "default" : "destructive"}>
            {type === "BUY" ? t("nav.pmTypeBuy") : t("nav.pmTypeSell")}
        </Badge>
    );

    const history = transactions.slice().reverse();

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className={cn("h-9 w-9 shrink-0", triggerClassName)}
                    aria-label={t("nav.pmOpen")}
                    title={t("nav.pmOpen")}
                >
                    <Database className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        {t("nav.pmTitle")}
                    </DialogTitle>
                    <DialogDescription className="flex items-start gap-2 text-left">
                        {isConnected ? (
                            <>
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                                {t("nav.pmConnected")}
                            </>
                        ) : (
                            <>
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                                <span className="text-warning">{t("nav.pmNotConnected")}</span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {!isConnected ? (
                    <div className="p-4 text-center space-y-4 sm:p-8">
                        <AlertCircle className="h-12 w-12 mx-auto text-warning" aria-hidden="true" />
                        <h3 className="text-lg font-semibold">{t("nav.pmOfflineTitle")}</h3>
                        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                            {t("nav.pmOfflineBody", { vbs: "PortfolioInsight.vbs", bat: "start.bat" })}
                        </p>
                        <Button onClick={fetchData} variant="outline" className="min-h-[44px] gap-2">
                            <RefreshCw className="h-4 w-4" />
                            {t("nav.pmRetry")}
                        </Button>
                    </div>
                ) : (
                    <Tabs defaultValue="holdings" className="w-full">
                        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-5">
                            <TabsTrigger value="holdings" className="min-h-[40px]">
                                {t("nav.pmTabHoldings", { count: holdings.length })}
                            </TabsTrigger>
                            <TabsTrigger value="import" className="min-h-[40px]">
                                <Upload className="h-4 w-4 mr-1" />
                                {t("nav.pmTabImport")}
                            </TabsTrigger>
                            <TabsTrigger value="add" className="min-h-[40px]">
                                <Plus className="h-4 w-4 mr-1" />
                                {t("nav.pmTabAdd")}
                            </TabsTrigger>
                            <TabsTrigger value="sell" className="min-h-[40px]">
                                <Minus className="h-4 w-4 mr-1" />
                                {t("nav.pmTabSell")}
                            </TabsTrigger>
                            <TabsTrigger value="history" className="min-h-[40px]">
                                {t("nav.pmTabHistory")}
                            </TabsTrigger>
                        </TabsList>

                        {/* Holdings */}
                        <TabsContent value="holdings" className="space-y-4">
                            <div className="flex justify-between items-center gap-2">
                                <p className="text-sm text-muted-foreground">{t("nav.pmHoldingsIntro")}</p>
                                <Button
                                    onClick={fetchData}
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 shrink-0 md:h-9 md:w-9"
                                    disabled={loading}
                                    aria-label={t("nav.pmReload")}
                                    title={t("nav.pmReload")}
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                </Button>
                            </div>

                            {holdings.length === 0 ? (
                                <p className="rounded-lg border border-border py-8 text-center text-muted-foreground">
                                    {t("nav.pmEmpty")}
                                </p>
                            ) : (
                                <>
                                    {/* Phones: one card per share */}
                                    <ul className="space-y-2 md:hidden">
                                        {holdings.map((h) => (
                                            <li key={h.symbol} className="rounded-lg border border-border p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-medium">
                                                            <StockSymbolLink symbol={h.symbol} />
                                                        </div>
                                                        <p className="truncate text-sm text-muted-foreground">{h.company}</p>
                                                    </div>
                                                    {removeButton(h.symbol)}
                                                </div>
                                                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colQty")}</dt>
                                                        <dd className="num">{fmtNumber(h.quantity)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colAvgCost")}</dt>
                                                        <dd className="num">{fmtMoney(h.avgCost, true)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colTotal")}</dt>
                                                        <dd className="num font-medium">{fmtMoney(h.quantity * h.avgCost)}</dd>
                                                    </div>
                                                </dl>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Wider screens: table */}
                                    <div className="hidden border rounded-lg overflow-hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("nav.colSymbol")}</TableHead>
                                                    <TableHead>{t("nav.colCompany")}</TableHead>
                                                    <TableHead className="text-right">{t("nav.colQty")}</TableHead>
                                                    <TableHead className="text-right">{t("nav.colAvgCost")}</TableHead>
                                                    <TableHead className="text-right">{t("nav.colTotal")}</TableHead>
                                                    <TableHead>
                                                        <span className="sr-only">{t("common.remove")}</span>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {holdings.map((h) => (
                                                    <TableRow key={h.symbol}>
                                                        <TableCell className="font-medium">
                                                            <StockSymbolLink symbol={h.symbol} />
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                                            {h.company}
                                                        </TableCell>
                                                        <TableCell className="text-right">{fmtNumber(h.quantity)}</TableCell>
                                                        <TableCell className="text-right">{fmtMoney(h.avgCost, true)}</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {fmtMoney(h.quantity * h.avgCost, true)}
                                                        </TableCell>
                                                        <TableCell>{removeButton(h.symbol)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        {/* Import CSV */}
                        <TabsContent value="import" className="space-y-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">{t("nav.pmImportIntro")}</p>
                            <PortfolioImportZone
                                onImported={async () => {
                                    await fetchData();
                                    onPortfolioChange?.();
                                    toast({
                                        title: t("nav.pmImportedTitle"),
                                        description: t("nav.pmImportedBody"),
                                    });
                                }}
                            />
                        </TabsContent>

                        {/* Add shares */}
                        <TabsContent value="add" className="space-y-4">
                            <p className="text-sm text-muted-foreground">{t("nav.pmAddIntro")}</p>
                            <form onSubmit={handleAddStock} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="symbol">{t("nav.pmSymbol")} *</Label>
                                        <Input
                                            id="symbol"
                                            placeholder={t("nav.pmSymbolPh")}
                                            value={addForm.symbol}
                                            onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value.toUpperCase() })}
                                            className="h-11 md:h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company">{t("nav.pmCompany")}</Label>
                                        <Input
                                            id="company"
                                            placeholder={t("nav.pmCompanyPh")}
                                            value={addForm.company}
                                            onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                                            className="h-11 md:h-10"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">{t("nav.pmQty")} *</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            placeholder={t("nav.pmQtyPh")}
                                            value={addForm.quantity}
                                            onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                                            className="h-11 md:h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="avgCost">{t("nav.pmAvgCost")} *</Label>
                                        <Input
                                            id="avgCost"
                                            type="number"
                                            inputMode="decimal"
                                            min="0.01"
                                            step="0.01"
                                            placeholder={t("nav.pmCostPh")}
                                            value={addForm.avgCost}
                                            onChange={(e) => setAddForm({ ...addForm, avgCost: e.target.value })}
                                            className="h-11 md:h-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full min-h-[44px]">
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t("nav.pmAddSubmit")}
                                </Button>
                            </form>
                        </TabsContent>

                        {/* Record a sale */}
                        <TabsContent value="sell" className="space-y-4">
                            <p className="text-sm text-muted-foreground">{t("nav.pmSellIntro")}</p>
                            <form onSubmit={handleSellStock} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sellSymbol">{t("nav.pmSymbol")} *</Label>
                                    <Input
                                        id="sellSymbol"
                                        placeholder={t("nav.pmSymbolPh")}
                                        value={sellForm.symbol}
                                        onChange={(e) => setSellForm({ ...sellForm, symbol: e.target.value.toUpperCase() })}
                                        className="h-11 md:h-10"
                                        required
                                    />
                                    {sellForm.symbol && (
                                        <p className="text-xs text-muted-foreground">
                                            {t("nav.pmCurrentHolding", {
                                                qty: fmtNumber(holdings.find((h) => h.symbol === sellForm.symbol)?.quantity || 0),
                                            })}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="sellQuantity">{t("nav.pmSellQty")} *</Label>
                                        <Input
                                            id="sellQuantity"
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            placeholder={t("nav.pmQtyPh")}
                                            value={sellForm.quantity}
                                            onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
                                            className="h-11 md:h-10"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sellPrice">{t("nav.pmSellPrice")}</Label>
                                        <Input
                                            id="sellPrice"
                                            type="number"
                                            inputMode="decimal"
                                            min="0.01"
                                            step="0.01"
                                            placeholder={t("nav.pmSellPricePh")}
                                            value={sellForm.sellPrice}
                                            onChange={(e) => setSellForm({ ...sellForm, sellPrice: e.target.value })}
                                            className="h-11 md:h-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sellNetReceived">{t("nav.pmNetReceived")}</Label>
                                    <Input
                                        id="sellNetReceived"
                                        type="number"
                                        inputMode="decimal"
                                        min="0.01"
                                        step="0.01"
                                        placeholder={t("nav.pmNetReceivedPh")}
                                        value={sellForm.netReceived}
                                        onChange={(e) => setSellForm({ ...sellForm, netReceived: e.target.value })}
                                        className="h-11 md:h-10"
                                        aria-describedby="sellNetReceivedHelp"
                                    />
                                    <p id="sellNetReceivedHelp" className="text-xs leading-relaxed text-muted-foreground">
                                        {t("nav.pmNetReceivedHelp")}
                                    </p>
                                </div>
                                <Button type="submit" variant="destructive" className="w-full min-h-[44px]">
                                    <Minus className="h-4 w-4 mr-2" />
                                    {t("nav.pmSellSubmit")}
                                </Button>
                            </form>
                        </TabsContent>

                        {/* History */}
                        <TabsContent value="history" className="space-y-4">
                            <p className="text-sm text-muted-foreground">{t("nav.pmHistoryIntro")}</p>

                            {history.length === 0 ? (
                                <p className="rounded-lg border border-border py-8 text-center text-muted-foreground">
                                    {t("nav.pmNoTx")}
                                </p>
                            ) : (
                                <>
                                    {/* Phones: one card per record */}
                                    <ul className="space-y-2 md:hidden">
                                        {history.map((tx, idx) => (
                                            <li key={idx} className="rounded-lg border border-border p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium">
                                                        <StockSymbolLink symbol={tx.symbol} />
                                                    </span>
                                                    {typeBadge(tx.type)}
                                                </div>
                                                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colDate")}</dt>
                                                        <dd>{fmtDate(tx.date)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colQty")}</dt>
                                                        <dd className="num">{fmtNumber(tx.quantity)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs text-muted-foreground">{t("nav.colPrice")}</dt>
                                                        <dd className="num">{tx.price > 0 ? fmtMoney(tx.price, true) : "-"}</dd>
                                                    </div>
                                                </dl>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Wider screens: table */}
                                    <div className="hidden border rounded-lg overflow-hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("nav.colDate")}</TableHead>
                                                    <TableHead>{t("nav.colType")}</TableHead>
                                                    <TableHead>{t("nav.colSymbol")}</TableHead>
                                                    <TableHead className="text-right">{t("nav.colQty")}</TableHead>
                                                    <TableHead className="text-right">{t("nav.colPrice")}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {history.map((tx, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-sm">{fmtDate(tx.date)}</TableCell>
                                                        <TableCell>{typeBadge(tx.type)}</TableCell>
                                                        <TableCell className="font-medium">
                                                            <StockSymbolLink symbol={tx.symbol} />
                                                        </TableCell>
                                                        <TableCell className="text-right">{fmtNumber(tx.quantity)}</TableCell>
                                                        <TableCell className="text-right">
                                                            {tx.price > 0 ? fmtMoney(tx.price, true) : "-"}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
};
