import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/Explain';
import { Loader2, Search, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { fetchCorporateIssues, CorporateIssue } from '@/services/investmentApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { useT } from '@/i18n';
import { fmtDate, fmtMoney, fmtNumber } from '@/i18n/format';

type IssueState = 'pipeline' | 'upcoming' | 'closed' | 'open';

/** Whole days from a YYYY-MM-DD date to today (local), negative when the date has passed. */
const daysFromToday = (iso: string): number => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
};

export const IPOTable = () => {
    const { t } = useT();
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

    const stateOf = (issue: CorporateIssue): IssueState => {
        const { opening_date, closing_date } = issue;
        if (!opening_date) return 'pipeline';
        if (daysFromToday(opening_date) > 0) return 'upcoming';
        if (closing_date && daysFromToday(closing_date) < 0) return 'closed';
        return 'open';
    };

    const StatusBadge = ({ state }: { state: IssueState }) => {
        if (state === 'pipeline') {
            return <Badge variant="outline" className="border-border text-muted-foreground">{t('market.statusPipeline')}</Badge>;
        }
        if (state === 'upcoming') {
            return <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{t('market.statusUpcoming')}</Badge>;
        }
        if (state === 'closed') {
            return <Badge variant="outline" className="bg-muted/40 text-muted-foreground">{t('market.statusClosed')}</Badge>;
        }
        return <Badge variant="outline" className="border-success/30 bg-success/10 font-semibold text-success">{t('market.statusOpen')}</Badge>;
    };

    /** Plain-words timing line: days left when open, days until opening when upcoming. */
    const timingText = (issue: CorporateIssue, state: IssueState): string | null => {
        if (state === 'open' && issue.closing_date) {
            const n = daysFromToday(issue.closing_date);
            if (n <= 0) return t('market.closesToday');
            return n === 1 ? t('market.oneDayLeft') : t('market.daysLeft', { n });
        }
        if (state === 'upcoming' && issue.opening_date) {
            const n = daysFromToday(issue.opening_date);
            return n === 1 ? t('market.opensTomorrow') : t('market.opensIn', { n });
        }
        return null;
    };

    const typeLabel = (raw: string): string => {
        const s = (raw || '').toLowerCase().trim();
        if (!s || s === 'others' || s === 'other' || s === 'ipo' || s.includes('ordinary')) return t('market.typeIpo');
        if (s.includes('right')) return t('market.typeRight');
        if (s.includes('fpo')) return t('market.typeFpo');
        if (s.includes('mutual') || s.includes('fund')) return t('market.typeMutual');
        if (s.includes('debenture') || s.includes('bond')) return t('market.typeDebenture');
        return raw;
    };

    const filteredIssues = useMemo(() => {
        return issues.filter(iss => {
            const matchesSearch =
                iss.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (iss.symbol && iss.symbol.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (typeFilter === 'all') return true;
            const ty = (iss.share_type || '').toLowerCase();
            if (typeFilter === 'right') return ty.includes('right');
            if (typeFilter === 'mutual') return ty.includes('mutual') || ty.includes('fund');
            if (typeFilter === 'ipo') return !ty.includes('right') && !ty.includes('fund');
            return true;
        });
    }, [issues, searchQuery, typeFilter]);

    const shown = filteredIssues.slice(0, 50);
    const filters: { key: string; label: string }[] = [
        { key: 'all', label: t('market.ipoFilterAll', { n: issues.length }) },
        { key: 'ipo', label: t('market.ipoFilterIpo') },
        { key: 'right', label: t('market.ipoFilterRight') },
        { key: 'mutual', label: t('market.ipoFilterMutual') },
    ];

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                            {t('market.ipoTitle')}
                            <Explain term="ipo" />
                        </CardTitle>
                        <CardDescription className="leading-relaxed">{t('market.ipoSubtitle')}</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={isLoading}
                        className="min-h-[44px] shrink-0 gap-2 md:min-h-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {/* What an IPO is, in three sentences */}
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
                    <p>
                        {t('market.ipoExplain1')} {t('market.ipoExplain2')} {t('market.ipoExplain3')}
                    </p>
                    <Link
                        to="/learn#term-ipo"
                        className="mt-2 inline-flex min-h-[44px] items-center gap-1 font-medium text-primary hover:underline md:min-h-0"
                    >
                        {t('market.ipoLearn')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            placeholder={t('market.ipoSearch')}
                            aria-label={t('market.ipoSearch')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-11 pl-9 text-base md:h-9 md:text-sm"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('market.ipoFilterLabel')}>
                        {filters.map((f) => (
                            <Button
                                key={f.key}
                                variant={typeFilter === f.key ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTypeFilter(f.key)}
                                aria-pressed={typeFilter === f.key}
                                className="min-h-[44px] text-xs md:min-h-0 md:h-9"
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                        <span className="text-sm">{t('market.loadingIssues')}</span>
                    </div>
                ) : shown.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">{t('market.emptyIssues')}</div>
                ) : (
                    <>
                        {/* Phones: one card per issue */}
                        <ul className="space-y-3 md:hidden">
                            {shown.map((issue, idx) => {
                                const state = stateOf(issue);
                                const timing = timingText(issue, state);
                                return (
                                    <li key={`${issue.symbol || ''}_${idx}`} className="surface p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium leading-snug">{issue.company_name}</p>
                                                {issue.symbol && (
                                                    <span className="text-xs text-muted-foreground">
                                                        <StockSymbolLink symbol={issue.symbol} />
                                                    </span>
                                                )}
                                            </div>
                                            <StatusBadge state={state} />
                                        </div>
                                        {timing && <p className="mt-1 text-sm font-medium text-foreground">{timing}</p>}
                                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm leading-relaxed">
                                            <div>
                                                <dt className="text-xs text-muted-foreground">{t('market.colType')}</dt>
                                                <dd>{typeLabel(issue.share_type)}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">{t('market.colPrice')}</dt>
                                                <dd className="font-mono">{issue.issue_price > 0 ? fmtMoney(issue.issue_price, true) : '-'}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">{t('market.colOpens')}</dt>
                                                <dd>{issue.opening_date ? fmtDate(issue.opening_date) : t('market.notAnnounced')}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">{t('market.colCloses')}</dt>
                                                <dd>{issue.closing_date ? fmtDate(issue.closing_date) : t('market.notAnnounced')}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">{t('market.colUnits')}</dt>
                                                <dd className="font-mono">{issue.total_units > 0 ? fmtNumber(issue.total_units) : '-'}</dd>
                                            </div>
                                        </dl>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Tablets and desktops: table */}
                        <div className="hidden overflow-x-auto rounded-md border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40">
                                        <TableHead>{t('market.colStatus')}</TableHead>
                                        <TableHead>{t('market.colCompany')}</TableHead>
                                        <TableHead>{t('market.colType')}</TableHead>
                                        <TableHead className="text-right">{t('market.colPrice')}</TableHead>
                                        <TableHead className="text-right">{t('market.colUnits')}</TableHead>
                                        <TableHead className="text-right">{t('market.colOpens')}</TableHead>
                                        <TableHead className="text-right">{t('market.colCloses')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shown.map((issue, idx) => {
                                        const state = stateOf(issue);
                                        const timing = timingText(issue, state);
                                        return (
                                            <TableRow key={`${issue.symbol || ''}_${idx}`} className="hover:bg-muted/30">
                                                <TableCell>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <StatusBadge state={state} />
                                                        {timing && <span className="text-xs text-muted-foreground">{timing}</span>}
                                                    </div>
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
                                                    <Badge variant="outline" className="text-xs">{typeLabel(issue.share_type)}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {issue.issue_price > 0 ? fmtMoney(issue.issue_price, true) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    {issue.total_units > 0 ? fmtNumber(issue.total_units) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                    {issue.opening_date ? fmtDate(issue.opening_date) : t('market.notAnnounced')}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                    {issue.closing_date ? fmtDate(issue.closing_date) : t('market.notAnnounced')}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
                {filteredIssues.length > 50 && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                        {t('market.showingTop', { shown: 50, total: filteredIssues.length })}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
