/**
 * Dividends Page (Manual Entry)
 * --------------------------------
 * - Auto-fetches company name from ShareBazaar API or local registry
 * - User-managed dividend rows saved to file via API (persistent)
 * - Fields: Bonus %, Cash %, Total %, Fiscal Year, Cash Income
 * - Supports editing existing entries
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Trash2, PlusCircle, ArrowLeft, Pencil, Check, X, Loader2, RefreshCw, Save, Database } from 'lucide-react';
import { STORAGE_KEYS } from '@/lib/constants';
import { fetchStockData } from '@/services/sharebazaarApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import {
    getManualDividends,
    addManualDividend,
    updateManualDividend,
    deleteManualDividend,
    isManualDividendServerAvailable,
    ManualDividendEntry
} from '@/services/manualDividendDb';
import { useToast } from '@/hooks/use-toast';

interface DividendRow {
    id: string;
    symbol: string;
    companyName: string;
    fiscalYear: string;
    bonusPercent: number;
    cashPercent: number;
    cashIncome: number;
}

// Local company name registry as fallback
const localCompanyNames: Record<string, string> = {
    BHL: "Balephi Hydropower Limited",
    CHCL: "Chilime Hydropower Company Limited",
    SAHAS: "Sahas Urja Limited",
    SGHC: "Swet-Ganga Hydropower & Construction Limited",
    UPPER: "Upper Tamakoshi Hydropower Ltd.",
    HBL: "Himalayan Bank Limited",
    NABIL: "Nabil Bank Limited",
    NICA: "NIC Asia Bank Ltd.",
    NIMB: "Nepal Investment Mega Bank Limited",
    CBBL: "Chhimek Laghubitta Bittiya Sanstha Limited",
    CLI: "Citizen Life Insurance Company Limited",
    SNLI: "Sun Nepal Life Insurance Company Limited",
    HRL: "Himalayan Reinsurance Limited",
    HDL: "Himalayan Distillery Limited",
    GCIL: "Ghorahi Cement Industry Limited",
    SARBTM: "Sarbottam Cement Limited",
    SONA: "Sonapur Minerals And Oil Limited",
    NTC: "Nepal Doorsanchar Company Limited",
    CSY: "Citizens Super Yield Fund",
    KDBY: "Kumari Dhanabriddhi Yojana",
    MMF1: "Mahila Sambriddhi Kosh",
    NBF3: "Nabil Balanced Fund 3",
    NIBLSF: "NIBL Samriddhi Fund",
    NMBSBFE: "NMB Saral Bachat Fund - E",
};

const DividendsPage = () => {
    const [apiKey, setApiKey] = useState('');
    const [rows, setRows] = useState<DividendRow[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<DividendRow | null>(null);
    const [isFetchingName, setIsFetchingName] = useState(false);
    const [isRefreshingNames, setIsRefreshingNames] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [serverAvailable, setServerAvailable] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const { toast } = useToast();
    const [draft, setDraft] = useState<Omit<DividendRow, 'id'>>({
        symbol: '',
        companyName: '',
        fiscalYear: '',
        bonusPercent: 0,
        cashPercent: 0,
        cashIncome: 0,
    });

    // Fetch company name from API or local registry
    const fetchCompanyName = useCallback(async (symbol: string): Promise<string> => {
        const upperSymbol = symbol.toUpperCase().trim();

        // First check local registry
        if (localCompanyNames[upperSymbol]) {
            return localCompanyNames[upperSymbol];
        }

        // Try to fetch from ShareBazaar API
        try {
            setIsFetchingName(true);
            const data = await fetchStockData(upperSymbol);
            if (data?.company_name && data.company_name.trim() !== '') {
                return data.company_name;
            }
        } catch (error) {
            console.warn('Failed to fetch company name from API:', error);
        } finally {
            setIsFetchingName(false);
        }

        return '';
    }, []);

    // Auto-fetch company name when symbol changes
    useEffect(() => {
        const symbolTrimmed = draft.symbol.trim().toUpperCase();
        if (symbolTrimmed.length >= 2 && !draft.companyName) {
            const timeoutId = setTimeout(async () => {
                const name = await fetchCompanyName(symbolTrimmed);
                if (name) {
                    setDraft(prev => ({ ...prev, companyName: name }));
                }
            }, 500); // Debounce 500ms
            return () => clearTimeout(timeoutId);
        }
    }, [draft.symbol, draft.companyName, fetchCompanyName]);

    // Load api key and saved rows from file
    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
        if (savedKey) setApiKey(savedKey);

        // Load dividend entries from file via API
        const loadDividends = async () => {
            setIsLoading(true);
            try {
                const available = await isManualDividendServerAvailable();
                setServerAvailable(available);

                if (available) {
                    const entries = await getManualDividends();
                    setRows(entries as DividendRow[]);
                    setSaveError(null);
                } else {
                    // Fallback: try to load from localStorage if server is not available
                    const savedRows = localStorage.getItem('manualDividendRows');
                    if (savedRows) {
                        try {
                            const parsed: DividendRow[] = JSON.parse(savedRows);
                            setRows(parsed);
                        } catch (e) {
                            console.warn('Failed to parse saved dividend rows', e);
                        }
                    }
                    setSaveError('Server not available. Data will not persist after browser close.');
                }
            } catch (error) {
                console.error('Failed to load dividend entries:', error);
                setSaveError('Failed to load dividend data from server.');
            } finally {
                setIsLoading(false);
            }
        };

        loadDividends();
    }, []);

    // Auto-populate missing company names for existing rows
    useEffect(() => {
        const updateMissingCompanyNames = async () => {
            const rowsNeedingUpdate = rows.filter(r => !r.companyName);
            if (rowsNeedingUpdate.length === 0) return;

            const updates: Record<string, string> = {};

            for (const row of rowsNeedingUpdate) {
                // First check local registry
                const localName = localCompanyNames[row.symbol.toUpperCase()];
                if (localName) {
                    updates[row.id] = localName;
                    continue;
                }

                // Try API (with delay to avoid rate limiting)
                try {
                    const data = await fetchStockData(row.symbol);
                    if (data?.company_name && data.company_name.trim() !== '') {
                        updates[row.id] = data.company_name;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch company name for ${row.symbol}:`, error);
                }
            }

            if (Object.keys(updates).length > 0) {
                setRows(prev => prev.map(r =>
                    updates[r.id] ? { ...r, companyName: updates[r.id] } : r
                ));
            }
        };

        updateMissingCompanyNames();
    }, [rows.length]); // Only run when rows are first loaded or count changes

    // Also keep localStorage as backup for when server is not available
    useEffect(() => {
        if (rows.length > 0) {
            localStorage.setItem('manualDividendRows', JSON.stringify(rows));
        }
    }, [rows]);

    const handleApiKeyChange = (key: string) => {
        setApiKey(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    };

    const resetDraft = () => {
        setDraft({
            symbol: '',
            companyName: '',
            fiscalYear: '',
            bonusPercent: 0,
            cashPercent: 0,
            cashIncome: 0,
        });
    };

    const addRow = async () => {
        if (!draft.symbol) return;
        const id = `${draft.symbol}-${Date.now()}`;
        const symbol = draft.symbol.toUpperCase();

        // Auto-fetch company name if not provided
        let companyName = draft.companyName;
        if (!companyName) {
            companyName = await fetchCompanyName(symbol);
        }

        const newEntry: DividendRow = {
            id,
            symbol,
            companyName,
            fiscalYear: draft.fiscalYear,
            bonusPercent: draft.bonusPercent || 0,
            cashPercent: draft.cashPercent || 0,
            cashIncome: draft.cashIncome || 0,
        };

        setIsSaving(true);
        setSaveError(null);

        // Check server availability before operation
        const available = await isManualDividendServerAvailable();
        setServerAvailable(available);

        try {
            if (available) {
                const updatedEntries = await addManualDividend(newEntry as ManualDividendEntry);
                setRows(updatedEntries as DividendRow[]);
                toast({
                    title: "Added",
                    description: `${symbol} dividend entry added successfully`,
                });
            } else {
                // Fallback to local state only
                setRows(prev => [newEntry, ...prev]);
                setSaveError('Server not available. Changes saved locally only.');
                toast({
                    title: "Warning",
                    description: "Server not available. Changes saved locally only.",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('Failed to add dividend entry:', error);
            // Still add to local state
            setRows(prev => [newEntry, ...prev]);
            setSaveError('Failed to save to server. Changes saved locally.');
            toast({
                title: "Error",
                description: error.message || "Failed to save to server",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }

        resetDraft();
    };

    const deleteRow = async (id: string) => {
        setIsSaving(true);
        setSaveError(null);

        // Check server availability before operation
        const available = await isManualDividendServerAvailable();
        setServerAvailable(available);

        try {
            if (available) {
                const updatedEntries = await deleteManualDividend(id);
                setRows(updatedEntries as DividendRow[]);
                toast({
                    title: "Deleted",
                    description: "Dividend entry deleted successfully",
                });
            } else {
                setRows(prev => prev.filter(r => r.id !== id));
                setSaveError('Server not available. Changes saved locally only.');
                toast({
                    title: "Warning",
                    description: "Server not available. Changes saved locally only.",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('Failed to delete dividend entry:', error);
            // Still delete from local state
            setRows(prev => prev.filter(r => r.id !== id));
            setSaveError('Failed to delete from server. Changes saved locally.');
            toast({
                title: "Error",
                description: error.message || "Failed to delete from server",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (row: DividendRow) => {
        setEditingId(row.id);
        setEditDraft({ ...row });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditDraft(null);
    };

    const saveEditing = async () => {
        if (!editDraft) return;

        // Auto-fetch company name if cleared
        let companyName = editDraft.companyName;
        if (!companyName) {
            companyName = await fetchCompanyName(editDraft.symbol);
        }

        const updatedEntry: DividendRow = {
            ...editDraft,
            companyName,
            symbol: editDraft.symbol.toUpperCase()
        };

        setIsSaving(true);
        setSaveError(null);

        // Check server availability before operation
        const available = await isManualDividendServerAvailable();
        setServerAvailable(available);

        try {
            if (available) {
                const updatedEntries = await updateManualDividend(editDraft.id, updatedEntry as ManualDividendEntry);
                setRows(updatedEntries as DividendRow[]);
                toast({
                    title: "Updated",
                    description: `${updatedEntry.symbol} dividend entry updated successfully`,
                });
            } else {
                // Fallback to local state only
                setRows(prev => prev.map(r =>
                    r.id === editDraft.id ? updatedEntry : r
                ));
                setSaveError('Server not available. Changes saved locally only.');
                toast({
                    title: "Warning",
                    description: "Server not available. Changes saved locally only.",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('Failed to update dividend entry:', error);
            // Still update local state
            setRows(prev => prev.map(r =>
                r.id === editDraft.id ? updatedEntry : r
            ));
            setSaveError('Failed to save to server. Changes saved locally.');
            toast({
                title: "Error",
                description: error.message || "Failed to save to server",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }

        setEditingId(null);
        setEditDraft(null);
    };

    // Refresh all company names
    const refreshAllCompanyNames = async () => {
        if (rows.length === 0 || isRefreshingNames) return;

        setIsRefreshingNames(true);
        const updates: Record<string, string> = {};

        for (const row of rows) {
            // First check local registry
            const localName = localCompanyNames[row.symbol.toUpperCase()];
            if (localName) {
                updates[row.id] = localName;
                continue;
            }

            // Try API
            try {
                const data = await fetchStockData(row.symbol);
                if (data?.company_name && data.company_name.trim() !== '') {
                    updates[row.id] = data.company_name;
                }
            } catch (error) {
                console.warn(`Failed to fetch company name for ${row.symbol}:`, error);
            }
        }

        if (Object.keys(updates).length > 0) {
            setRows(prev => prev.map(r =>
                updates[r.id] ? { ...r, companyName: updates[r.id] } : r
            ));
        }

        setIsRefreshingNames(false);
    };

    const totalCashIncome = useMemo(
        () => rows.reduce((sum, r) => sum + (r.cashIncome || 0), 0),
        [rows]
    );

    return (
        <div className="min-h-screen bg-background">
            <Header
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
                onRefresh={() => { }}
                isRefreshing={false}
            />

            <main className="container px-4 py-6 space-y-6">
                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Dividend Data (Manual)</h1>
                    <p className="text-muted-foreground">Enter symbol and company name will auto-fetch. Click Edit to modify existing entries.</p>
                </div>

                {isLoading ? (
                    <Alert>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <AlertDescription>Loading dividend data...</AlertDescription>
                    </Alert>
                ) : serverAvailable ? (
                    <Alert className="border-green-500/50 bg-green-500/10">
                        <Database className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700 dark:text-green-300">
                            Data saves to file (db/manual_dividends.json). Your entries persist even after closing the browser.
                            {isSaving && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert variant="destructive">
                        <AlertDescription>
                            Server not available. Data saves locally in your browser only. Start the Python server for persistent storage.
                        </AlertDescription>
                    </Alert>
                )}

                {saveError && (
                    <Alert variant="destructive">
                        <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Add Dividend Entry</CardTitle>
                        <CardDescription>Fields: Bonus %, Cash %, Total %, Fiscal Year, Cash Income</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div>
                                <Label htmlFor="symbol">Symbol</Label>
                                <Input
                                    id="symbol"
                                    placeholder="SNLI"
                                    value={draft.symbol}
                                    onChange={(e) => setDraft({ ...draft, symbol: e.target.value, companyName: '' })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="company">Company {isFetchingName && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                                <Input
                                    id="company"
                                    placeholder={isFetchingName ? "Fetching..." : "Auto-fetched or enter manually"}
                                    value={draft.companyName}
                                    onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="fy">Fiscal Year</Label>
                                <Input
                                    id="fy"
                                    placeholder="081-082"
                                    value={draft.fiscalYear}
                                    onChange={(e) => setDraft({ ...draft, fiscalYear: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="bonus">Bonus %</Label>
                                <Input
                                    id="bonus"
                                    type="number"
                                    step="0.01"
                                    value={draft.bonusPercent}
                                    onChange={(e) => setDraft({ ...draft, bonusPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="cash">Cash %</Label>
                                <Input
                                    id="cash"
                                    type="number"
                                    step="0.01"
                                    value={draft.cashPercent}
                                    onChange={(e) => setDraft({ ...draft, cashPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="income">Cash Income (Rs)</Label>
                                <Input
                                    id="income"
                                    type="number"
                                    step="0.01"
                                    value={draft.cashIncome}
                                    onChange={(e) => setDraft({ ...draft, cashIncome: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={addRow} className="gap-2">
                                <PlusCircle className="h-4 w-4" />
                                Add
                            </Button>
                            <Button variant="outline" onClick={resetDraft} className="gap-2">
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Dividend Table</CardTitle>
                                <CardDescription>Total Cash Income: Rs. {totalCashIncome.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</CardDescription>
                            </div>
                            {rows.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={refreshAllCompanyNames}
                                    disabled={isRefreshingNames}
                                    className="gap-2"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isRefreshingNames ? 'animate-spin' : ''}`} />
                                    {isRefreshingNames ? 'Fetching...' : 'Refresh Names'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {rows.length === 0 ? (
                            <p className="text-muted-foreground">No entries yet. Add rows above.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead className="hidden md:table-cell">Company</TableHead>
                                            <TableHead>Fiscal Year</TableHead>
                                            <TableHead>Bonus %</TableHead>
                                            <TableHead>Cash %</TableHead>
                                            <TableHead>Total %</TableHead>
                                            <TableHead>Cash Income</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const isEditing = editingId === row.id;
                                            const displayRow = isEditing && editDraft ? editDraft : row;
                                            const totalPercent = (displayRow.bonusPercent || 0) + (displayRow.cashPercent || 0);

                                            if (isEditing && editDraft) {
                                                return (
                                                    <TableRow key={row.id} className="bg-muted/50">
                                                        <TableCell>
                                                            <Input
                                                                value={editDraft.symbol}
                                                                onChange={(e) => setEditDraft({ ...editDraft, symbol: e.target.value })}
                                                                className="h-8 w-20"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell">
                                                            <Input
                                                                value={editDraft.companyName}
                                                                onChange={(e) => setEditDraft({ ...editDraft, companyName: e.target.value })}
                                                                placeholder="Auto-fetch on save"
                                                                className="h-8 w-40"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={editDraft.fiscalYear}
                                                                onChange={(e) => setEditDraft({ ...editDraft, fiscalYear: e.target.value })}
                                                                className="h-8 w-24"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={editDraft.bonusPercent}
                                                                onChange={(e) => setEditDraft({ ...editDraft, bonusPercent: parseFloat(e.target.value) || 0 })}
                                                                className="h-8 w-20"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={editDraft.cashPercent}
                                                                onChange={(e) => setEditDraft({ ...editDraft, cashPercent: parseFloat(e.target.value) || 0 })}
                                                                className="h-8 w-20"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-mono font-semibold">{totalPercent.toFixed(2)}%</TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={editDraft.cashIncome}
                                                                onChange={(e) => setEditDraft({ ...editDraft, cashIncome: parseFloat(e.target.value) || 0 })}
                                                                className="h-8 w-24"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex gap-1 justify-end">
                                                                <Button variant="ghost" size="sm" onClick={saveEditing} className="text-green-600 hover:text-green-700 gap-1">
                                                                    <Check className="h-4 w-4" />
                                                                    Save
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={cancelEditing} className="text-muted-foreground hover:text-foreground gap-1">
                                                                    <X className="h-4 w-4" />
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-semibold">
                                                        <StockSymbolLink symbol={row.symbol} />
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{row.companyName || '-'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{row.fiscalYear || '-'}</TableCell>
                                                    <TableCell className="font-mono text-emerald-500">{row.bonusPercent || 0}%</TableCell>
                                                    <TableCell className="font-mono text-amber-500">{row.cashPercent || 0}%</TableCell>
                                                    <TableCell className="font-mono font-semibold">{totalPercent.toFixed(2)}%</TableCell>
                                                    <TableCell className="font-mono">Rs. {row.cashIncome?.toLocaleString('en-NP', { maximumFractionDigits: 0 }) || 0}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            <Button variant="ghost" size="sm" onClick={() => startEditing(row)} className="text-blue-600 hover:text-blue-700 gap-1">
                                                                <Pencil className="h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => deleteRow(row.id)} className="text-destructive hover:text-destructive gap-1">
                                                                <Trash2 className="h-4 w-4" />
                                                                Remove
                                                            </Button>
                                                        </div>
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
            </main>
        </div>
    );
};

export default DividendsPage;
