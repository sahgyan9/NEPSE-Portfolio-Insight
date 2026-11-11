/**
 * Chart colours come from CSS variables defined in index.css (light and dark), so one place
 * controls both themes. Values are `hsl(var(--token))` strings that SVG attributes and inline
 * styles resolve at paint time, which means charts switch theme without re-rendering.
 */
const v = (token: string) => `hsl(var(--${token}))`;

export const SECTOR_PALETTE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => v(`sector-${i}`));

export const OTHER_COLOR = v("sector-other");

export const CHART = {
  accent: v("chart-accent"),
  accentSoft: v("chart-accent-soft"),
  market: v("chart-market"),
  gain: v("chart-gain"),
  loss: v("chart-loss"),
  caution: v("chart-caution"),
  grid: v("chart-grid"),
  axis: v("chart-axis"),
  text: v("chart-text"),
  cursor: v("chart-cursor"),
  card: v("card"),
  muted: v("muted"),
};

/** Stable colour per sector name (alphabetical order, so it does not shift between charts). */
export const makeSectorColorer = (sectors: string[]) => {
  const order = Array.from(new Set(sectors)).sort();
  return (sector: string): string => {
    const i = order.indexOf(sector);
    if (i < 0) return OTHER_COLOR;
    return SECTOR_PALETTE[i % SECTOR_PALETTE.length];
  };
};

/**
 * Diverging scale for correlation: -1 (cold) .. 0 (card colour) .. +1 (hot).
 * The midpoint is the card colour in either theme, so zero correlation disappears into the card.
 */
export const correlationColor = (value: number): string => {
  const c = Math.max(-1, Math.min(1, value));
  const end = c >= 0 ? v("heat-hot") : v("heat-cold");
  return `color-mix(in srgb, ${end} ${(Math.abs(c) * 100).toFixed(0)}%, ${v("card")})`;
};
