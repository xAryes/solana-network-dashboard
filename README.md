# Solana Network Dashboard

Real-time Solana mainnet dashboard with block visualization, program analytics, and transaction flow. Built with React + Vite + Helius RPC.

**Live Demo**: [solana-network-dashboard.vercel.app](https://solana-network-dashboard.vercel.app/)

## Features

### Network Monitoring
- **Network Overview**: Real-time slot, block height, TPS, slot time, epoch progress, total transaction count
- **Network Health Dashboard**: Visual health gauges for TPS, slot time, skip rate, and success rate
- **Epoch Progress**: Visual progress bar with slot counts and time remaining

### Validators & Leaders
- **Validators & Stake**: Active/delinquent validator counts, total stake
- **Leader Schedule**: Upcoming block producers with grouped slot ranges
- **Version Distribution**: Software version breakdown across validators
- **Top Validators**: Ranked list with stake and performance metrics

### Block Explorer (Solana Beach-style)
- **Block Queue**: Live block pipeline with pause/resume and slot search
- **4-Panel Analytics**: Block Info, Transactions, Fees, Compute Units
- **Fee Breakdown**: Total fees, Base fees (5000L/sig), Priority fees, Jito Tips
- **Jito Tips Detection**: Tracks transfers to Jito's 8 tip accounts
- **Transaction Visualization**: Full-width bar chart showing all transactions in block order
- **Smart Tooltips**: Detailed tx info (signature, fee payer, fees, CU, SOL movement) with edge-aware positioning

### Transaction Analysis
- **Program Detection**: Identifies 40+ known Solana programs (Jupiter, Raydium, Orca, Pyth, etc.)
- **Live Transaction Stream**: Real-time WebSocket feed with color-coded categories
- **Failed Transactions Analysis**: Error categorization and failure patterns
- **Recent Blocks Table**: Clickable slots with TX count, CU %, success rate

### Reference Data
- **Supply & Inflation**: Total, circulating supply, inflation rate, epoch rewards
- **Priority Fees**: Current network fee percentiles (when available)
- **Network Limits Reference**: Comprehensive CU costs for 40+ operations, SIMD upgrade documentation

## Network Limits & Compute Units

The dashboard includes detailed CU cost information for various Solana operations:

### Protocol Limits (Post-SIMD Upgrades)
| Limit | Value |
|-------|-------|
| Block CU Limit | 60M |
| TX Max CU | 1.4M |
| TX Default CU | 200k |
| Per-Account Write Lock (SIMD-83) | 12M CU/block |
| Target Slot Time | 400ms |

### CU Costs by Operation Type
- **Basic**: SOL Transfer (~300-450), SPL Token Transfer (~2k-4.5k)
- **DeFi/DEX**: Jupiter Swap (~80k-400k), Raydium (~50k-150k), Orca (~60k-120k)
- **Lending**: Marginfi (~50k-100k), Kamino (~80k-120k), Drift (~200k-800k)
- **Staking**: Delegate Stake (~3k-5k), Marinade (~30k-60k), Jito (~40k-80k)
- **NFT**: Mint (~50k-150k), cNFT Mint (~20k-40k), Marketplace Trade (~100k-200k)
- **Infrastructure**: Pyth Update (~5k-15k), Vote TX (~2k-3k)

## Data Sources

All data is fetched from **Solana mainnet** via the **free tier** of [Helius RPC](https://helius.dev/):

| RPC Method | Data |
|------------|------|
| `getSlot()` | Current slot number |
| `getBlockHeight()` | Current block height |
| `getEpochInfo()` | Epoch progress, slots remaining |
| `getRecentPerformanceSamples()` | TPS calculation |
| `getBlock()` | Block details, transactions, program IDs, compute units |
| `getSupply()` | Total, circulating, non-circulating SOL |
| `getVoteAccounts()` | Active/delinquent validators, stake distribution |
| `getInflationRate()` | Current inflation rate, epoch rewards |
| `getLeaderSchedule()` | Upcoming block producers |
| `getBlockProduction()` | Leader slots, blocks produced |
| `getRecentPrioritizationFees()` | Priority fee percentiles (when available) |

The free Helius tier has rate limits (~10 RPS), so the dashboard uses 15-second refresh intervals to stay within limits.

## Setup

1. Get your API key at [helius.dev](https://helius.dev)
2. Edit `src/hooks/useSolanaData.ts`:

```typescript
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY';
```

3. Run the dashboard:
```bash
npm install
npm run dev
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
- **Build**: Vite 7
- **Solana**: @solana/web3.js
- **RPC**: Helius

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Deploy - Vite is auto-detected

### Netlify

1. Push to GitHub
2. Import at [netlify.com](https://netlify.com)
3. Build command: `npm run build`, Publish: `dist`

## Detected Programs

**DEX/AMM**: Jupiter v4/v6, Raydium AMM/CLMM, Orca Whirlpool, Meteora DLMM, Openbook, Phoenix

**Oracles**: Pyth, Pyth v2, Switchboard

**Lending**: Solend, Marginfi, Kamino Lend

**Staking**: Marinade, Jito Staking, Stake Pool

**NFT**: Metaplex, Tensor, Magic Eden v2

**Perps**: Drift, Zeta

**Core**: System, Token, Token-2022, ATA, Compute Budget, Vote, Memo

## Resources

- [Helius Docs](https://docs.helius.dev/)
- [Solscan](https://solscan.io)
- [Solana Docs](https://solana.com/docs)

## License

MIT
