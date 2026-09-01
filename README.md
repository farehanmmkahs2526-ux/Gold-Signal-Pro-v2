# Gold Signal Pro

Production-oriented XAU/USD analysis and strong-signal dashboard for Netlify.

## Important: this is not a static-only Netlify Drop

Gold Signal Pro uses Netlify Functions, Scheduled Functions, Netlify Database (managed Postgres), Netlify Blobs and Web Push. Deploy the **project repository** with Netlify Git integration or the Netlify CLI. Dragging only the `dist/` folder into Netlify Drop will publish the frontend but will not provision the required backend/database/schedules.

## What is included

- React + TypeScript + Vite + Tailwind CSS dashboard
- Real XAU/USD provider adapter (initial adapter: Twelve Data)
- M1, M5, M15, M30, H1, H4, Daily completed-candle analysis
- Deterministic rule engine: market structure, EMA/SMA, RSI, MACD, ADX, Supertrend, Ichimoku, Stochastic, CCI, ROC, ATR, Bollinger, Fibonacci, support/resistance, candle patterns, chart-pattern heuristics, VWAP/OBV when volume exists, session context
- Weighted Scalping / Intraday / Swing modes
- Only `STRONG BUY`, `STRONG SELL`, `HOLD / NO TRADE`
- Entry, SL, TP1, TP2, TP3 calculated only for confirmed strong signals
- Forex Factory current-week XML feed through a Netlify Function, with `America/New_York` -> `Asia/Kuala_Lumpur` timezone-aware conversion
- 30-minute default high-impact USD news blackout
- Netlify Database migrations for signals, push subscriptions, preferences, notification history and cached news metadata
- Netlify Blobs caching for the weekly calendar
- Web Push with VAPID, service worker and notification click routing
- Full-screen strong-signal alert, deduplicated by signal ID
- PWA manifest, 192/512 and maskable icons, offline application shell
- Dynamic production URL QR code
- Responsive mobile layout from 320 px upward
- Vitest tests

## Strict real-data behavior

The application deliberately does **not** create demo prices, demo candles, demo economic news, placeholder signal history, fake win rates or random signals.

If the market API is missing, the dashboard displays:

> Live XAU/USD data is not configured. Add the required API credentials in Netlify Environment Variables.

If Forex Factory fails, the application uses the last successful cached calendar when available, marks it stale, and never substitutes sample events.

## 1. Local installation

Requirements: Node.js 20+ (Node 22 recommended), npm and Netlify CLI.

```bash
npm install
npm install -g netlify-cli
cp .env.example .env
```

Fill the required values in `.env`, then:

```bash
netlify dev
```

Do not use `vite` alone for full testing because the `/api/*` routes need Netlify Functions and the local Netlify Database runtime.

## 2. Market data

The included production adapter supports Twelve Data.

Create an authorised account/plan capable of providing the XAU/USD intraday intervals you need, then set:

```env
MARKET_DATA_PROVIDER=twelvedata
MARKET_DATA_API_KEY=YOUR_PRIVATE_KEY
MARKET_DATA_BASE_URL=https://api.twelvedata.com
XAUUSD_SYMBOL=XAU/USD
```

The API key is used only in Netlify Functions and is never returned to browser code.

Provider limitations matter. Your plan must support the requested XAU/USD symbol, sufficient request rate and M1/H4 history. If a value such as bid, ask, spread or volume is not supplied by the provider, Gold Signal Pro shows `Unavailable` rather than estimating it.

## 3. Forex Factory

Default:

```env
FOREX_FACTORY_FEED_URL=https://nfs.faireconomy.media/ff_calendar_thisweek.xml
FOREX_FACTORY_SOURCE_TIMEZONE=America/New_York
APP_TIMEZONE=Asia/Kuala_Lumpur
```

The feed is fetched server-side, cached and refreshed every 15 minutes. Normal event times use timezone-aware conversion, including US DST. `All Day` and `Tentative` are preserved without invented times.

## 4. Web Push / VAPID

Generate VAPID keys locally:

```bash
npx web-push generate-vapid-keys
```

Then configure:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Notification permission is requested only after the user presses **Enable Notifications**.

## 5. Netlify environment variables

In Netlify: **Project configuration -> Environment variables**, add all required values from `.env.example`.

At minimum:

- `MARKET_DATA_PROVIDER`
- `MARKET_DATA_API_KEY`
- `MARKET_DATA_BASE_URL`
- `XAUUSD_SYMBOL`
- `APP_TIMEZONE`
- `FOREX_FACTORY_FEED_URL`
- `FOREX_FACTORY_SOURCE_TIMEZONE`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `DEFAULT_SIGNAL_MODE`
- `SIGNAL_SCAN_INTERVAL_MINUTES`
- `NEWS_REFRESH_INTERVAL_MINUTES`

Never prefix private keys with `VITE_`; Vite variables can be exposed to browser bundles.

## 6. Netlify Database

This repository includes `@netlify/database` and the migration:

`netlify/database/migrations/001_init.sql`

On a supported Netlify plan, deploy the repository and Netlify can provision the database/apply migrations. You can also create it from the site's **Database** page. Netlify Database is a managed Postgres product and availability/billing depends on your Netlify plan.

For local database development:

```bash
netlify dev
netlify database status
```

## 7. Deploy using Git (recommended)

1. Put this folder in a GitHub/GitLab repository.
2. In Netlify select **Add new project -> Import an existing project**.
3. Select the repository.
4. Netlify reads `netlify.toml` automatically.
5. Add environment variables.
6. Ensure Netlify Database is provisioned.
7. Deploy the production branch.
8. Open `/api/health` after deployment and confirm `marketDataConfigured` and `pushConfigured` are true.

Build settings are already defined:

```toml
command = "npm run build"
publish = "dist"
functions = "netlify/functions"
```

## 8. Deploy using Netlify CLI

From this project directory:

```bash
npm install
netlify login
netlify init
netlify dev
npm test
npm run build
netlify deploy --build
netlify deploy --build --prod
```

The production deploy is required for Scheduled Functions to execute automatically.

## 9. Scheduled functions

Configured in UTC cron:

- `scheduled-signal-scan`: every minute
- `refresh-news`: every 15 minutes

The signal scan fetches completed candles, calculates all timeframe analyses, applies the news-risk gate, saves only confirmed strong signals, checks duplicate/cooldown conditions and sends push notifications.

## 10. PWA/mobile

The QR code uses `window.location.origin`, so after production deployment it points to the real production URL rather than localhost or a hardcoded preview URL.

For iOS background Web Push, use a supported modern iOS version/browser and install the site to the Home Screen before enabling notifications where required by the platform.

## 11. Tests

```bash
npm test
```

Tests cover major indicators, Fibonacci/structure logic, strong-signal gates, high-impact-news HOLD behavior, stale-data HOLD behavior, timezone/DST conversion and PWA/service-worker assets.

## 12. Security notes

- Private API keys and VAPID private key remain server-side.
- CSP and security headers are defined in `netlify.toml`.
- CORS and input validation are enforced in functions.
- Function requests have lightweight rate limiting and timeouts/retries.
- No broker credentials are accepted or stored.
- No order-execution endpoint exists.
- This project provides analysis/signals only.

## Disclaimer

Gold Signal Pro provides technical and market information for educational and decision-support purposes only. It does not provide guaranteed financial advice or guaranteed trading results. XAU/USD trading carries substantial risk. Verify every signal and use appropriate risk management before trading.
