# sol.watch

Real-time Solana mainnet dashboard — block exploration, validator analytics, epoch trends, failure tracking, and transaction visualization.

**Live**: [solwatch.vercel.app](https://solwatch.vercel.app/)

Built with React + TypeScript + Tailwind. Powered by Helius and Alchemy RPCs.

## Pages

### Dashboard (`/`)
- Network overview (slot, block height, TPS, slot time)
- Epoch progress with time remaining
- Epoch summary cards (Transactions, Fees, Jito Tips, CU/Performance) with mini bar charts
- Validators & network stats
- Supply & economics
- Leader rotation with consecutive block counter
- Network limits & CU costs

### Explorer (`/explorer`)
- Epoch detailed analytics (fee breakdown, CU efficiency trends)
- Real-time analytics with hero metrics, priority adoption, stacked distributions
- Block deep dive with interactive fee-by-position chart (click-to-select + summary panel)

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
- Geographic distribution by country/city

## Tech Stack

React 19 | TypeScript | Tailwind CSS 4 | Vite 7 | Bun | react-router-dom v7 | @solana/web3.js | IndexedDB

## Data Sources

Helius (primary RPC + Enhanced TX + Priority Fees) | Alchemy (fallback RPC) | Stakewiz (validator metadata) | Solana Compass (epoch data)
