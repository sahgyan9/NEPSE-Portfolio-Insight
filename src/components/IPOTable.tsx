import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, RefreshCw, Calendar, Sparkles, Filter } from 'lucide-react';
import { fetchCorporateIssues, CorporateIssue } from '@/services/investmentApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';

export const IPOTable = () => {
    const [issues, setIssues] = useState<CorporateIssue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const loadData = async () => {
        setIsLoading(true);
        const data = await fetchCorporateIssues();
        setIssues(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Classify issue status based on today's date
    const todayStr = new Date().toISOString().slice(0, 10);

    const getStatusBadge = (issue: CorporateIssue) => {
        const { opening_date, closing_date } = issue;
        if (!opening_date) {
            return <Badge variant="outline" className="text-muted-foreground border-border">Pipeline</Badge>;
        }
        if (todayStr < opening_date) {
            return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Upcoming</Badge>;
        }
        if (closing_date && todayStr > closing_date) {
            return <Badge variant="outline" className="text-muted-foreground bg-muted/40">Closed</Badge>;
        }
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse">Open Now</Badge>;
    };

    const formatShareType = (type: string) => {
        if (!type || type.toLowerCase() === 'others') return 'IPO / Issue';
        return type;
    };

    const filteredIssues = useMemo(() => {
        return issues.filter(iss => {
            const matchesSearch =
                iss.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (iss.symbol && iss.symbol.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (typeFilter === 'all') return true;
            const t = (iss.share_type || '').toLowerCase();
            if (typeFilter === 'right') return t.includes('right');
            if (typeFilter === 'mutual') return t.includes('mutual') || t.includes('fund');
            if (typeFilter === 'ipo') return !t.includes('right') && !t.includes('fund');
            return true;
        });
    }, [issues, searchQuery, typeFilter]);

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-500" />
                            IPO & Corporate Issues Pipeline
                        </CardTitle>
                        <CardDescription>
                            Real-time tracking of forthcoming, open, and approved IPOs, Right Shares, and Mutual Funds
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={isLoading}
                        className="gap-2 shrink-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by company name or symbol..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        <Button
                            variant={typeFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('all')}
                            className="h-9 text-xs"
                        >
                            All ({issues.length})
                        </Button>
                        <Button
                            variant={typeFilter === 'ipo' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('ipo')}
                            className="h-9 text-xs"
                        >
                            IPOs
                        </Button>
                        <Button
                            variant={typeFilter === 'right' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('right')}
                            className="h-9 text-xs"
                        >
                            Right Shares
                        </Button>
                        <Button
                            variant={typeFilter === 'mutual' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('mutual')}
                            className="h-9 text-xs"
                        >
                            Mutual Funds
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Fetching corporate issues from exchange streams...</span>
                    </div>
                ) : filteredIssues.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                        No corporate issues matched your search criteria.
                    </div>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="w-[80px]">Status</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Price (NPR)</TableHead>
                                    <TableHead className="text-right">Units</TableHead>
                                    <TableHead className="text-right">Opening Date</TableHead>
                                    <TableHead className="text-right">Closing Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredIssues.slice(0, 50).map((issue, idx) => (
                                    <TableRow key={`${issue.symbol || ''}_${idx}`} className="hover:bg-muted/30">
                                        <TableCell>
                                            {getStatusBadge(issue)}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{issue.company_name}</span>
                                                {issue.symbol && (
                                                    <span className="text-xs text-muted-foreground">
                                                        <StockSymbolLink symbol={issue.symbol} />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {formatShareType(issue.share_type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            Rs. {issue.issue_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {issue.total_units > 0
                                                ? Math.round(issue.total_units).toLocaleString('en-IN')
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                            {issue.opening_date || 'TBA'}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                            {issue.closing_date || 'TBA'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {filteredIssues.length > 50 && (
                    <p className="text-xs text-center text-muted-foreground mt-3">
                        Showing top 50 of {filteredIssues.length} issues. Use search to narrow down results.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
