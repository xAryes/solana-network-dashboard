# sol.watch

Real-time Solana mainnet dashboard — block exploration, validator analytics, epoch trends, failure tracking, and transaction visualization. Built with React + TypeScript + Tailwind, powered by Helius and Alchemy RPCs.

**Live**: [solwatch.vercel.app](https://solwatch.vercel.app/)

## Pages

The dashboard is organized into 4 pages via HashRouter:

### Dashboard (`/`)
- **Network Overview**: Live slot, block height, TPS, average slot time, transaction count
- **Epoch Progress**: Visual progress bar with slot counts, time remaining, estimated completion
- **Epoch Summary Cards**: 4 cards (Transactions, Fees, Jito Tips, CU/Performance) with mini bar charts across recent epochs
- **Validators & Network**: Active/delinquent counts, total stake, skip rate, blocks produced
- **Supply & Economics**: Total/circulating supply, inflation rate, validator APY
- **Leader Rotation**: Current leader with avatar, name, location, 4-slot progress bar. Upcoming leaders as compact chips. Consecutive block counter (xN bubble)
- **Network Limits**: CU costs for 40+ operations, protocol limits, SIMD upgrade notes

### Explorer (`/explorer`)
- **Epoch Detailed Analytics**: Fee breakdown (base vs priority vs Jito), CU efficiency trends
- **Real-time Analytics**: Priority fee percentiles, CU distribution across categories, program activity
- **Block Deep Dive**: Live block pipeline with pause/resume. 4-panel block info (leader, transactions, fees, compute units). Vertical fee-by-position chart. Transaction visualization as log-scale bar chart, color-coded by program category. Click-to-select auto-pauses the stream. Helius Enhanced TX data for type/source enrichment

### Failures (`/failures`)
- **Failure Overview**: Aggregate failure rate, wasted CU, wasted fees across session
- **Cost of Failures**: SOL wasted on failed transactions
- **All Failing Programs**: Per-program failure tracking with call counts, session rate bars, delta indicators
- **Top Failing Wallets**: Most frequent failure sources

### Validators (`/validators`)
- **Validator Table**: Paginated list with search, logos (Stakewiz), stake %, commission, skip rate, delinquency status
- **Geographic Distribution**: Node count by country/city from Stakewiz geolocation data

## Architecture

### Project Structure

```
src/
  App.tsx              (~4300 lines) All UI components + 4 page wrappers
  hooks/
    useSolanaData.ts   (~1900 lines) All data fetching hooks + IndexedDB
  index.css            CSS variables, animations, utility classes
  main.tsx             Entry point with Error Boundary + HashRouter
```

Single-file architecture: all components live in `App.tsx` for simplicity and fast iteration. Data fetching is separated into custom hooks in `useSolanaData.ts`.

### Data Flow

```
                    ┌─────────────────┐
                    │     App.tsx     │
                    │  (all hooks at  │
                    │   top level)    │
                    └───────┬─────────┘
                            │ props
              ┌─────────────┼─────────────┐
              │             │             │
         DashboardPage  ExplorerPage  FailuresPage  ValidatorsPage
              │             │             │              │
         EpochSummary   BlockDeepDive  FailedTxs    TopValidators
         LeaderPanel    Analytics      Programs     Geography
```

All data hooks execute in `App()` and pass data as props to page components. This ensures:
- Hooks always call in the same order (React rules)
- Data persists across page navigation
- Failure accumulation refs survive route changes

### RPC Strategy

```
Request ──> Helius (primary)
              │
              ├── Success ──> Return data
              │
              └── Failure ──> Alchemy (fallback) ──> Return data
```

- **Helius** is primary (premium plan) — provides RPC + Enhanced TX API + Priority Fee API
- **Alchemy** is automatic per-call fallback when Helius fails
- `getConnection()` returns Helius, `getFallbackConnection()` returns Alchemy
- Each RPC call individually falls back (not a global switch)

### External APIs

| Provider | Endpoint | Data |
|----------|----------|------|
| **Helius RPC** | JSON-RPC over `api.helius.xyz` | All standard Solana RPC methods |
| **Helius Enhanced TX** | `POST api.helius.xyz/v0/transactions` | TX type/source enrichment (max 100 sigs) |
| **Helius Priority Fees** | JSON-RPC `getPriorityFeeEstimate` | Fee percentiles with all priority levels |
| **Alchemy RPC** | JSON-RPC over `solana-mainnet.g.alchemy.com` | Fallback for all standard RPC methods |
| **Stakewiz** | `GET api.stakewiz.com/validators` | Validator logos (`image`), names, `ip_city`/`ip_country` |
| **Solana Compass** | `GET solanacompass.com/api/epoch-performance/{epoch}` | Historical epoch stats (fees, CU, success rate) |

### RPC Methods

| Method | Usage |
|--------|-------|
| `getSlot` | Current slot |
| `getEpochInfo` | Epoch progress, slots remaining |
| `getRecentPerformanceSamples` | TPS calculation |
| `getBlock` | Block transactions, programs, fees, CU (json encoding, ~5MB/block) |
| `getSlotLeaders` | Block leader for upcoming slots |
| `getSupply` | Total, circulating, non-circulating SOL |
| `getVoteAccounts` | Active/delinquent validators, stake amounts |
| `getInflationRate` | Current inflation rate |
| `getLeaderSchedule` | Epoch leader schedule (cached, fetched every 5 min) |
| `getBlockProduction` | Slots assigned vs produced per validator (skip rate) |
| `getClusterNodes` | Cluster node count |
| `getTransactionCount` | All-time transaction count |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single-file `App.tsx` | All components in one file for simplicity; no prop-drilling across module boundaries |
| Hooks in `App()` only | Data persistence across page navigation, consistent hook ordering |
| CSS-based charts | No chart library dependency; full styling control, smaller bundle |
| HashRouter | Vercel SPA compatibility without server-side routing config |
| `connection.getBlock()` with json | ~5MB vs ~8.5MB with jsonParsed; web3.js handles deserialization |
| Leader schedule in ref | Epoch data changes every ~2-3 days; no need to refetch on slot changes |
| Failure refs in App | Failure accumulation persists when navigating away from `/failures` |
| IndexedDB for history | Program failure data stored per-block for session-level trend analysis |

### Styling System

CSS variables defined in `index.css`:

| Variable | Usage |
|----------|-------|
| `--accent` | Purple — primary accent (links, active states) |
| `--accent-secondary` | Blue — secondary accent |
| `--accent-tertiary` | Green — tertiary (TPS, success) |
| `--success` | Green — positive indicators |
| `--error` | Red — failures, errors |
| `--warning` | Yellow — warnings |
| `--bg-primary` | Dark background |
| `--bg-secondary` | Card/section background |
| `--text-primary/secondary/muted` | Text hierarchy |

### Transaction Categories

| Color | Category | Programs |
|-------|----------|----------|
| Green | DEX | Jupiter, Raydium, Orca, Meteora |
| Orange | Perps | Drift, Zeta |
| Teal | Lending | Solend, Marginfi, Kamino |
| Blue | Staking | Marinade, Jito, Stake Pool |
| Purple | Oracle | Pyth, Switchboard |
| Pink | NFT | Metaplex, Tensor, Magic Eden |
| Gray | Core | System, Token, ATA |
| Dark Gray | Vote | Vote Program |

## Setup

1. Get API keys from [Helius](https://helius.dev) and [Alchemy](https://alchemy.com)
2. Edit `src/hooks/useSolanaData.ts`:

```typescript
const HELIUS_API_KEY = 'YOUR_HELIUS_KEY';
const ALCHEMY_RPC = 'https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY';
```

3. Run:
```bash
bun install
bun run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Build | Vite 7 + Bun |
| Routing | react-router-dom v7 (HashRouter) |
| Solana | @solana/web3.js |
| Storage | IndexedDB (idb-keyval) |
| RPC | Helius (primary) + Alchemy (fallback) |

## Deploy

Push to GitHub. Import on [Vercel](https://vercel.com) — Vite is auto-detected. Deploys from `main` branch automatically.

Bundle: ~698KB (single chunk, no code splitting).

## Resources

- [Helius Docs](https://docs.helius.dev/)
- [Alchemy Solana Docs](https://docs.alchemy.com/reference/solana-api-quickstart)
- [Solana Compass](https://solanacompass.com)
- [Stakewiz](https://stakewiz.com)
- [Solana Docs](https://solana.com/docs)

## License

MIT
