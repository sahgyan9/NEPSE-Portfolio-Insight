# Hosting plan

Written 2026-11-15. Status: plan only, nothing built. The app runs on one laptop today and that is the
intended setup for now. This file records how to move beyond that when the time comes, so the decision
does not have to be worked out again.

## Where the app stands today

| Part | What it is | Where it runs |
|---|---|---|
| Screen | React app (Vite), Nepali and English, phone layout ready | Browser, served from the laptop on port 5175 |
| Portfolio server | `portfolio_db.py`, reads and writes JSON files in `db/` | Laptop, port 5001, reachable only from the laptop itself |
| Market server | `nepse_server.py`, live prices, news, dividends, quarterly reports | Laptop, port 8002 |
| Data | JSON files in `db/`, including the personal holdings in `db/portfolio.json` | Laptop disk |
| AI chat | Calls Google Gemini straight from the browser with the user's own key | Browser |

Three facts shape every option below:

1. **One user is assumed everywhere.** There is one `db/portfolio.json`, no login, and no idea of "whose
   portfolio is this".
2. **Market data comes from scraping.** Prices use an unofficial NEPSE library; news comes from ShareSansar
   pages; quarterly reports come from NepseAlpha, where the scraper imitates a browser to get past its
   bot check. This is tolerable for one person's private use. Running it as a public service is a
   different matter (see "Before going public").
3. **The screen talks to `localhost`.** A phone cannot reach the laptop's `localhost`, so the phone
   layout is ready but a phone has nothing to connect to yet.

## Stage 0: laptop only (now)

Nothing to do. Start the app from the desktop shortcut. Keep it this way until the Nepali wording has
been reviewed and the app has been used daily for a few weeks.

## Stage 1: your own phone, at home

Goal: open the app on your phone while the laptop is on and both are on the same Wi-Fi. No cloud, no cost,
no accounts.

Work needed (about half a day):

- Serve the built app and both servers from one address on the laptop, so the phone needs only
  `http://<laptop-address>:<port>`. Simplest route: let `nepse_server.py` (Flask) serve the built `dist/`
  folder and forward portfolio requests to `portfolio_db.py`.
- Replace the hard-coded `http://localhost:5001` and `http://localhost:8002` addresses in `src/` with
  paths relative to the page (about 15 places; `grep -rn "localhost:" src`).
- Allow the portfolio server to accept connections from the home network, and add a simple password,
  because anyone on the same Wi-Fi could otherwise read and change the portfolio.
- Add a small "open on phone" screen that shows the address as a QR code.

Limits: works only while the laptop is awake and only on the home network.

## Stage 2: your own phone, anywhere

Goal: same as stage 1, but from mobile data or another network. Still one user, still no public service.

Recommended route: a private network tool such as Tailscale on the laptop and the phone. The phone then
reaches the laptop by a private address from anywhere, and nothing is exposed to the public internet.
No code change beyond stage 1. The laptop still has to be on.

If the laptop cannot stay on: move the two Python servers and the `db/` folder to one small rented
server (a "VPS") and keep it private behind the same tool. Then the scheduled jobs (daily news, the
quarterly forward test) run there instead of on the laptop. Check current prices when the time comes;
the smallest size from any mainstream provider is enough.

## Stage 3: a public app for other people

Goal: any Nepali investor can sign up and use it. This is a new product built on the current one, not a
switch to flip. Expect several weeks of work.

What has to be built:

| Need | Why | Likely approach |
|---|---|---|
| Accounts and login | Each person's portfolio must be private | Phone number or email login from a hosted auth service |
| A real database | JSON files cannot serve many users safely | Postgres; one row set per user for holdings, transactions, watchlist |
| Per-user portfolio API | `portfolio_db.py` assumes one portfolio | Rewrite its endpoints to take the logged-in user |
| Shared market data | Prices, news, dividends and reports are the same for everyone | Fetch once on a schedule, store centrally, serve to all users. Never scrape per user |
| Portfolio import | Users will not edit JSON | Keep the Meroshare file import; it already exists |
| AI chat | A key in the browser does not work for the public | Either each user brings a key (as now), or a server-side key with a daily limit per user, which costs money per message |
| Hosting | Somewhere to run it | Static screen on a CDN host; API and scheduled jobs on one small server; managed Postgres |
| Backups and monitoring | People will trust it with their records | Daily database backup, error alerts |

The risk analysis, health score and research tools read local files today. Each needs to be changed to
read one user's data from the database. The pre-registered research study (`docs/research/`,
`tools/score_sector_leaders.py`) stays as it is and stays on the laptop.

### Before going public: three things to settle first

These are not engineering tasks and each can stop the launch, so they come before any stage 3 code.

1. **Permission to use the data.** Scraping ShareSansar and NepseAlpha for a public service, and getting
   past NepseAlpha's bot check, is very likely against their terms. Options: ask them for permission or
   a paid data feed, use NEPSE's or CDSC's official data if they offer one, or limit the public version
   to data that is licensed. Decide this first; it determines what the public app can show.
2. **Regulation.** The app is written as education, not advice, and should stay that way. Even so, check
   with SEBON whether a public tool that scores companies and comments on a user's portfolio needs any
   registration, before promoting it.
3. **Privacy.** A public version holds people's holdings. It needs a privacy notice in Nepali, a way to
   delete an account and its data, and a decision on where the data is stored.

### What it would cost to run

Not priced yet. The parts that cost money are: one small server, a managed database, a domain name, and
AI messages if a shared key is used. For a few hundred users the first three are small monthly amounts;
the AI chat is the only part whose cost grows with every message. Get current prices at the time.

## Recommended order

1. Stage 0 now. Review the Nepali wording and use the app.
2. Stage 1 when you want it on your phone at home.
3. Stage 2 with a private network tool if you want it away from home.
4. Settle the three "before going public" questions.
5. Only then start stage 3, beginning with accounts and the database.

## Notes for whoever implements this

- Run tests with `.venv/Scripts/python.exe -m pytest tools -q`; the type check is
  `npx tsc --noEmit -p tsconfig.app.json`.
- `db/portfolio.json` and other personal files are git-ignored and must never be committed or uploaded.
- The forward-test scheduled task needs a clean git tree on the research branch; any hosting work
  should happen on its own branch.
- The web manifest (`public/manifest.webmanifest`) already lets the app be added to a phone's home
  screen once it is served from an address the phone can reach. A service worker for offline use has
  not been added.
