# sol.watch

Real-time Solana mainnet dashboard — block exploration, validator analytics, epoch trends, failure tracking, and transaction visualization.

**Live**: [solwatch.vercel.app](https://solwatch.vercel.app/)

Built with React + TypeScript + Tailwind. Powered by Helius and Alchemy RPCs via a secure backend proxy.

## Pages

### Dashboard (`/`)
- Network overview (slot, block height, TPS, slot time) with smooth animated counters
- Epoch progress with live countdown (days, hours, minutes, seconds)
- Epoch summary cards (Transactions, Fees, Jito Tips, CU/Performance) with mini bar charts
- Validators & network stats
- Supply & economics
- Leader rotation with consecutive block counter, live ETAs, and smooth transitions
- Epoch leader schedule table (upcoming leaders with health score, location, ETA, epoch share)
- Network limits & CU costs

### Explorer (`/explorer`)
- Real-time analytics with hero metrics, priority adoption, stacked distributions
- Block deep dive with interactive fee-by-position chart (click-to-select, Ctrl+click multi-select, auto-pause, block visualizer highlighting)
- Epoch detailed analytics (fee breakdown, CU efficiency trends)

### Failures (`/failures`)
- Hero stats strip (failure rate, wasted CU, wasted fees, total failed)
- Failure rate by epoch trend chart
- Failing programs vs current epoch network-wide rate
- 3-column insights (CU waste, block position, error types)
- Cost of failures with progress bars
- Session failure trend (live SVG area chart)
- Top failing wallets (collapsible)

### Validators (`/validators`)
- Validator table with search, logos, stake %, commission, skip rate, health scores
- Epoch slot distribution (per-validator slot allocation, top-10/top-1/3 share, expandable)
- Geographic distribution by country/city

## Architecture

### Frontend
React 19 | TypeScript | Tailwind CSS 4 | Vite 7 | Bun | react-router-dom v7 | @solana/web3.js | IndexedDB

Deployed on **Vercel** with auto-deploy from `main`.

### Backend Proxy
Express server handling all external API calls — no API keys shipped to browsers.

- **CORS** whitelist (production domain + localhost)
- **Helmet** security headers
- **Per-IP rate limiting** (600/min RPC, 30/min enhanced TX, 120/min GET)
- **Abuse detection** (auto-block after repeated violations)
- **RPC method whitelist** (15 allowed Solana methods)
- **Request logging** (method, path, response time, client IP)
- **Server-side caching** (validators 5min, epochs 1h, prices 30s)
- **Helius → Alchemy failover** handled server-side

Deployed on **Render** via Docker.

## Data Sources

| Source | Usage |
|--------|-------|
| Helius | Primary RPC, Enhanced TX API, Priority Fee API |
| Alchemy | Fallback RPC |
| Stakewiz | Validator metadata (logos, names, locations) |
| Solana Compass | Epoch performance data |
| CoinGecko | SOL price + 24h change |

## Development

```bash
# Frontend
bun install
bun run dev          # localhost:5173

# Backend (server/)
cd server
cp .env.example .env # fill in API keys
bun install
bun run dev          # localhost:3001
```
