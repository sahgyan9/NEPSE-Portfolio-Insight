import { useState, useEffect } from "react";
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
import { Plus, Minus, Database, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { StockSymbolLink } from "@/components/StockSymbolLink";
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

interface PortfolioManagerProps {
    onPortfolioChange?: () => void;
}

export const PortfolioManager = ({ onPortfolioChange }: PortfolioManagerProps) => {
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

    // Form states for selling stock
    const [sellForm, setSellForm] = useState({
        symbol: "",
        quantity: "",
        sellPrice: "",
    });

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
                title: result.action === "added" ? "Stock Added" : "Stock Updated",
                description: `${addForm.symbol} has been ${result.action} successfully.`,
            });

            // Refetch transactions
            const txns = await getTransactions();
            setTransactions(txns);

            // Notify parent to refresh
            onPortfolioChange?.();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleSellStock = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await sellStock(
                sellForm.symbol,
                Number(sellForm.quantity),
                sellForm.sellPrice ? Number(sellForm.sellPrice) : undefined
            );

            setHoldings(result.holdings);
            setSellForm({ symbol: "", quantity: "", sellPrice: "" });

            toast({
                title: "Stock Sold",
                description: `${sellForm.quantity} units of ${sellForm.symbol} sold.`,
            });

            // Refetch transactions
            const txns = await getTransactions();
            setTransactions(txns);

            // Notify parent to refresh
            onPortfolioChange?.();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDeleteStock = async (symbol: string) => {
        if (!confirm(`Are you sure you want to remove ${symbol} from your portfolio?`)) {
            return;
        }

        try {
            const result = await deleteStock(symbol);
            setHoldings(result.holdings);
            toast({
                title: "Stock Removed",
                description: `${symbol} has been removed from your portfolio.`,
            });

            // Notify parent to refresh
            onPortfolioChange?.();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Database className="h-4 w-4" />
                    <span className="hidden xl:inline">Manage</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Portfolio Database Manager
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        {isConnected ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Connected to local database
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <span className="text-yellow-500">
                                    Database not connected. Run: <code className="bg-muted px-1 rounded">python portfolio_db.py</code>
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {!isConnected ? (
                    <div className="p-8 text-center space-y-4">
                        <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
                        <h3 className="text-lg font-semibold">Database Server Not Running</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            To manage your portfolio, start the database server by running:
                        </p>
                        <code className="block bg-muted p-3 rounded-lg font-mono text-sm">
                            python portfolio_db.py
                        </code>
                        <Button onClick={fetchData} variant="outline" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Retry Connection
                        </Button>
                    </div>
                ) : (
                    <Tabs defaultValue="holdings" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="holdings">Holdings ({holdings.length})</TabsTrigger>
                            <TabsTrigger value="add">
                                <Plus className="h-4 w-4 mr-1" />
                                Buy
                            </TabsTrigger>
                            <TabsTrigger value="sell">
                                <Minus className="h-4 w-4 mr-1" />
                                Sell
                            </TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                        </TabsList>

                        {/* Holdings Tab */}
                        <TabsContent value="holdings" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    Your current stock holdings stored in the database.
                                </p>
                                <Button onClick={fetchData} variant="ghost" size="sm" disabled={loading}>
                                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead>Company</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Avg. Cost</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead></TableHead>
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
                                                <TableCell className="text-right">{h.quantity}</TableCell>
                                                <TableCell className="text-right">Rs. {h.avgCost.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    Rs. {(h.quantity * h.avgCost).toLocaleString("en-NP", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteStock(h.symbol)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {holdings.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No holdings found. Add your first stock!
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* Add Stock Tab */}
                        <TabsContent value="add" className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Add a new stock or add more units to an existing holding.
                            </p>
                            <form onSubmit={handleAddStock} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="symbol">Symbol *</Label>
                                        <Input
                                            id="symbol"
                                            placeholder="e.g., NABIL"
                                            value={addForm.symbol}
                                            onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value.toUpperCase() })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company">Company Name</Label>
                                        <Input
                                            id="company"
                                            placeholder="e.g., Nabil Bank Limited"
                                            value={addForm.company}
                                            onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Quantity *</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="1"
                                            placeholder="e.g., 100"
                                            value={addForm.quantity}
                                            onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="avgCost">Average Cost (Rs.) *</Label>
                                        <Input
                                            id="avgCost"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="e.g., 500.00"
                                            value={addForm.avgCost}
                                            onChange={(e) => setAddForm({ ...addForm, avgCost: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add to Portfolio
                                </Button>
                            </form>
                        </TabsContent>

                        {/* Sell Stock Tab */}
                        <TabsContent value="sell" className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Sell stocks from your portfolio.
                            </p>
                            <form onSubmit={handleSellStock} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sellSymbol">Symbol *</Label>
                                    <Input
                                        id="sellSymbol"
                                        placeholder="e.g., NABIL"
                                        value={sellForm.symbol}
                                        onChange={(e) => setSellForm({ ...sellForm, symbol: e.target.value.toUpperCase() })}
                                        required
                                    />
                                    {sellForm.symbol && (
                                        <p className="text-xs text-muted-foreground">
                                            Current holding: {holdings.find((h) => h.symbol === sellForm.symbol)?.quantity || 0} units
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="sellQuantity">Quantity to Sell *</Label>
                                        <Input
                                            id="sellQuantity"
                                            type="number"
                                            min="1"
                                            placeholder="e.g., 50"
                                            value={sellForm.quantity}
                                            onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sellPrice">Sell Price (Rs.)</Label>
                                        <Input
                                            id="sellPrice"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="Optional - for record"
                                            value={sellForm.sellPrice}
                                            onChange={(e) => setSellForm({ ...sellForm, sellPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <Button type="submit" variant="destructive" className="w-full">
                                    <Minus className="h-4 w-4 mr-2" />
                                    Sell Stock
                                </Button>
                            </form>
                        </TabsContent>

                        {/* Transaction History Tab */}
                        <TabsContent value="history" className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Your buy/sell transaction history.
                            </p>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.slice().reverse().map((t, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="text-sm">{t.date}</TableCell>
                                                <TableCell>
                                                    <Badge variant={t.type === "BUY" ? "default" : "destructive"}>
                                                        {t.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <StockSymbolLink symbol={t.symbol} />
                                                </TableCell>
                                                <TableCell className="text-right">{t.quantity}</TableCell>
                                                <TableCell className="text-right">
                                                    {t.price > 0 ? `Rs. ${t.price.toFixed(2)}` : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {transactions.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No transactions yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
};
