# Portfolio Insight - Brand Guidelines

## 1. Brand Identity & Purpose
**Product Description**: Portfolio Insight is a fast, analytical, and highly visual stock portfolio tracker optimized for the Nepal Stock Exchange (NEPSE).
**Primary Audience**: Students and individual investors trading in NEPSE who need clear, data-driven insights for long term.
**Core Values**: Trustworthy, Precise, Dynamic, Growth-oriented.

## 2. Color Palette
The color system emphasizes readability for financial data while maintaining a premium, "dark-mode first" dashboard aesthetic.

- **Background (Dark Mode)**: `hsl(160 20% 4%)` (#080C0A) - Deep forest/emerald black. Provides a sleek, low-strain backdrop.
- **Card Surface**: `hsl(160 15% 8%)` (#111714) - Slightly elevated dark green-grey.
- **Primary / Growth**: `hsl(158 64% 52%)` (#33CC8C) - Energetic, trustworthy emerald green used for primary actions, positive growth, and main branding.
- **Accent / Hold**: `hsl(45 93% 58%)` (#F2CA38) - Golden yellow for neutral/hold recommendations.
- **Destructive / Loss**: `hsl(0 72% 51%)` (#DE2424) - Sharp red for negative trends and alerts.
- **Text (Foreground)**: `hsl(150 20% 95%)` (#EEF3F0) - Soft off-white for main text to prevent eye fatigue.

## 3. Typography
We use a two-font system to separate narrative UI elements from tabular financial data.

- **Primary UI Font**: `Inter` (Google Fonts)
  - Used for headings, body text, navigation, and general interface elements.
  - Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold).
- **Data Font**: `JetBrains Mono` (Google Fonts)
  - Used strictly for numbers, tickers, portfolio values, and code-like data.
  - Ensures tabular alignment and crisp financial readouts.

## 4. Visual Elements & UI Personality
- **Glassmorphism**: Cards feature subtle `backdrop-blur-xl` and low-opacity borders (`border-border/50`) to create depth.
- **Micro-interactions**: Components use smooth scaling (`hover:scale-[1.02]`) and subtle primary border glowing on hover.
- **Gradients**: Use `linear-gradient` for primary buttons and positive/negative trend cards to avoid flat designs. Example: `linear-gradient(135deg, hsl(158 64% 52%) 0%, hsl(158 64% 42%) 100%)`.
- **Glow Effects**: Key metrics emit a soft drop-shadow glow (e.g., `box-shadow: 0 0 40px hsl(158 64% 52% / 0.3)`).

## 5. Logo Variants
Located in `brand_assets/`, we have three conceptual SVG logos provided:
1. `logo-1-chart.svg`: A line chart integrating an upward trend, representing growth and insight.
2. `logo-2-monogram.svg`: A minimalist 'P' and 'I' monogram.
3. `logo-3-pie.svg`: A modern pie chart abstraction with an insightful 'eye' motif.

*(Please review these concepts and approve the preferred one before generating the final `favicon.ico`.)*
