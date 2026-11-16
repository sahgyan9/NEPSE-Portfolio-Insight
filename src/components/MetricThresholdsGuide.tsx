/**
 * How to read the valuation numbers used by the app's scoring (P/E, P/B, dividend yield, EPS).
 * The bands match the thresholds in src/lib/valuationScoring.ts. Text lives in the `learn`
 * namespace (mt_* keys). On phones each band is a row in a list; from sm up it is also a bar.
 */
import type { ReactNode } from 'react';
import { BarChart3, BookOpen, Coins, Info, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n';

type MetricId = 'pe' | 'pb' | 'dividend' | 'eps';

/** Band ranges per metric, best-scoring first (same order as valuationScoring). */
const BANDS: Record<MetricId, string[]> = {
    pe: ['< 10', '10-15', '15-25', '25-35', '> 35'],
    pb: ['< 1.0', '1.0-1.5', '1.5-2.5', '2.5-4.0', '> 4.0'],
    dividend: ['> 6%', '4-6%', '2-4%', '1-2%', '< 1%'],
    eps: ['> 50', '30-50', '15-30', '5-15', '< 5'],
};

const ICONS: Record<MetricId, ReactNode> = {
    pe: <TrendingUp className="h-5 w-5" aria-hidden="true" />,
    pb: <BarChart3 className="h-5 w-5" aria-hidden="true" />,
    dividend: <Coins className="h-5 w-5" aria-hidden="true" />,
    eps: <TrendingUp className="h-5 w-5" aria-hidden="true" />,
};

const NOTES = ['sector', 'growth', 'dividend', 'faceValue', 'bookValue'] as const;

export const MetricThresholdsGuide = () => {
    const { t } = useT();
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                    {t('learn.mt_title')}
                </CardTitle>
                <CardDescription className="leading-relaxed">{t('learn.mt_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {(Object.keys(BANDS) as MetricId[]).map((id) => (
                    <MetricExplainer key={id} id={id} />
                ))}

                <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <h4 className="mb-3 flex items-center gap-2 font-semibold">
                        <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                        {t('learn.mt_notesTitle')}
                    </h4>
                    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                        {NOTES.map((n) => (
                            <li key={n}>
                                <span className="font-medium text-foreground">{t(`learn.mt_note_${n}_title`)}: </span>
                                {t(`learn.mt_note_${n}`)}
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

const MetricExplainer = ({ id }: { id: MetricId }) => {
    const { t } = useT();
    const bands = BANDS[id];
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
                <div className="hidden rounded-lg bg-primary/10 p-2 text-primary sm:block">{ICONS[id]}</div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold sm:text-lg">{t(`learn.mt_${id}_title`)}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`learn.mt_${id}_def`)}</p>
                    <div className="mt-2 rounded bg-muted/50 p-2 text-sm leading-relaxed">
                        <span className="font-medium">{t('learn.example')}: </span>
                        {t(`learn.mt_${id}_example`)}
                    </div>

                    <p className="mt-4 text-xs font-medium text-muted-foreground">{t(`learn.mt_${id}_direction`)}</p>

                    {/* Colour bar from sm up; every band is also listed in words below. */}
                    <div className="mt-2 hidden h-8 overflow-hidden rounded-lg sm:flex" aria-hidden="true">
                        {bands.map((range, i) => (
                            <div
                                key={range}
                                className="flex flex-1 items-center justify-center"
                                style={{ backgroundColor: `hsl(var(--status-${i + 1}))` }}
                            >
                                <span className="text-xs font-medium text-card">{range}</span>
                            </div>
                        ))}
                    </div>

                    <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                        {bands.map((range, i) => (
                            <li key={range} className="flex items-start gap-3 px-3 py-2">
                                <span
                                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: `hsl(var(--status-${i + 1}))` }}
                                    aria-hidden="true"
                                />
                                <span className="w-16 shrink-0 font-mono text-xs leading-6">{range}</span>
                                <span className="min-w-0 leading-relaxed">
                                    <span className="font-medium">{t(`learn.mt_${id}_band${i}`)}</span>
                                    <span className="text-muted-foreground">. {t(`learn.mt_${id}_band${i}_desc`)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-3 text-sm leading-relaxed">
                        <span className="font-medium">{t('learn.mt_watch')}: </span>
                        {t(`learn.mt_${id}_watch`)}
                    </p>
                </div>
            </div>
        </div>
    );
};

/** Compact version for tooltips. */
export const MetricTooltipContent = ({ metric }: { metric: MetricId }) => {
    const { t } = useT();
    return (
        <div className="max-w-xs">
            <p className="mb-1 font-semibold">{t(`learn.mt_${metric}_title`)}</p>
            <p className="mb-2 text-sm text-muted-foreground">{t(`learn.mt_${metric}_def`)}</p>
            <p className="text-xs">
                {t('learn.mt_watch')}: {t(`learn.mt_${metric}_watch`)}
            </p>
        </div>
    );
};
