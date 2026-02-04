# Solana Network Dashboard

A real-time Solana mainnet dashboard displaying network statistics, block composition, program analytics, and transaction flow visualization.

## Features

### Currently Working ✅

- **Network Overview**: Real-time slot, block height, TPS, slot time, epoch progress
- **Epoch Progress**: Visual progress bar with slot counts and time remaining
- **Validators & Stake**: Active/delinquent validator counts, total stake
- **Supply Info**: Total, circulating, and non-circulating supply
- **Block Performance**: Average TX/block, CU usage, success rates from recent blocks
- **CU Distribution Analysis**: Transaction categorization by compute unit usage (Micro, Light, Medium, Heavy, Compute)
- **Block Visualizer**: Visual composition of blocks showing transaction types
- **Program Detection**: Identifies 40+ known Solana programs (Jupiter, Raydium, Orca, Pyth, etc.)
- **Transaction Stream**: Clickable transaction grid with color-coded categories
- **Recent Blocks Table**: Clickable slots with TX count, CU %, success rate
- **Recent Transactions**: Transaction signatures with CU, fees, status
- **Network Limits Reference**: Block CU limit (60M), TX limits, slot time targets

### Data Sources

All data is fetched from **Solana mainnet** via [Helius RPC](https://helius.dev/):
- `getSlot()` - Current slot
- `getEpochInfo()` - Epoch progress
- `getRecentPerformanceSamples()` - TPS calculation
- `getBlock()` - Block details with transactions and program IDs
- `getSupply()` - SOL supply info
- `getVoteAccounts()` - Validator data

---

## 🔑 Configuration - Use Your Own Helius API Key

This dashboard is designed to work with any Helius plan. With higher-tier plans, you unlock additional features!

### Quick Setup

1. Get your API key at [helius.dev](https://helius.dev)
2. Edit `src/hooks/useSolanaData.ts`:

```typescript
// Replace with your Helius API key
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY';
```

3. Run the dashboard:
```bash
npm install
npm run dev
```

### Helius Plan Features

| Feature | Free | Developer | Business | Professional |
|---------|------|-----------|----------|--------------|
| Basic RPC (blocks, slots, supply) | ✅ | ✅ | ✅ | ✅ |
| Transaction parsing | ✅ | ✅ | ✅ | ✅ |
| Rate limits | 10 RPS | 50 RPS | 200 RPS | 500+ RPS |
| `getRecentPrioritizationFees` | ❌ | ✅ | ✅ | ✅ |
| Priority Fee API | ❌ | ✅ | ✅ | ✅ |
| Enhanced Transaction API | ❌ | ❌ | ✅ | ✅ |
| DAS (Digital Asset Standard) | ❌ | ✅ | ✅ | ✅ |
| Webhooks | ❌ | ✅ | ✅ | ✅ |
| WebSocket subscriptions | ❌ | ❌ | ✅ | ✅ |

### Unlockable Features (with Higher Plans)

The dashboard has placeholder sections ready to display data when you have access:

#### With Developer+ Plan:
- **Priority Fees**: Real-time fee percentiles (min, median, p75, p90, max)
- **Recommended Fee**: Suggested priority fee for fast inclusion

#### With Business+ Plan:
- **WebSocket Updates**: Real-time streaming instead of polling
- **Enhanced Parsing**: Richer transaction metadata

#### Future Integrations (PRs Welcome!):
- **Jito Bundle Data**: MEV tips, bundle success rates
- **Historical Charts**: TPS, fees, success rates over time
- **Account Explorer**: View account history, token balances

---

## 🎨 Color Legend

### Dashboard Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| 🟣 Purple | `#a78bfa` | Key metrics (slot, supply, epoch) |
| 🟢 Green | `#34d399` | Health indicators (TPS, success rate) |
| 🔵 Blue | `#38bdf8` | Interactive links (Solscan) |
| 🟡 Yellow | `#fbbf24` | Warnings (high CU, low success) |
| 🔴 Red | `#f87171` | Errors (failed transactions) |

### Block Visualizer - Transaction Categories

| Color | Category | Description | Example Programs |
|-------|----------|-------------|------------------|
| 🟢 Green | DEX | Swaps & AMM | Jupiter, Raydium, Orca, Meteora |
| 🟠 Orange | Perps | Derivatives | Drift, Zeta |
| 🩵 Teal | Lending | Borrow/Lend | Solend, Marginfi, Kamino |
| 🔵 Blue | Staking | Liquid Staking | Marinade, Jito, Stake Pool |
| 💜 Purple | Oracle | Price Feeds | Pyth, Switchboard |
| 🩷 Pink | NFT | NFT Markets | Metaplex, Tensor, Magic Eden |
| ⬜ Gray | Core | System ops | System, Token, ATA |
| ⬛ Dark Gray | Vote | Consensus | Vote Program |
| 🔘 Slate | Unknown | Unidentified | Other programs |

### CU Distribution Categories

| Category | CU Range | Typical Operations |
|----------|----------|-------------------|
| Micro | < 5k | SOL transfers, memos |
| Light | 5k - 50k | Token transfers, basic ops |
| Medium | 50k - 200k | Simple swaps, staking |
| Heavy | 200k - 500k | Complex DeFi, multi-hop |
| Compute | > 500k | Liquidations, heavy compute |

---

## Current Limitations ⚠️

### With Basic/Free Helius Plan

1. **No Priority Fee Data**: `getRecentPrioritizationFees()` requires Developer+ plan
2. **Polling Only**: No WebSocket subscriptions (requires Business+ plan)
3. **Rate Limits**: 10 RPS limits refresh frequency to ~2-5 seconds
4. **No Historical Data**: Only recent blocks, no archival access

### Requires Custom Infrastructure

| Feature | What's Needed |
|---------|---------------|
| Hot Accounts (Contention) | Validator scheduler access or Jito API |
| Skip Rate by Validator | Leader schedule + production logs |
| Vote Latency | Vote transaction analysis pipeline |
| Historical Charts | Time-series database + indexer |

---

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **Build**: Vite
- **Solana**: @solana/web3.js
- **RPC**: Helius (configurable)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🚀 Deployment

### Option 1: Vercel (Recommended - Easiest)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" → Import your repository
4. Vercel auto-detects Vite - just click "Deploy"
5. Your site will be live at `https://your-project.vercel.app`

### Option 2: Netlify

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com) and sign in with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build settings: Build command `npm run build`, Publish directory `dist`
6. Click "Deploy"

### Option 3: GitHub Pages

1. Edit `vite.config.ts` and uncomment the `base` line:
   ```typescript
   base: '/your-repo-name/',
   ```
2. Push to GitHub
3. Enable GitHub Pages in repository Settings → Pages
4. Set source to "GitHub Actions"
5. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm ci
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

## Detected Programs

The dashboard recognizes 40+ Solana programs:

**DEX/AMM**: Jupiter v4/v6, Raydium AMM/CLMM, Orca Whirlpool, Meteora DLMM, Openbook, Phoenix

**Oracles**: Pyth, Pyth v2, Switchboard

**Lending**: Solend, Marginfi, Kamino Lend

**Staking**: Marinade, Jito Staking, Stake Pool

**NFT**: Metaplex, Tensor Swap, Tensor cNFT, Magic Eden v2

**Perps**: Drift, Zeta

**Core**: System, Token, Token-2022, ATA, Compute Budget, Vote, Memo

To add more programs, edit `KNOWN_PROGRAMS` in `src/hooks/useSolanaData.ts`.

## Network Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Block CU Limit | 60M | Max compute units per block |
| TX Default CU | 200k | Default CU limit per transaction |
| TX Max CU | 1.4M | Maximum requestable CU per transaction |
| Target Slot Time | 400ms | Expected slot production time |
| Slots per Epoch | 432,000 | ~2-3 days |

## Resources

- [Helius Docs](https://docs.helius.dev/) - RPC & API documentation
- [Helius Priority Fee API](https://docs.helius.dev/solana-rpc-nodes/alpha-priority-fee-api) - Fee recommendations
- [Solscan](https://solscan.io) - Transaction explorer
- [Solana Docs](https://solana.com/docs) - Network documentation

## Contributing

PRs welcome! Some ideas:
- Add more program detections
- Implement priority fee display (requires API key with access)
- Add WebSocket support for real-time updates
- Historical data charts
- Account/transaction search

## License

MIT
