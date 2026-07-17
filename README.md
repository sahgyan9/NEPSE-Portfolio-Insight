# Portfolio Insight

Portfolio Insight is a visually engaging portfolio tracker built for investors on the
Nepal Stock Exchange (NEPSE). Import your holdings once from Meroshare and every chart,
valuation score, and insight fills in automatically — no manual data entry.

## Features

- **One-step import** — drop your Meroshare CSV and your whole portfolio loads instantly.
- **Live tracking** — up-to-date NEPSE prices, gains/losses, and portfolio value over time.
- **Analytics & valuation** — P/E, P/B, dividends, sector allocation, and health scoring
  inspired by Benjamin Graham's *The Intelligent Investor*.
- **Modern interface** — a sleek dashboard built with React, Tailwind CSS, and shadcn-ui.

## Getting your portfolio from Meroshare

1. Log in to **Meroshare**.
2. Open **My Purchase Source** (Portfolio).
3. Click **CSV** to download — on mobile, tap the **⋮** menu, then **CSV**.
4. Drag that file into the app's import box (shown automatically on first run).

## Running the app (Windows)

The app runs three local services: a portfolio database (port 5001), a NEPSE data
server (port 8000), and the web UI (port 5173). One launcher starts all of them.

### First-time setup

Run these once:

```sh
# 1. Frontend dependencies
npm install

# 2. Python backend dependencies (creates a virtual environment)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

### Every day after that

Just **double-click `PortfolioInsight.vbs`** (or `start.bat`). It starts all three
services and opens the app in your browser automatically.

You can also start it from a terminal:

```sh
npm start
```

To stop the background services:

```sh
npm run stop
```

The application opens at `http://localhost:5173`.

## Technologies

- Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- Python (Flask + stdlib HTTP servers) for the local database and NEPSE data services
