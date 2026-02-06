# Architecture

## Data Flow

```
┌──────────────────────────────────────────────────────┐
│                    External APIs                      │
├──────────────┬──────────────┬────────────┬───────────┤
│ Helius RPC   │ Alchemy RPC  │ Stakewiz   │ Solana    │
│ (primary)    │ (fallback)   │ (metadata) │ Compass   │
└──────┬───────┴──────┬───────┴─────┬──────┴─────┬─────┘
       │              │             │            │
       ▼              ▼             ▼            ▼
┌──────────────────────────────────────────────────────┐
│           src/hooks/useSolanaData.ts                  │
│                                                       │
│  useNetworkStats()    → slot, epoch, TPS              │
│  useRecentBlocks(4)   → block data + transactions     │
│  useLeaderSchedule()  → upcoming block producers      │
│  useValidatorNames()  → name + metadata lookup        │
│  useTopValidators()   → ranked validator list          │
│  useNetworkHistory()  → epoch trends (Solana Compass) │
│  usePriorityFees()    → fee percentiles (Helius)      │
│  useSupplyInfo()      → SOL supply                    │
│  useInflationInfo()   → inflation rates               │
│  useClusterInfo()     → node counts                   │
│  useBlockProduction() → skip rate                     │
│  useValidatorInfo()   → validator counts              │
│  useValidatorLocations() → geographic data            │
│  useHistoricalProgramFailures() → IndexedDB (unused)  │
│  fetchEnhancedTx()    → TX enrichment (on-demand)     │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                   src/App.tsx                          │
│                                                       │
│  App() ─── orchestrates all hooks + routing           │
│    │                                                  │
│    ├── DashboardPage (/)                              │
│    │   ├── NetworkOverview (stat cards)               │
│    │   ├── EpochProgress (progress bar)               │
│    │   ├── EpochSummaryCards (4 cards + mini charts)  │
│    │   ├── Validators & Network (stat cards)          │
│    │   ├── Supply & Economics (stat cards)             │
│    │   ├── LeaderSchedulePanel (row + chip strip)     │
│    │   └── NetworkLimitsSection                       │
│    │                                                  │
│    ├── ExplorerPage (/explorer)                       │
│    │   ├── EpochDetailedAnalytics (fees/CU/table)    │
│    │   ├── AnalyticsSection (fees, CU distribution)  │
│    │   └── BlockDeepDive (4-panel + tx visualization)│
│    │                                                  │
│    ├── FailuresPage (/failures)                       │
│    │   └── FailedTransactionsAnalysis                │
│    │       ├── Row 1: Overview + Cost of Failures    │
│    │       ├── Row 2: Error Types + Session Trend    │
│    │       ├── All Failing Programs (accumulated)    │
│    │       └── Top Failing Wallets                   │
│    │                                                  │
│    └── ValidatorsPage (/validators)                   │
│        ├── TopValidatorsSection (paginated, logos)    │
│        └── ValidatorGeography                        │
│                                                       │
│  Module-level helpers:                                │
│    formatSOL, formatCompact, getTrend, TrendBadge    │
│    CU_CATEGORIES, CATEGORY_COLORS                    │
│    getAvatarGradient, formatLocation, COUNTRY_FLAGS   │
└──────────────────────────────────────────────────────┘
```

## RPC Failover Pattern

```typescript
// Primary call with per-call fallback
const primary = getConnection();      // Helius
const fallback = getFallbackConnection(); // Alchemy

let result;
try {
  result = await primary.someMethod();
} catch {
  result = await fallback.someMethod();
}
```

This is applied at the individual call level in `useNetworkStats` and `useRecentBlocks`, not at the connection level. Each failed call falls back independently.

## Refresh Intervals

| Hook | Interval | Rationale |
|------|----------|-----------|
| useNetworkStats | 2s | Core live metrics (slot, TPS) |
| useRecentBlocks | 12s | Block data is heavy (~5MB × 4 blocks) |
| useLeaderSchedule (fetch) | 5 min | Epoch-level data, rarely changes |
| useLeaderSchedule (compute) | 2s | Cheap recomputation on slot change |
| usePriorityFees | 10s | Fee market changes fast |
| useTopValidators | mount only | Large dataset, changes slowly |
| useValidatorNames | mount only | Stakewiz data is static |
| useNetworkHistory | mount only | Solana Compass epoch data |
| useSupplyInfo | mount only | Supply changes very slowly |
| useHistoricalProgramFailures | 60s | IndexedDB aggregation refresh |

## Styling System

- No external chart library — all visualizations are CSS-based (divs with width %, background colors)
- CSS variables in `src/index.css` define the color palette
- Tailwind CSS 4 for utility classes
- Custom CSS animations for entrance effects, loading states, live indicators
- `CATEGORY_COLORS` constant maps transaction categories to hex colors
- `CU_CATEGORIES` defines compute unit ranges (Micro/Light/Medium/Heavy/Compute)

## Epoch Analytics Architecture

The epoch analytics system was split into two components that share module-level helpers:

```
NetworkHistoryData (from useNetworkHistory)
    │
    ├──→ EpochSummaryCards (Dashboard /)
    │    └── 4 cards: Transactions, Fees, Jito, Block Efficiency
    │        Each with mini bar chart + trend badge + key metrics
    │
    └──→ EpochDetailedAnalytics (Explorer /explorer)
         ├── Fee Breakdown (3 fee type cards + per-epoch trend)
         ├── Compute & Block Efficiency (3 metric cards + CU fill bars with tooltips)
         └── Epoch History Table (full comparison across epochs)

Shared helpers (module-level):
  formatSOL(lamports) — graduated precision + lamports fallback
  formatCompact(num)  — k/M/B formatting
  getTrend(values[])  — direction + pct change
  TrendBadge          — React component for colored trend display
```

## Failure Accumulation Data Flow

```
blocks (from useRecentBlocks)
    │
    ▼
App() useEffect [blocks] ─── processes new blocks via processedSlotsRef
    │
    ├── accProgramFailuresRef  → per-program fail counts
    ├── accProgramTotalsRef    → per-program total counts
    ├── accPayerFailuresRef    → per-payer fail counts
    ├── accErrorTypesRef       → error type distribution (parsed from tx.errorMsg JSON)
    ├── accFailureSnapshotsRef → time-series [{time, rate, failed, total}] (max 120, 1/sec)
    ├── accTotalFailedRef      → cumulative failed TX count
    ├── accTotalBlocksRef      → cumulative block count
    └── accTotalTxsRef         → cumulative TX count
    │
    ▼
failureAccumulation (useMemo, triggered by failureRefreshCounter)
    │
    ├── programRates: sorted [{prog, failCount, total, rate}]
    ├── topPayers: sorted [[address, count]]
    ├── errorTypes: sorted [{type, count, pct}]
    ├── snapshots: [{time, rate, failed, total}]
    ├── totalFailed, totalBlocks, totalTxs, sessionStart
    │
    ▼
FailuresPage → FailedTransactionsAnalysis (renders all failure cards)
```
