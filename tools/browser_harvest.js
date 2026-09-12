/* =====================================================================
 * NepseAlpha Browser Harvester  —  paste into DevTools on nepsealpha.com
 * =====================================================================
 * Why this exists
 * ---------------
 * Cloudflare TLS-fingerprints the Python scrapers and sometimes answers 403,
 * while a real Chrome tab on nepsealpha.com is never challenged. This script
 * runs INSIDE such a tab, makes the exact same request the Python collectors
 * make, and builds byte-for-byte the same objects they build:
 *
 *   snapshot     -> one row for db/fundamentals_archive/<SYM>.json
 *                   (mirrors tools/archive_fundamentals.py build_snapshot)
 *   fundamentals -> the db/fundamentals.json entry
 *                   (mirrors tools/scrape_fundamentals_direct.py extract_fundamentals)
 *
 * How to use
 * ----------
 *   1. Open https://nepsealpha.com/ in Chrome, open DevTools -> Console.
 *   2. Paste this whole file and press Enter.
 *   3. Run one of:
 *        await NA.one('NLO')             // harvest a single symbol, logs JSON
 *        await NA.universe()             // list every symbol NepseAlpha knows
 *        await NA.all()                  // harvest EVERY listed company
 *        await NA.all({limit: 10})       // quick test on the first 10
 *        await NA.all({resume: true})    // continue an interrupted pass
 *      Progress is logged as it goes; partial results survive in NA.results and
 *      are checkpointed to localStorage every 10 symbols, so a closed tab costs
 *      at most ten records rather than the whole run.
 *   4. NA.save()  downloads harvest.json to your Downloads folder.
 *   5. Move that file into the project's .tmp/ and merge it:
 *        python tools/ingest_harvest.py .tmp/harvest.json --dry-run
 *        python tools/ingest_harvest.py .tmp/harvest.json
 *
 * Keep the tab visible while it runs. Chrome freezes long-backgrounded tabs:
 * timers stop firing and in-flight fetches hang forever, so a harvest left in a
 * buried tab silently stalls rather than failing loudly.
 *
 * Nothing here needs an API key, and no request leaves nepsealpha.com.
 * ===================================================================== */

