# Portfolio Insight - Brand Guidelines

## 1. Purpose
Portfolio Insight is a local portfolio tracker for the Nepal Stock Exchange (NEPSE). Its audience is beginner and intermediate retail investors. A beginner should be able to read a page at a glance; an intermediate investor should be able to drill into tables and numbers.

Principles:
- Charts and short summaries carry the information. Tables are the drill-down.
- Plain words. Every finance term has a one or two sentence explanation next to it (the `Explain` info icon).
- Honest about limits. Risk figures are estimates from past prices, not forecasts. The app does not give buy or sell instructions in its own voice.

## 2. Theme: clean light
One light theme. There is no dark mode toggle.

| Role | Value | Token |
| --- | --- | --- |
| Page background | `#f8fafc` | `--background` |
| Card surface | `#ffffff` | `--card` |
| Border | `#e2e8f0` (1px) | `--border` |
| Text | `#0f172a` | `--foreground` |
| Muted text | `#64748b` range, kept at 4.5:1 or better on white | `--muted-foreground` |
| Accent (single) | deep blue, `hsl(224 76% 40%)` | `--primary` |
| Gain | green, `hsl(142 72% 27%)` | `--success` / `text-profit` |
| Loss | red, `hsl(0 70% 42%)` | `--destructive` / `text-loss` |
| Caution | amber, `hsl(28 90% 34%)` | `--warning` |

Gain, loss and caution colours all pass contrast on white. Never use colour alone to carry meaning: pair it with an icon, sign or label.

Cards use `.surface`: white, 1px border, at most a very soft shadow (`0 1px 2px` at 4% opacity).

## 3. Typography
- **UI font**: Inter (400, 500, 600, 700) for headings, body and navigation.
- **Number font**: JetBrains Mono for figures. All numbers use `font-variant-numeric: tabular-nums` so columns align. Table numbers are right-aligned.
- Headings on dashboard sections are questions the reader is asking ("How am I doing?", "What do I own?", "What should I look at?").

## 4. Charts
Shared kit in `src/components/charts/`: `ChartCard`, formatters (`fmtRs`, `fmtFrac`, `fmtFracSigned`, `fmtRsCompact`), `palette.ts`, axis helpers and the tooltip box.

- Every chart has a title that states the takeaway question, readable axis labels, a tooltip, a loading skeleton and an empty state.
- Sector colours come from one fixed categorical palette (`SECTOR_PALETTE`, Okabe-Ito based so it stays distinguishable for colour-blind readers). Colour per sector is assigned by alphabetical order so it matches across charts.
- Money uses Indian digit grouping and lakh / crore wording (`Rs. 4,92,438`, `Rs. 4.92 lakh`).
- Correlation uses a diverging blue to white to red scale.
- Estimated values (holdings without enough price history) are drawn hollow and labelled "estimated".
- No animation on load. Charts render in place.

## 5. Things not to do
- No emojis anywhere in UI copy, code, logs or commit messages. Use `lucide-react` icons or plain text.
- No glassmorphism, blur, glow, neon, gradient borders, gradient buttons, or hover scale effects.
- No staggered fade-ins or auto-cycling features.
- No whimsical labels. Use plain action words: `Refresh`, `Run analysis`, `Turn On`.
- No marketing words ("seamless", "leverage", "game-changer") in copy.
- Do not present the sector quality screen as a list of stocks to buy. A backtest found no evidence it beats its sector average (see `docs/research/PHASE2_RESULTS.md`).

## 6. Components worth knowing
- `Explain` (`src/components/Explain.tsx`) with definitions in `src/lib/glossary.ts`.
- `FindingsList`: severity shown by a coloured left rule, an icon and a text label.
- `StatusIcon`: maps plain icon keys from `valuationScoring.ts` to lucide icons at render time.
- Research checklist (`src/components/research/`): content lives in `src/data/researchGuide.ts`; ticks are stored per symbol in `localStorage`.

## 7. Logo variants
Located in `brand_assets/`:
1. `logo-1-chart.svg`: a line chart with an upward trend (currently used as the favicon).
2. `logo-2-monogram.svg`: a minimalist P and I monogram.
3. `logo-3-pie.svg`: a pie chart abstraction.

The favicon is still the dark-background chart mark. Choose and approve a light-background variant before generating the final `favicon.ico`.

## 8. Dark theme (optional)
Light is the default. Dark is chosen from the header Theme menu (Light, Dark, System) or by pressing `t` to cycle. The choice is saved in `localStorage` (`pi_theme`); System follows the operating system and reacts when it changes. A small script in `index.html` applies the class before first paint, so there is no flash. `color-scheme` and `theme-color` follow the theme.

All colours live in `src/index.css` as tokens under `:root` and `.dark`. Components and charts reference tokens (`bg-card`, `hsl(var(--chart-grid))`), never raw hex.

| Role | Dark value |
| --- | --- |
| Page | `hsl(160 20% 4%)` (`#080c0a`, emerald black) |
| Card | `hsl(160 15% 8%)` |
| Border | `hsl(160 12% 18%)` |
| Text | `hsl(150 20% 95%)` |
| Muted text | `hsl(150 10% 60%)` |
| Accent | `hsl(158 64% 52%)` (emerald) |
| Gain / loss / caution | `hsl(142 71% 45%)` / `hsl(0 72% 58%)` / `hsl(45 93% 58%)` (gold) |

This is the app's original dark palette, kept at the owner's request (2026-11-11); do not replace it with a blue or navy dark.

Dark has its own sector palette (`--sector-1..10`), status scale (`--status-1..5`) and correlation heat ends (`--heat-hot`, `--heat-cold`); the heatmap midpoint is the card colour. Fixed Tailwind `text-*-700` classes in older components are remapped to the semantic tokens under `.dark` in `index.css`. Flat surfaces only: no glow, gradient, blur or neon in either theme.
