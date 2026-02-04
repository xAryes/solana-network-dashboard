# Solana Network Dashboard

A real-time Solana mainnet dashboard displaying network statistics, block data, validators, and supply information.

## Features

### Currently Working ✅

- **Network Overview**: Real-time slot, block height, TPS, slot time, epoch progress
- **Epoch Progress**: Visual progress bar with slot counts and time remaining
- **Validators & Stake**: Active/delinquent validator counts, total stake
- **Supply Info**: Total, circulating, and non-circulating supply
- **Block Performance**: Average TX/block, CU usage, success rates from recent blocks
- **Recent Blocks Table**: Clickable slots with TX count, CU %, success rate
- **Recent Transactions**: Transaction signatures with CU, fees, status
- **Network Limits Reference**: Block CU limit (60M), TX limits, slot time targets

### Data Sources

All data is fetched from **Solana mainnet** via [Helius RPC](https://helius.dev/):
- `getSlot()` - Current slot
- `getEpochInfo()` - Epoch progress
- `getRecentPerformanceSamples()` - TPS calculation
- `getBlock()` - Block details with transactions
- `getSupply()` - SOL supply info
- `getVoteAccounts()` - Validator data

## Current Limitations ⚠️

### RPC Limitations (Basic Helius Plan)

1. **No Priority Fee Data**: Cannot access `getRecentPrioritizationFees()` - would need enhanced RPC or DAS API
2. **No Program-Level Analytics**: Can't efficiently aggregate transactions by program without indexing
3. **No Account Contention Data**: Write lock contention requires validator-level access or specialized APIs
4. **Limited Historical Data**: Only recent blocks available, no historical trends without archival node
5. **Rate Limits**: Basic RPC has request limits, data refreshes every 2-5 seconds
6. **No WebSocket**: Using polling instead of subscriptions for real-time updates

### Missing Features (Need Better Data Access)

| Feature | Required Data | Current Status |
|---------|---------------|----------------|
| Priority Fee Percentiles | `getRecentPrioritizationFees` or Helius Priority Fee API | Placeholder |
| Top Programs by TX | Transaction indexing / Helius DAS | Placeholder |
| Hot Accounts (Contention) | Validator scheduler data / Jito bundles API | Placeholder |
| Skip Rate | Leader schedule + block production logs | Placeholder |
| Vote Latency | Vote transaction analysis | Placeholder |
| Stake Participation | Detailed epoch stake snapshots | Placeholder |

## What Would Make It Better 🚀

### 1. Enhanced RPC Access (Helius Pro/Business)
- Priority fee market analysis (min, median, p75, p90, max)
- Recommended fee for fast inclusion
- Enhanced transaction parsing with Helius DAS API
- Higher rate limits for more frequent updates

### 2. Jito Integration
- Bundle success rates
- MEV reward data
- Tip distribution analytics
- Searcher activity metrics

### 3. Custom Indexer (like Harmonic has)
- Program-level transaction analytics
- Top programs by TX count, CU usage, success rate
- Account contention heatmap
- Transaction type breakdown (swaps, transfers, NFT mints, etc.)
- Historical trends and charts

### 4. Validator-Level Access
- Real-time scheduler queue depth
- Write lock contention per account
- Leader schedule visualization with your validator's slots
- Skip rate tracking by validator

### 5. UI Enhancements to Match Harmonic
- [ ] **Block Visualization**: 3D/animated block explorer showing transaction flow
- [ ] **Real-time Streaming**: WebSocket-based live transaction feed
- [ ] **Search**: Transaction/account/block search functionality
- [ ] **Historical Charts**: TPS, fees, success rates over time
- [ ] **Detailed Block View**: Expandable block details with all transactions
- [ ] **Account Explorer**: View account history, token balances
- [ ] **Program Analytics**: Deep dive into specific programs

## Comparison with Harmonic

| Feature | This Dashboard | Harmonic |
|---------|---------------|----------|
| Real-time blocks | ✅ Basic table | ✅ Visual block explorer |
| Transaction stream | ✅ Recent TXs | ✅ Live animated stream |
| Network stats | ✅ Basic stats | ✅ Comprehensive |
| Block visualization | ❌ | ✅ 3D block view |
| Search | ❌ | ✅ Full search |
| Historical data | ❌ | ✅ Charts & trends |
| Priority fees | ❌ | ✅ Fee analytics |
| Program breakdown | ❌ | ✅ Per-program stats |

**Why the gap?** Harmonic likely has:
- Custom indexing infrastructure
- Direct validator node access
- Specialized APIs for scheduler/contention data
- Significant backend infrastructure

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build**: Vite
- **Solana**: @solana/web3.js
- **RPC**: Helius (mainnet - basic plan)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Configuration

The Helius RPC endpoint is configured in `src/hooks/useSolanaData.ts`:

```typescript
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY';
```

Get your API key at [helius.dev](https://helius.dev).

## Color Legend

| Color | Meaning | Example |
|-------|---------|---------|
| 🟣 Purple (`#a78bfa`) | Key metrics | Current slot, Total supply |
| 🟢 Green (`#34d399`) | Health indicators | TPS, Success rate, Circulating % |
| 🔵 Blue (`#38bdf8`) | Interactive links | Block/TX links to Solscan |
| 🟡 Yellow (`#fbbf24`) | Warnings | High CU usage, Low success rate |

## Network Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Block CU Limit | 60M | Max compute units per block |
| TX Default CU | 200k | Default CU limit per transaction |
| TX Max CU | 1.4M | Maximum requestable CU per transaction |
| Target Slot Time | 400ms | Expected slot production time |
| Slots per Epoch | 432,000 | ~2-3 days |

## Resources

- [Harmonic Explorer](https://explorer.harmonic.gg) - Inspiration for block visualization
- [Solscan](https://solscan.io) - Transaction explorer
- [Helius Docs](https://docs.helius.dev/) - RPC documentation
- [Solana Docs](https://solana.com/docs) - Network documentation

## License

MIT
