/**
 * ShareSparkline
 * ==============
 * Tiny inline SVG step-chart showing cumulative BONUS shares received from
 * dividends over the holder's whole tracked history (steps up at each book
 * closure date). This tracks "how many shares has this stock given me for
 * free", not total share count - buy/sell activity belongs to the portfolio
 * holdings view, not this dividend-specific one.
 */

import { useMemo, useState } from 'react';
import type { SharePoint } from '@/services/receivedDividendsApi';

interface ShareSparklineProps {
    timeline: SharePoint[];
    width?: number;
    height?: number;
}

export const ShareSparkline = ({ timeline, width = 110, height = 34 }: ShareSparklineProps) => {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const { points, linePath, areaPath, dots, grew, first, last, x, y } = useMemo(() => {
        const pts = timeline ?? [];
        if (pts.length < 2) {
            return { points: [], linePath: '', areaPath: '', dots: [], grew: false, first: 0, last: 0, x: null, y: null };
        }

        const pad = 3;
        const t0 = new Date(pts[0].date).getTime();
        const t1 = new Date(pts[pts.length - 1].date).getTime();
        const span = Math.max(t1 - t0, 1);
        const minS = Math.min(...pts.map(p => p.shares));
        const maxS = Math.max(...pts.map(p => p.shares));
        const range = Math.max(maxS - minS, 1e-9);
        const flat = maxS === minS;

        const xFn = (d: string) => pad + ((new Date(d).getTime() - t0) / span) * (width - 2 * pad);
        const yFn = (s: number) => flat
            ? height / 2
            : height - pad - ((s - minS) / range) * (height - 2 * pad);

        // Step path: horizontal to event date, then vertical jump
        let d = `M ${xFn(pts[0].date).toFixed(1)} ${yFn(pts[0].shares).toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${xFn(pts[i].date).toFixed(1)} ${yFn(pts[i - 1].shares).toFixed(1)}`;
            d += ` L ${xFn(pts[i].date).toFixed(1)} ${yFn(pts[i].shares).toFixed(1)}`;
        }

        const area = `${d} L ${(width - pad).toFixed(1)} ${(height - pad).toFixed(1)} L ${pad} ${(height - pad).toFixed(1)} Z`;

        // Dots only where the count actually jumped (bonus credited)
        const jumpDots = pts
            .filter((p, i) => i > 0 && p.shares !== pts[i - 1].shares)
            .map(p => ({ cx: xFn(p.date), cy: yFn(p.shares), date: p.date, shares: p.shares }));

        return {
            points: pts,
            linePath: d,
            areaPath: area,
            dots: jumpDots,
            grew: pts[pts.length - 1].shares > pts[0].shares,
            first: pts[0].shares,
            last: pts[pts.length - 1].shares,
            x: xFn,
            y: yFn,
        };
    }, [timeline, width, height]);

    if (!linePath || !x || !y) return <span className="text-xs text-muted-foreground">-</span>;

    const color = grew ? 'hsl(152 76% 40%)' : 'hsl(215 15% 55%)';
    const totalGained = last - first;
    const hovered = hoverIdx !== null ? points[hoverIdx] : null;

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <svg
                    width={width}
                    height={height}
                    className="overflow-visible cursor-crosshair"
                    onMouseLeave={() => setHoverIdx(null)}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mx = e.clientX - rect.left;
                        let nearest = 0;
                        let nearestDist = Infinity;
                        points.forEach((p, i) => {
                            const dist = Math.abs(x(p.date) - mx);
                            if (dist < nearestDist) {
                                nearestDist = dist;
                                nearest = i;
                            }
                        });
                        setHoverIdx(nearest);
                    }}
                >
                    <path d={areaPath} fill={color} opacity={0.12} />
                    <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
                    {dots.map((dot, i) => (
                        <circle key={i} cx={dot.cx} cy={dot.cy} r={2.5} fill={color} />
                    ))}
                    {hovered && (
                        <>
                            <line x1={x(hovered.date)} y1={0} x2={x(hovered.date)} y2={height} stroke={color} strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />
                            <circle cx={x(hovered.date)} cy={y(hovered.shares)} r={3} fill="white" stroke={color} strokeWidth={1.5} />
                        </>
                    )}
                </svg>
                {hovered && (
                    <div
                        className="absolute z-10 pointer-events-none rounded-md border bg-popover px-2 py-1 text-[10px] shadow-md whitespace-nowrap -translate-x-1/2 -translate-y-full"
                        style={{ left: x(hovered.date), top: -6 }}
                    >
                        <div className="font-semibold">{hovered.shares} bonus sh.</div>
                        <div className="text-muted-foreground">{hovered.date}</div>
                    </div>
                )}
            </div>
            {grew && (
                <span className="text-[10px] font-mono text-emerald-500 whitespace-nowrap">
                    +{totalGained} sh.
                </span>
            )}
        </div>
    );
};
