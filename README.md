# Solana Network Dashboard

Real-time Solana mainnet dashboard with block exploration, program analytics, epoch trends, and transaction visualization. Built with React + Vite + Helius/Alchemy RPC.

**Live Demo**: [solana-network-dashboard.vercel.app](https://solana-network-dashboard.vercel.app/)

## Features

### Network Overview
- **Live Metrics**: Current slot, block height, TPS, average slot time, epoch progress, total transaction count
- **Network Health**: Visual health gauges for TPS, slot time, skip rate, and success rate with color-coded status
- **Epoch Progress**: Visual progress bar with slot counts, time remaining, and estimated end date

### Validators & Leaders
- **Validator Table**: Paginated list of all validators with logos (via Stakewiz), stake %, commission, and delinquency status
- **Leader Schedule**: Upcoming block producers with validator names, logos, and geographic location
- **Network Stats**: Active/delinquent counts, total stake, skip rate, blocks produced

### Block Explorer
- **Block Queue**: Live block pipeline with pause/resume and slot search
- **4-Panel Analytics**: Block Info (with leader), Transactions (with Jito bundles), Fees (with composition bar), Compute Units (with Jito CU)
- **Fee Breakdown**: Base fees (5000 lamports/sig), Priority fees (avg/p50/p99/max), Jito Tips distribution
- **Transaction Visualization**: Log-scale bar chart showing all transactions in block order, color-coded by program category
- **Smart Tooltips**: Hover for detailed tx info — signature, fee payer, fees, CU, SOL movement, Jito tip, with edge-aware positioning
- **Helius Enhanced Data**: Transaction type and source enrichment (SWAP, TRANSFER, NFT_SALE, etc.) via Helius Enhanced Transactions API

### Real-time Analytics
- **Fee Analysis**: Priority fee percentiles via Helius `getPriorityFeeEstimate`
- **CU Distribution**: Compute unit breakdown across Micro/Light/Medium/Heavy/Compute categories
- **Program Activity**: Top programs by transaction count with category breakdown

### Epoch Analytics
- **Multi-Epoch Trends**: Transaction volume, fees, Jito MEV tips, and performance across recent epochs
- **Fee Composition**: Visual breakdown of base fees vs priority fees vs Jito tips per epoch
- **Performance Metrics**: Success rate, block time, skip rate, failed transaction count
- **Data Source**: Historical epoch data via [Solana Compass](https://solanacompass.com) API

### Failed Transactions
- **Failure Analysis**: Failure rate, wasted CU, wasted fees across recent blocks
- **Program Failure Rates**: Per-program failure tracking with total call counts
- **Category Breakdown**: Failures by transaction type (DEX, lending, staking, etc.)
- **Recent Failed TXs**: Enriched with Helius Enhanced TX data showing type and source

### Reference Data
- **Supply & Economics**: Total/circulating supply, inflation rate, validator APY
- **Network Limits**: Comprehensive CU costs for 40+ operations, SIMD upgrade documentation

## Architecture

### Data Flow
```
Helius RPC (primary) ──┐
                       ├──> React hooks ──> Components
Alchemy RPC (fallback) ┘

Helius Enhanced TX API ──> Failed TX enrichment + Block Explorer tooltips
Stakewiz API ──> Validator logos, names, locations
Solana Compass API ──> Historical epoch performance data
```

### Resilience
- **Dual RPC**: Helius primary with automatic per-call Alchemy fallback
- **Error Boundary**: React Error Boundary catches render crashes and shows recovery UI
- **Graceful Degradation**: Each section handles loading/error states independently
- **Leader Schedule Caching**: Fetched once + every 5 minutes (not on every slot change)

## Data Sources

| Provider | Role | Data |
|----------|------|------|
| **Helius** | Primary RPC + APIs | RPC calls, Enhanced TX API, Priority Fee API |
| **Alchemy** | Fallback RPC | All standard RPC calls when Helius is unavailable |
| **Stakewiz** | Validator metadata | Logos, names, geographic location (city/country) |
| **Solana Compass** | Epoch history | Multi-epoch performance, fees, Jito tips |

### RPC Methods Used

| Method | Data |
|--------|------|
| `getSlot()` | Current slot number |
| `getEpochInfo()` | Epoch progress, slots remaining |
| `getRecentPerformanceSamples()` | TPS calculation |
| `getBlock()` | Block details, transactions, programs, fees, CU |
| `getSlotLeaders()` | Block leader for each slot |
| `getSupply()` | Total, circulating, non-circulating SOL |
| `getVoteAccounts()` | Active/delinquent validators, stake |
| `getInflationRate()` | Current inflation rate |
| `getLeaderSchedule()` | Upcoming block producers (cached) |
| `getBlockProduction()` | Leader slots, blocks produced, skip rate |
| `getClusterNodes()` | Cluster node count |
| `getTransactionCount()` | All-time transaction count |
| `getPriorityFeeEstimate` | Priority fee percentiles (Helius-specific) |

### External APIs

| Endpoint | Method | Data |
|----------|--------|------|
| `api.helius.xyz/v0/transactions` | POST (up to 100 sigs) | Transaction type, source, description |
| `api.stakewiz.com/validators` | GET | Validator logos, names, locations |
| `solanacompass.com/api/epoch-performance/{epoch}` | GET | Epoch-level network statistics |

## Setup

1. Get API keys from [Helius](https://helius.dev) and [Alchemy](https://alchemy.com)
2. Edit `src/hooks/useSolanaData.ts`:

```typescript
const HELIUS_API_KEY = 'YOUR_HELIUS_KEY';
const ALCHEMY_RPC = 'https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY';
```

3. Run the dashboard:
```bash
bun install
bun run dev
```

## Transaction Categories

| Color | Category | Example Programs |
|-------|----------|------------------|
| Green | DEX | Jupiter, Raydium, Orca, Meteora |
| Orange | Perps | Drift, Zeta |
| Teal | Lending | Solend, Marginfi, Kamino |
| Blue | Staking | Marinade, Jito, Stake Pool |
| Purple | Oracle | Pyth, Switchboard |
| Pink | NFT | Metaplex, Tensor, Magic Eden |
| Gray | Core | System, Token, ATA |
| Dark Gray | Vote | Vote Program |

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Build**: Vite 7 + Bun
- **Solana**: @solana/web3.js
- **RPC**: Helius (primary) + Alchemy (fallback)
- **Storage**: IndexedDB (historical block data)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Deploy — Vite is auto-detected

### Netlify

1. Push to GitHub
2. Import at [netlify.com](https://netlify.com)
3. Build command: `bun run build`, Publish: `dist`

## Dashboard Sections

| Nav | Section | Key Data |
|-----|---------|----------|
| Overview | Network Overview + Epoch Progress | Slot, TPS, epoch % |
| Health | Network Health | TPS/slot time/skip rate gauges |
| Validators | Validators & Network + Supply | Paginated table with logos |
| Leaders | Leader Rotation | Upcoming producers with metadata |
| Real-time | Analytics | Fee analysis, CU distribution |
| Epochs | Epoch Analytics | Multi-epoch trends from Solana Compass |
| Failures | Failed Transactions | Failure rates, wasted CU, program breakdown |
| Explorer | Block Explorer | 4-panel block deep dive + tx visualization |
| Limits | Network Limits | CU costs, protocol limits, SIMD upgrades |

## Resources

- [Helius Docs](https://docs.helius.dev/)
- [Alchemy Solana Docs](https://docs.alchemy.com/reference/solana-api-quickstart)
- [Solana Compass](https://solanacompass.com)
- [Stakewiz](https://stakewiz.com)
- [Solscan](https://solscan.io)
- [Solana Docs](https://solana.com/docs)

## License

MIT
