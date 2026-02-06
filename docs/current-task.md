# Current State — sol.watch v1+

## Status
v1 shipped at `9af5283`. Latest committed: `9efcea8`. Significant uncommitted changes on main from multiple UI polish sessions. Not yet committed or deployed.

## Uncommitted Changes (src/App.tsx ~4824 lines)

### Session 1 (Earlier Today)
- Enhanced failure accumulation (error types, snapshots, totalFailed refs)
- Error Types card + Session Failure Trend card on Failures page
- Analytics cards redesign (hero metrics + stacked bars) on Explorer
- Epoch tooltip compaction, tooltip bg → black, epoch links → Solscan
- Fee stats in lamport precision

### Session 2 (Current — Failures Page Redesign + UX Polish)

#### Failures Page Overhaul
- **Hero stats strip**: 4 metrics (Live Rate, vs Epoch Avg, Wasted SOL, Session Failed) with vertical dividers on desktop, `text-2xl font-semibold` numbers
- **Historical trend chart**: Kept, added description line
- **Removed**: "Failed Transactions by Epoch (volume)" bar chart — user said useless
- **Removed**: Epoch selector (‹/› buttons + epoch context strip + mini bar navigator) from Failing Programs — simplified to compare vs current epoch only
- **Removed**: `selectedEpochIdx` state, `epochCorrelation` useMemo, `blockComposition` tracking from analysis useMemo
- **Programs table**: Full-width with bars, CU Wasted column, category breakdown summary bar. "vs Epoch" column uses current epoch's network-wide failure rate
- **3-column insights**: CU Waste by Program, Failure by Block Position, Error Types (compact)
- **Cost of Failures**: 2 stat boxes + CU waste / fee waste progress bars + avg per failed TX summary
- **Session Failure Trend**: Kept with flex-col for equal height alignment
- **Collapsible wallets**: Kept with description inside

#### Context Descriptions Added to ALL Pages
Every section/card now has a descriptive subtitle explaining what users are seeing:
- Dashboard: Network Overview, Validators & Network, Supply & Economics, Epoch Progress, Leader Rotation, Network Limits
- Explorer: Real-Time Analytics, Fee Analysis, Compute & Block Efficiency, Epoch Deep Dive, Block Explorer, Compute Units (block detail), Fee Breakdown (tx detail), Program Activity
- Failures: Hero strip, Failure Rate by Epoch chart, Failing Programs, CU Waste, Block Position, Error Types, Cost, Session Trend, Top Wallets
- Validators: Validators table, Network Health Overview, Geographic Distribution

#### Explorer Page Improvements
- **Aligned stacked bars**: Fee Distribution and TX Compute Distribution bars now use `flex flex-col` + `mt-auto` to align at bottom regardless of content height
- **CU capacity bar**: h-3 → h-2 to match Fee Analysis priority adoption bar
- **Interactive fee-by-position chart**: Click any bar to select a section → shows summary panel with: Avg Priority, Avg Jito Tip, Total Fees, Avg CU, Success Rate, Top Programs (as colored pill badges). Click again to deselect. State resets on block change.
- feeByPosition useMemo enriched with: totalFees, totalCU, successCount, failCount, topPrograms per bucket

#### Dashboard
- Section order unchanged (Overview → Epoch Progress → Epoch Summary → Validators → Supply → Leader → Limits)
- Descriptions added to all SectionHeaders

## Key Lines (approximate, in ~4824-line App.tsx)
- BlockDeepDive: starts ~line 2621, selectedFeeBucket state ~line 2631
- feeByPosition useMemo: ~line 2839 (enriched with summary data)
- Fee-by-position chart with click interaction: ~line 3804
- FailedTransactionsAnalysis: starts ~line 1800
- Hero stats strip: ~line 1978
- Programs table (no epoch selector): ~line 2140
- 3-col insights: ~line 2360
- Cost + Session Trend 2-col: ~line 2443
- AnalyticsSection (Explorer): starts ~line 1437, cards use flex-col + mt-auto

## Remaining Tasks
- [ ] UI/UX polish — ongoing ← CURRENT FOCUS
- [ ] Mobile experience (BlockDeepDive is heavy on small screens)
- [ ] Loading timeout / "no data" states
- [ ] Commit & deploy all uncommitted changes
