# Prompt Refinement Log: Eliminate UI Flickering and Retire ShareBazaar Labels

- **Date:** 2026-11-07
- **Target Agent/Model:** Gemini 3.8 Flash (High)
- **Goal/Objective:** Prevent page flickering on Dividends and Home pages, eliminate raw emojis in banners, and accurately credit primary data source (HamroShare / NEPSE Server) instead of ShareBazaar.

---

## 🔄 Refinement History

### 1. Initial Prompt / User Feedback
```text
I went to dividends page, i noticed the page is flickering by trying to refresh quite often. even in home page "📦 Portfolio from database • Live data fetched from ShareBazaar API • Last updated: 8:48:35 AM" this is refreshing quite often. and think mentioned fetchinf from ShareBazaar API is not good
```

#### What Went Wrong
- `DividendsPage`: `isFetchingAuto` completely unmounted the data table on every background re-fetch, replacing the layout with a 40px spinner and causing aggressive layout shifts.
- `Index`: Full-width colored `Alert` banner flipped between blue loading box and green updated box, bouncing page content. The banner also carried raw emoji `📦` and mislabeled the source as "ShareBazaar API" when live prices actually stream from HamroShare / local NEPSE server.
- `MarketContext`: Replaced the entire market summary card with a skeleton on every 30-second background poll.
- `useLivePortfolio`: Reset `isLoading(true)` on every background refresh, flashing the whole dashboard into loading state.

#### Key Adjustments Made
1. **Silent In-Place Background Updates**: Gated `isFetchingAuto` and `isLoading` so they only show full-screen/block loaders when data is not yet loaded (`!portfolioData` / `!hasLoadedRef.current`). Existing data stays mounted while background refreshes run.
2. **Skeleton Flicker Prevention**: In `MarketContext`, only return `<MarketContextSkeleton />` if `isLoading && !marketData`.
3. **Retired ShareBazaar Banner**: Replaced jarring jumping Alert box with a stable, single-line metadata bar crediting `NEPSE Server (HamroShare)` without decorative emojis.

---

## 🏆 Key Takeaways & Learned Patterns
1. **Never Unmount Active Data for Background Refreshes**: Always gate loading skeletons/spinners with `isLoading && !data`. When data exists, re-fetch silently in place.
2. **Accurate Architecture Attribution**: Never hardcode obsolete third-party APIs (like ShareBazaar) in user-facing status bars when primary scraping pipelines have transitioned to authoritative local backends (HamroShare).