window.NA = (function () {
  const SEARCH = 'https://nepsealpha.com/search';
  const DELAY_MS = 700;          // be polite; NepseAlpha is someone else's server
  const SKIP_SECTORS = new Set(['mutual fund', 'mutual funds']);
  const CKPT_KEY = 'na_harvest_ckpt';
  const CKPT_EVERY = 10;         // symbols between localStorage checkpoints

  const num = v => {
    if (v === null || v === undefined) return null;
    const f = parseFloat(v);
    return isNaN(f) ? null : f;
  };
  const rnd = (v, n) => {
    const d = n === undefined ? 2 : n;
    if (typeof v !== 'number' || !isFinite(v)) return null;
    const m = Math.pow(10, d);
    return Math.round(v * m) / m;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // A price is only meaningful if somebody actually traded at it recently. NEPSE
  // has many thinly-traded names whose "last price" is months old and often set
  // by a single-share trade — their PE/PB are arithmetically correct and
  // economically meaningless, and they sweep any cheapness screen. Flag them
  // instead of trusting them. 5 calendar days ≈ one full NEPSE trading week
  // (Sun–Thu), which also absorbs running the harvester on a Friday or Saturday.
  const STALE_PRICE_DAYS = 5;

  /* ---- mirrors archive_fundamentals.liquidity_fields ---- */
  function liquidity(p, capturedAt) {
    const price = p.latestPrice || {};
    const created = price.created_at;          // "2026-04-07T09:14:59.000000Z"
    const lastTrade = (typeof created === 'string' && created.length >= 10)
      ? created.slice(0, 10) : null;

    let days = null;
    if (lastTrade) {
      const d0 = Date.parse(lastTrade + 'T00:00:00Z');
      const d1 = Date.parse(capturedAt + 'T00:00:00Z');
      if (!isNaN(d0) && !isNaN(d1)) days = Math.round((d1 - d0) / 86400000);
    }

    let vol = num(price.actual_volume);
    if (vol === null) vol = num(price.volume);

    return {
      last_trade_date: lastTrade,
      trade_volume: vol === null ? null : Math.trunc(vol),
      trade_turnover: rnd(num(price.turn_over)),
      days_since_trade: days,
      // null (unknown trade date) counts as stale: absence of evidence that the
      // price is fresh is not evidence that it is.
      price_is_stale: days === null ? true : days > STALE_PRICE_DAYS
    };
  }

  /* ---- fetch the Inertia props JSON embedded in the server-rendered page ---- */
  async function props(sym) {
    const u = new URL(SEARCH);
    u.searchParams.set('isBrk', '1');
    u.searchParams.set('mobile_app', '1');
    u.searchParams.set('q', sym);
    u.searchParams.set('theme', 'light');
    const r = await fetch(u.toString(), { credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    const marker = '&quot;props&quot;';
    const idx = t.indexOf(marker);
    if (idx === -1) throw new Error('no embedded props JSON (page layout changed?)');
    const s = t.lastIndexOf('="', idx) + 2;
    const e = t.indexOf('"', s);
    const ta = document.createElement('textarea');
    ta.innerHTML = t.slice(s, e);           // HTML-unescape
    return (JSON.parse(ta.value) || {}).props || {};
  }

  /* ---- mirrors archive_fundamentals.build_snapshot ---- */
  function snapshot(p, capturedAt) {
    const master = p.masterData || {}, funda = p.funda_table || {};
    const gen = p.stocksGenralInfo || {}, stock = p.stock_info || {};
    const epsInfo = p.financialsEPS || {};
    const fy = epsInfo.fiscal_year, q = epsInfo.quarter;
    if (!fy || !q) return null;

    // "082-083" + quarter 3 -> "2082-83-Q3"
    const fp = String(fy).split('-');
    const rq = fp.length === 2
      ? '20' + fp[0].slice(1) + '-' + fp[1].slice(1) + '-Q' + q
      : fy + '-Q' + q;

    const shares = num(master.shares_outstnading) || 0;
    const vals = {};
    (p.quartesGrowths || []).forEach(r => {
      if (r.fiscal_year === fy && r.quarter === q) vals[r.particulars] = r.value;
    });
    const pct = k => { const v = num(vals[k]); return v === null ? null : rnd(v * 100); };
    const roeF = num(funda.roe), roaF = num(funda.roa);
    const promoter = num(gen.promoter_holding), pub = num(gen.public_holding);

    const capturedOn = capturedAt || today();
    const rank = {};
    ['pe_vs_sector', 'pb_vs_sector', 'roe_vs_sector', 'roa_vs_sector',
     'dividend_yield_vs_sector', 'peg_vs_sector', 'yoy_vs_sector'].forEach(k => {
      if (funda[k] !== null && funda[k] !== undefined) rank[k] = funda[k];
    });

    return Object.assign({
      captured_at: capturedOn,
      reported_quarter: rq, fiscal_year: fy, quarter: parseInt(q, 10),
      sector: stock.sector || funda.sector_name || null,

      ltp_at_capture: rnd(num(funda.ltp)),
      pe_ratio: rnd(num(funda.pe_ratio)),
      pb_ratio: rnd(num(funda.pb_ratio)),
      graham_number: rnd(num(funda.graham_number)),
      discount_from_graham: rnd(num(funda.discount_from_graham_num), 4),

      eps_reported: rnd(num(epsInfo.value)),
      eps_ttm: rnd(num(vals.eps_ttm)),
      book_value: rnd(num(master.book_value)),

      roe: roeF === null ? pct('roe_ttm') : rnd(roeF * 100),
      roa: roaF === null ? pct('roa_ttm') : rnd(roaF * 100),
      net_margin_ttm: pct('net_margin_ttm'),
      asset_turnover_ttm: pct('asset_turnover_ttm'),

      net_profit_ttm: num(vals.net_profit_ttm),
      revenue_ttm: num(vals.revenue_ttm),
      shares_outstanding: shares ? Math.trunc(shares) : null,

      dividend_payout_ratio: rnd(num(funda.total_dividend_payout_ratio), 4),
      dividend_to_ltp: rnd(num(funda.total_dividend_to_ltp), 4),

      promoter_holding: promoter === null ? null : rnd(promoter * 100),
      public_float: pub === null ? null : rnd(pub * 100),
      week52_high: rnd(num(master._52_weeks_hi)),
      week52_low: rnd(num(master._52_weeks_lo)),

      sector_rankings: rank
    }, liquidity(p, capturedOn));   // how tradeable that ltp/pe/pb really is
  }

  /* ---- mirrors scrape_fundamentals_direct.extract_fundamentals ---- */
  function fundamentals(p, capturedAt) {
    const master = p.masterData || {}, funda = p.funda_table || {}, gen = p.stocksGenralInfo || {};
    const promoter = num(gen.promoter_holding), pub = num(gen.public_holding);
    const so = num(master.shares_outstnading);
    const o = {
      eps: rnd(num(master.eps)),
      bookValue: rnd(num(master.book_value)),
      peRatio: rnd(num(funda.pe_ratio)),
      pbRatio: rnd(num(funda.pb_ratio)),
      sharesOutstanding: so === null ? null : Math.trunc(so),
      // NepseAlpha stores holdings as fractions (0.673 = 67.3%); the db uses 0-100
      promoterHolding: promoter === null ? null : rnd(promoter * 100),
      publicFloat: pub === null ? null : rnd(pub * 100),
      high52: rnd(num(master._52_weeks_hi)),
      low52: rnd(num(master._52_weeks_lo))
    };
    Object.keys(o).forEach(k => { if (o[k] === null) delete o[k]; });

    // How tradeable that peRatio/pbRatio really is. Mirrors
    // scrape_fundamentals_direct.liquidity_fields: store the raw facts plus the
    // capture date and let the UI age them, rather than freezing a "stale"
    // boolean that itself goes stale the day after it is written.
    const price = p.latestPrice || {};
    const created = price.created_at;          // "2026-04-07T09:14:59.000000Z"
    const lastTrade = (typeof created === 'string' && created.length >= 10)
      ? created.slice(0, 10) : null;
    let vol = num(price.actual_volume);
    if (vol === null) vol = num(price.volume);
    const turnover = rnd(num(price.turn_over));

    if (lastTrade !== null) o.lastTradeDate = lastTrade;
    if (vol !== null) o.tradeVolume = Math.trunc(vol);
    if (turnover !== null) o.tradeTurnover = turnover;
    o.capturedAt = capturedAt || today();

    return o;
  }

  function record(p, fullName, capturedAt) {
    const stock = p.stock_info || {};
    return {
      symbol: (p.symbol || '').toUpperCase(),
      full_name: fullName || stock.company_name || stock.full_name || '',
      snapshot: snapshot(p, capturedAt),
      fundamentals: fundamentals(p, capturedAt)
    };
  }

  /* ---- public API ---- */
  const NA = {
    results: [],
    failures: [],

    async one(sym, fullName, capturedAt) {
      const rec = record(await props(sym), fullName, capturedAt);
      console.log(JSON.stringify(rec, null, 2));
      return rec;
    },

    // Every listed symbol — NepseAlpha embeds the full list on any stock page.
    // Gotcha: it OMITS the symbol you are currently viewing, so a single anchor
    // silently loses exactly one company. Union two anchors to cover the gap.
    async universe() {
      const seen = new Map();
      for (const anchor of ['NABIL', 'ADBL']) {
        const p = await props(anchor);
        (p.all_stock_name || []).forEach(it => {
          const sym = (it.symbol || '').toUpperCase();
          if (sym && !seen.has(sym)) {
            seen.set(sym, { symbol: sym, full_name: (it.stockinfo || {}).full_name || '' });
          }
        });
      }
      return [...seen.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
    },

    // Crash resilience: a full pass takes minutes, and a closed tab used to cost
    // the whole run. Results are mirrored to localStorage every CKPT_EVERY
    // symbols, so NA.all({resume: true}) picks up where the last pass died.
    ckptLoad() { try { return JSON.parse(localStorage.getItem(CKPT_KEY)) || null; } catch (e) { return null; } },
    ckptClear() { localStorage.removeItem(CKPT_KEY); },

    async all(opts) {
      opts = opts || {};
      const capturedAt = opts.capturedAt || today();
      let list = opts.symbols
        ? opts.symbols.map(s => ({ symbol: s.toUpperCase(), full_name: '' }))
        : await NA.universe();
      if (opts.limit) list = list.slice(0, opts.limit);

      NA.results = []; NA.failures = [];
      if (opts.resume) {
        const ck = NA.ckptLoad();
        if (ck && ck.results) {
          NA.results = ck.results;
          const done = new Set(NA.results.map(r => r.symbol));
          list = list.filter(r => !done.has(r.symbol));
          console.log(`Resuming: ${NA.results.length} already harvested, ${list.length} to go.`);
        }
      }

      let funds = 0;
      for (let i = 0; i < list.length; i++) {
        const { symbol, full_name } = list[i];
        try {
          const p = await props(symbol);
          const sector = ((p.stock_info || {}).sector || '').toLowerCase();
          const funda = p.funda_table || {};
          const hasFundamentals = ['pe_ratio', 'pb_ratio', 'roe']
            .some(k => typeof funda[k] === 'number');
          if (SKIP_SECTORS.has(sector) || !hasFundamentals) { funds++; continue; }

          const rec = record(p, full_name, capturedAt);
          if (!rec.snapshot) { funds++; continue; }
          NA.results.push(rec);
          console.log(`[${i + 1}/${list.length}] ${symbol}: ${rec.snapshot.reported_quarter} ` +
                      `EPS ${rec.snapshot.eps_ttm} PE ${rec.snapshot.pe_ratio} ROE ${rec.snapshot.roe}`);
        } catch (e) {
          NA.failures.push(symbol);
          console.warn(`[${i + 1}/${list.length}] ${symbol}: FAILED — ${e.message}`);
        }
        if ((i + 1) % CKPT_EVERY === 0) {
          try { localStorage.setItem(CKPT_KEY, JSON.stringify({ capturedAt, results: NA.results })); }
          catch (e) { console.warn('checkpoint failed: ' + e.message); }
        }
        if (i < list.length - 1) await sleep(DELAY_MS);
      }
      try { localStorage.setItem(CKPT_KEY, JSON.stringify({ capturedAt, results: NA.results })); } catch (e) { /* quota */ }
      console.log(`\nDone. ${NA.results.length} harvested, ${funds} funds/bonds skipped, ` +
                  `${NA.failures.length} failed${NA.failures.length ? ': ' + NA.failures.join(', ') : ''}.`);
      console.log('Run NA.save() to download harvest.json.');
      return NA.results;
    },

    // Download whatever is in NA.results as harvest.json
    save(filename) {
      const blob = new Blob([JSON.stringify(NA.results, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'harvest.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      console.log(`Saved ${NA.results.length} records to ${a.download}`);
    },

    // low-level escape hatches
    props, snapshot, fundamentals, record, liquidity
  };
  return NA;
})();

console.log('NepseAlpha harvester ready. Try: await NA.one("NLO")');
