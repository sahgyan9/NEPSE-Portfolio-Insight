import React, { useMemo, useState } from 'react';
import type { DividendTrendPoint } from '@/services/receivedDividendsApi';

interface DividendSparklineProps {
    trend?: DividendTrendPoint[];
    width?: number;
    height?: number;
}

export const DividendSparkline: React.FC<DividendSparklineProps> = ({
    trend = [],
    width = 118,
    height = 34,
}) => {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const { points, linePath, areaPath, activeDots, minVal, maxVal, getX, getY } = useMemo(() => {
        const validPoints = (trend || []).filter(p => p && p.fiscalYear);
        if (validPoints.length === 0) {
            return {
                points: [],
                linePath: '',
                areaPath: '',
                activeDots: [],
                minVal: 0,
                maxVal: 0,
                getX: () => 0,
                getY: () => 0,
            };
        }

        const padX = 4;
        const padY = 4;
        const usableWidth = width - 2 * padX;
        const usableHeight = height - 2 * padY;

        const values = validPoints.map(p => p.totalPercent);
        const maxPercent = Math.max(...values, 5); // baseline floor at 5% for scale stability
        const minPercent = 0; // always ground the area chart at 0%

        const range = Math.max(maxPercent - minPercent, 1e-6);

        const getYCoord = (val: number) => {
            const normalized = (val - minPercent) / range;
            return height - padY - normalized * usableHeight;
        };

        if (validPoints.length === 1) {
            const singlePt = validPoints[0];
            const yCoord = getYCoord(singlePt.totalPercent);
            // Draw a clean flat horizontal line across the cell with area fill underneath
            const lPath = `M ${padX} ${yCoord.toFixed(1)} L ${(width - padX).toFixed(1)} ${yCoord.toFixed(1)}`;
            const aPath = `M ${padX} ${yCoord.toFixed(1)} L ${(width - padX).toFixed(1)} ${yCoord.toFixed(1)} L ${(width - padX).toFixed(1)} ${(height - padY).toFixed(1)} L ${padX} ${(height - padY).toFixed(1)} Z`;
            const dots = [
                {
                    cx: width / 2,
                    cy: yCoord,
                    point: singlePt,
                    idx: 0,
                },
            ];

            return {
                points: validPoints,
                linePath: lPath,
                areaPath: aPath,
                activeDots: dots,
                minVal: 0,
                maxVal: maxPercent,
                getX: () => width / 2,
                getY: getYCoord,
            };
        }

        const getXCoord = (index: number) => {
            return padX + (index / (validPoints.length - 1)) * usableWidth;
        };

        let lPath = `M ${getXCoord(0).toFixed(1)} ${getYCoord(validPoints[0].totalPercent).toFixed(1)}`;
        for (let i = 1; i < validPoints.length; i++) {
            lPath += ` L ${getXCoord(i).toFixed(1)} ${getYCoord(validPoints[i].totalPercent).toFixed(1)}`;
        }

        const aPath = `${lPath} L ${getXCoord(validPoints.length - 1).toFixed(1)} ${(height - padY).toFixed(1)} L ${getXCoord(0).toFixed(1)} ${(height - padY).toFixed(1)} Z`;

        const dots = validPoints.map((pt, i) => ({
            cx: getXCoord(i),
            cy: getYCoord(pt.totalPercent),
            point: pt,
            idx: i,
        }));

        return {
            points: validPoints,
            linePath: lPath,
            areaPath: aPath,
            activeDots: dots,
            minVal: 0,
            maxVal: maxPercent,
            getX: getXCoord,
            getY: getYCoord,
        };
    }, [trend, width, height]);

    if (!linePath || points.length === 0) {
        return (
            <div className="h-[34px] flex items-center justify-center text-xs text-muted-foreground/60 font-mono">
                —
            </div>
        );
    }

    const strokeColor = '#84cc16'; // Lime/green matching reference image
    const fillColor = 'rgba(132, 204, 22, 0.22)';
    const hoveredPoint = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length ? points[hoverIdx] : null;

    const hoveredX = hoverIdx !== null ? (points.length === 1 ? width / 2 : getX(hoverIdx)) : 0;
    const hoveredY = hoveredPoint ? getY(hoveredPoint.totalPercent) : 0;

    return (
        <div className="relative inline-block select-none" onMouseLeave={() => setHoverIdx(null)}>
            <svg
                width={width}
                height={height}
                className="overflow-visible block cursor-crosshair"
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    if (points.length === 1) {
                        setHoverIdx(0);
                        return;
                    }
                    let nearestIdx = 0;
                    let minDistance = Infinity;
                    points.forEach((_, i) => {
                        const dist = Math.abs(getX(i) - mouseX);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestIdx = i;
                        }
                    });
                    setHoverIdx(nearestIdx);
                }}
            >
                {/* Translucent Area Fill */}
                <path d={areaPath} fill={fillColor} />

                {/* Main Trend Stroke Line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Discrete points */}
                {activeDots.map((dot) => (
                    <circle
                        key={dot.idx}
                        cx={dot.cx}
                        cy={dot.cy}
                        r={dot.point.isCurrentFy ? 3.0 : 2.0}
                        fill={dot.point.isCurrentFy ? '#65a30d' : strokeColor}
                        opacity={hoverIdx === null || hoverIdx === dot.idx ? 1 : 0.4}
                    />
                ))}

                {/* Hover vertical crosshair & highlight ring */}
                {hoveredPoint && (
                    <>
                        <line
                            x1={hoveredX}
                            y1={2}
                            x2={hoveredX}
                            y2={height - 2}
                            stroke={strokeColor}
                            strokeWidth={1}
                            strokeDasharray="2,2"
                            opacity={0.7}
                        />
                        <circle
                            cx={hoveredX}
                            cy={hoveredY}
                            r={4.5}
                            fill="#ffffff"
                            stroke={strokeColor}
                            strokeWidth={2.2}
                        />
                    </>
                )}
            </svg>

            {/* Interactive Hover Tooltip */}
            {hoveredPoint && (
                <div
                    className="absolute z-50 pointer-events-none rounded-md border border-border bg-popover/95 backdrop-blur-sm px-2.5 py-1.5 text-left text-[11px] shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full transition-opacity duration-150"
                    style={{
                        left: Math.max(20, Math.min(width - 20, hoveredX)),
                        top: -6,
                    }}
                >
                    <div className="flex items-center justify-between gap-2 pb-0.5 border-b border-border/50 font-semibold text-foreground">
                        <span>FY {hoveredPoint.fiscalYear}</span>
                        {hoveredPoint.isCurrentFy && (
                            <span className="text-[9px] font-normal px-1 py-0 rounded bg-emerald-500/10 text-emerald-600 font-mono">
                                Selected
                            </span>
                        )}
                    </div>
                    <div className="pt-1 space-y-0.5 font-mono">
                        <div className="text-emerald-600 font-bold">
                            {hoveredPoint.totalPercent.toFixed(2)}% Total
                        </div>
                        <div className="text-[10px] text-muted-foreground flex gap-2">
                            <span>Bonus: {hoveredPoint.bonusPercent}%</span>
                            <span>Cash: {hoveredPoint.cashPercent.toFixed(2)}%</span>
                        </div>
                        {hoveredPoint.heldQty > 0 ? (
                            <div className="pt-0.5 text-[10px] text-primary font-sans border-t border-border/30 mt-1">
                                <span className="font-semibold">Received: </span>
                                {hoveredPoint.receivedBonus > 0 && <span>+{hoveredPoint.receivedBonus} shares </span>}
                                {hoveredPoint.receivedCash > 0 && (
                                    <span>Rs. {hoveredPoint.receivedCash.toLocaleString('en-NP', { maximumFractionDigits: 1 })}</span>
                                )}
                                {hoveredPoint.receivedBonus === 0 && hoveredPoint.receivedCash === 0 && (
                                    <span className="text-muted-foreground">0 received</span>
                                )}
                                <span className="text-muted-foreground block text-[9px] font-mono">
                                    (Held: {hoveredPoint.heldQty} sh)
                                </span>
                            </div>
                        ) : (
                            <div className="pt-0.5 text-[10px] text-muted-foreground/80 italic border-t border-border/30 mt-1 font-sans">
                                Not held in portfolio
                            </div>
                        )}
                        {(hoveredPoint.bookClosureDateAD || hoveredPoint.bookClosureDateBS) && (
                            <div className="text-[9px] text-muted-foreground/70 font-sans">
                                BC: {hoveredPoint.bookClosureDateAD || hoveredPoint.bookClosureDateBS}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
