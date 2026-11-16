/**
 * Market page: index summary, new share issues (IPO), and in advanced view the
 * 52-week scanner, company data archive and a short note on how the market works.
 */

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MarketContextDisplay } from '@/components/MarketContext';
import { FundamentalsArchiveCard } from '@/components/FundamentalsArchiveCard';
import { HighLowScannerCard } from '@/components/HighLowScannerCard';
import { IPOTable } from '@/components/IPOTable';
import { AIChatbot } from '@/components/AIChatbot';
import { Explain } from '@/components/Explain';
import { Button } from '@/components/ui/button';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { useApiKey } from '@/hooks/useApiKey';
import { useViewMode } from '@/hooks/useViewMode';
import { useT } from '@/i18n';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const MarketPage = () => {
    const { t } = useT();
    const { isSimple, setMode } = useViewMode();
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

    const { holdings, summary, isLoading, refetch } = usePortfolioAnalytics();

    const handleRefresh = async () => {
        await refetch();
        toast({
            title: t('market.refreshedTitle'),
            description: t('market.refreshedBody'),
        });
    };

    const infoItems = [
        { title: t('market.infoDaysTitle'), body: t('market.infoDays'), term: undefined },
        { title: t('market.infoLimitTitle'), body: t('market.infoLimit'), term: 'circuitBreaker' as const },
        { title: t('market.infoSettleTitle'), body: t('market.infoSettle'), term: 'settlementT2' as const },
        { title: t('market.infoIndexTitle'), body: t('market.infoIndex'), term: 'nepseIndex' as const },
    ];

    return (
        <div className="min-h-screen bg-background">
            <Header
                onRefresh={handleRefresh}
                isRefreshing={isLoading}
            />

            <main className="container px-4 py-6">
                <div className="mb-4">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="min-h-[44px] gap-2 md:min-h-0">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            {t('market.back')}
                        </Button>
                    </Link>
                </div>

                <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t('market.pageTitle')}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t('market.pageIntro')}</p>
                </div>

                <MarketContextDisplay />

                {/* New share issues come first: most new investors start here */}
                <div className="mt-8">
                    <IPOTable />
                </div>

                {isSimple ? (
                    <section className="surface mt-8 p-4">
                        <h2 className="text-base font-semibold">{t('market.showMoreTitle')}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('market.showMoreText')}</p>
                        <Button
                            variant="outline"
                            onClick={() => setMode('advanced')}
                            className="mt-3 min-h-[44px] w-full gap-2 sm:w-auto"
                        >
                            {t('market.showMore')}
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </section>
                ) : (
                    <>
                        <HighLowScannerCard />

                        <FundamentalsArchiveCard />

                        <section className="mt-8 rounded-lg border bg-muted/50 p-4">
                            <h2 className="mb-3 font-semibold">{t('market.infoTitle')}</h2>
                            <div className="grid grid-cols-1 gap-4 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
                                {infoItems.map((it) => (
                                    <div key={it.title}>
                                        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                                            {it.title}
                                            {it.term && <Explain term={it.term} />}
                                        </p>
                                        <p>{it.body}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

export default MarketPage;
