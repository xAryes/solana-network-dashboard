# Solana Network Dashboard

## Context Recovery

IMPORTANT: At session start, read all .md files in the /docs/ directory to restore full project context from the previous session.

## Current State

- **Branch**: main
- **Status**: Dashboard live on Vercel. Major UI/UX polish pass: context descriptions on all sections, interactive fee-by-position chart, failures page redesigned (hero strip, streamlined programs table, cost progress bars), Explorer card alignment. Uncommitted changes in App.tsx.
- **Last updated**: 2026-02-06
- **Live URL**: https://solwatch.vercel.app/
- **Branding**: sol.watch (minimal text logo, "s." favicon)

## Task Progress

- [x] Fix black screen crash (useLeaderSchedule calling 432K-entry RPC every 2s)
- [x] Add React Error Boundary for render crash recovery
- [x] Add Alchemy RPC fallback (per-call failover)
- [x] Rewrite block fetching (connection.getBlock + parallel Promise.all)
- [x] Enhance Block Explorer (leader, Jito bundles, fee composition, log-scale chart)
- [x] Fix hooks ordering in BlockDeepDive (useMemo after early return)
- [x] Enrich failed TXs with Helius Enhanced TX API
- [x] Add validator logos/pagination/metadata to validators table
- [x] Add CSS animations (bar grow, row slide-in, section reveal, live pulse)
- [x] Reorganize nav sections, remove low-value components
- [x] Add Epoch Analytics with Solana Compass integration
- [x] Update README
- [x] Multi-page routing with react-router-dom (4 pages: Dashboard, Explorer, Failures, Validators)
- [x] Extract failure accumulation to App level (persists across page navigation)
- [x] IndexedDB program failure history with 24h trends
- [x] Block production per-validator with skip rate column
- [x] Geographic distribution component on validators page
- [x] Invert fee-by-position chart axes (vertical bars below 3-col grid)
- [x] Remove Recent Failed TXs card and Helius enrichment fetch
- [x] Fix formatSOL showing "0.00" for small values (lamports fallback)
- [x] Move "by xAryes" branding from footer to header
- [x] Add hover tooltips to CU Fill Rate epoch bars
- [x] Split EnhancedEpochAnalytics → EpochSummaryCards (Dashboard) + EpochDetailedAnalytics (Explorer)
- [x] Compact leader rotation (inline current + grid upcoming, removed hero card)
- [x] Validator health scores with SVG gauges + interactive table column
- [x] Horizontal leader timeline → simplified clean row layout
- [x] Remove Epoch History Table from Explorer
- [x] Frosted glass header with backdrop blur
- [x] TX visualization x-axis markers (1/3, 2/3) + fee-by-position labels
- [x] Remove TX table from BlockDeepDive
- [x] Network Health Overview stacked bars on Validators page
- [x] Failure rate session vs 24h chart (added then removed — user preferred session-only)
- [x] Auto-pause block on TX click + trim TX detail panel
- [x] Epoch bar chart fix (flex-col alignment + current epoch pulsing indicator)
- [x] Leader rotation dynamics (consecutive counter bubble, faster animations, block counter)
- [x] Validator search input in table pagination
- [x] Rebrand to sol.watch (minimal text logo)
- [x] X (Twitter) profile link → moved to footer (icon only, centered, on same line as credits)
- [x] Rewrite README with full architecture documentation
- [x] Update Vercel URL to solwatch.vercel.app
- [x] Redesign Analytics cards: hero metrics, priority adoption bar, stacked fee/CU distribution bars
- [x] Enhanced failure accumulation: error types, time-series snapshots, totalFailed
- [x] Error Types breakdown card on Failures page (session-accumulated, colored bars)
- [x] Session Failure Trend chart on Failures page (live SVG area chart with cumulative rate)
- [x] Compact epoch tooltips (flow layout instead of 2-col grid)
- [x] Epoch links changed from Solana Compass to Solscan
- [x] Tooltip backgrounds: bg-primary → bg-black for consistency across all tooltips
- [x] Mobile nav background: bg-primary → bg-black
- [x] Fee stats refactored to lamport-precision (avgLamports, avgPriorityLamports, priorityCount, baseOnlyCount)
- [x] CU stats: min/median/peak/total stats below capacity bar
- [x] Context descriptions on ALL sections across all 4 pages (16+ descriptive subtitles)
- [x] Failures page redesign: hero stats strip (4 metrics with dividers), remove epoch selector from programs, remove volume chart, remove composition chart
- [x] Cost of Failures: CU waste + fee waste progress bars, avg per failed TX summary
- [x] Interactive fee-by-position chart: click bar to select section, summary panel with fees/CU/success rate/top programs
- [x] Explorer card alignment: flex-col + mt-auto for stacked bar alignment across 2-column grid
- [x] CU capacity bar height matched to priority adoption bar (h-3 → h-2)
- [x] Collapsible top failing wallets section
- [ ] UI/UX polish — design isn't final, needs visual improvements ← CURRENT
- [ ] Improve mobile experience (BlockDeepDive is heavy on small screens)
- [ ] Add loading timeout / "no data" states for sections that stay empty

## Key Decisions

- **Helius primary, Alchemy fallback**: Helius has premium features (Enhanced TX, Priority Fee API) that Alchemy lacks
- **connection.getBlock() over raw fetch**: json encoding is ~5MB vs jsonParsed at ~8.5MB, web3.js handles deserialization
- **Leader schedule cached in ref**: Epoch data changes every ~2-3 days, no need to refetch on slot changes
- **Single-file App.tsx**: All components in one file for simplicity; could split later if it grows further
- **No chart library**: CSS-based charts keep bundle small and give full styling control
- **HashRouter**: For Vercel SPA compatibility (no server-side routing config needed)
- **Hooks in App()**: All data hooks stay in App component, data passed as props to page components. Ensures hooks always called in same order and data persists across navigation.
- **Failure accumulation at App level**: Refs for failure tracking live in App, not in FailedTransactionsAnalysis, so data survives page navigation
- **Epoch analytics split**: Summary cards on Dashboard, detailed analysis (fees/CU) on Explorer.
- **Module-level helpers**: `formatSOL`, `formatCompact`, `getTrend`, `TrendBadge` extracted from component to module level for reuse across split components.
- **No 24h comparison**: User preferred session-only failure data. Removed historicalProgramFailures dependency.
- **Minimal TX detail panel**: Removed signature, programs, balance changes, instructions, logs from selected TX. Keep only header + efficiency score + fee/compute breakdown + Solscan link.
- **Tooltip backgrounds**: Use `bg-black/95` instead of `bg-[var(--bg-primary)]/95` — black gives better contrast with backdrop-blur
- **Epoch links → Solscan**: Changed from `solanacompass.com/epochs/{epoch}` to `solscan.io/epoch/{epoch}` — Solscan has richer epoch detail pages
- **Analytics card layout**: Hero metric (large font) + context line + progress bars + stacked distribution bars. Replaces old grid-of-small-numbers layout.
- **Context descriptions everywhere**: Every section/card has a descriptive subtitle explaining what the data means. Onboarding-friendly.
- **No epoch selector on failures**: Programs table compares vs current epoch's network-wide rate only. User found epoch navigation overcomplicated.
- **Interactive fee-by-position**: Click bar to select section → summary panel with avg priority, Jito tip, total fees, avg CU, success rate, top programs as pill badges. Click again to deselect.
- **Explorer card alignment**: `flex flex-col` + `mt-auto` pushes stacked bars to card bottom regardless of content height above.
- **Failures volume chart removed**: Raw failure volume per epoch was "not interesting" — rate trends are more actionable.
- **Failures composition chart removed**: Category composition per block group was too granular to be useful.

## Project Structure

- `src/App.tsx` (~4824 lines) — All UI components + 4 page wrappers in one file
- `src/hooks/useSolanaData.ts` (~1900 lines) — All data fetching hooks + IndexedDB
- `src/index.css` — CSS variables, animations, utility classes
- `src/main.tsx` — Entry point with React Error Boundary + HashRouter

## Key Architecture

### Routing (react-router-dom v7)
4 pages via HashRouter:
| Path | Page | Contents |
|------|------|----------|
| `/` | DashboardPage | Overview, Epoch Progress, EpochSummaryCards (4 cards), Validators & Network, Supply, Leader Rotation, Limits |
| `/explorer` | ExplorerPage | EpochDetailedAnalytics (fees/CU), Real-time Analytics (redesigned), Block Deep Dive (interactive fee-by-position chart) |
| `/failures` | FailuresPage | Hero stats strip, Failure Rate by Epoch chart, Failing Programs (vs current epoch), 3-col insights (CU Waste/Block Position/Error Types), Cost of Failures, Session Trend, Top Wallets (collapsible) |
| `/validators` | ValidatorsPage | Validator table (with health scores, skip rate, search), Geographic Distribution |

### RPC Strategy
- **Helius** is PRIMARY (premium plan): RPC + Enhanced TX API + Priority Fee API
- **Alchemy** is FALLBACK: automatic per-call failover when Helius fails
- Connection management: `getConnection()` returns Helius, `getFallbackConnection()` returns Alchemy
- API keys are hardcoded in `useSolanaData.ts` (not env vars)

### External APIs
| API | Endpoint | Usage |
|-----|----------|-------|
| Helius Enhanced TX | `POST api.helius.xyz/v0/transactions?api-key=KEY` | TX type/source enrichment (max 100 sigs) |
| Helius Priority Fees | JSON-RPC `getPriorityFeeEstimate` | Fee percentiles with `includeAllPriorityFeeLevels` |
| Stakewiz | `GET api.stakewiz.com/validators` | Validator logos (`image` field), names, `ip_city`/`ip_country` |
| Solana Compass | `GET solanacompass.com/api/epoch-performance/{epoch}?limit=1` | Historical epoch stats |

### Nav Structure
Desktop: horizontal NavLink bar in header (4 items) + "by xAryes"
Mobile: fixed bottom NavLink bar (4 items)
Footer: credits line (Helius, refresh rate, Solana Compass) + X icon — all on one row
Active state via react-router `isActive` — no scroll spy

### Component Map
| Component | Page | Props |
|-----------|------|-------|
| DashboardPage | `/` | stats, supply, validators, inflation, cluster, production, leaderSchedule, getValidatorName, getValidatorMetadata, networkHistory |
| ExplorerPage | `/explorer` | blocks, transactions, getValidatorName, networkHistory |
| FailuresPage | `/failures` | blocks, networkHistory, failureAccumulation |
| ValidatorsPage | `/validators` | topValidators, getValidatorName, getValidatorMetadata, production, validatorLocations, currentSlot |
| EpochSummaryCards | Dashboard | data (NetworkHistoryData) — 4 summary cards with mini bar charts |
| EpochDetailedAnalytics | Explorer | data (NetworkHistoryData) — Fee Breakdown, CU Efficiency |
| LeaderSchedulePanel | Dashboard | leaderSchedule, currentSlot, getValidatorName, getValidatorMetadata |
| ValidatorGeography | Validators | validatorLocations (from useValidatorLocations) |

### Module-Level Helpers (near CU_CATEGORIES)
- `formatSOL(lamports)` — SOL display with precision ranges + lamports fallback for tiny values
- `formatCompact(num)` — human-readable large numbers (k/M/B)
- `getTrend(values[])` — epoch-over-epoch trend direction + percentage
- `TrendBadge` — React component for trend display with color coding
- `computeHealthScore(v, production, currentSlot)` — weighted 0-100 validator health score
- `HealthGauge` — SVG ring component for health display

## Critical Patterns

### Hooks Rules
- All `useMemo`/`useEffect`/`useState` calls MUST be before any early `return` in components
- Violation causes: "Rendered more hooks than during the previous render" crash
- This was a real bug in `BlockDeepDive` — `chartSummary` useMemo was after an early return

### Failure Accumulation
- Refs (processedSlotsRef, accProgramFailuresRef, accErrorTypesRef, accFailureSnapshotsRef, accTotalFailedRef, etc.) live in App(), NOT in FailedTransactionsAnalysis
- `FailureAccumulation` type includes: programRates, topPayers, errorTypes, snapshots, totalFailed, totalBlocks, totalTxs, sessionStart
- Error types parsed from `tx.errorMsg` JSON (InstructionError[1] → error name, or top-level key)
- Snapshots: throttled to 1/sec, max 120 (~4 min), used for Session Failure Trend SVG area chart
- Data passed to FailuresPage as `failureAccumulation` prop
- Session-only accumulation (24h historical comparison removed)
- This ensures failure data persists when navigating away from /failures

### Leader Schedule
- `useLeaderSchedule` fetches once on mount + every 5 min (NOT on every slot change)
- Uses a ref to cache the raw schedule, recomputes upcoming leaders cheaply on `[currentSlot]`
- Tracks consecutive blocks by same leader (xN bubble counter)
- Previous bug: `[currentSlot]` dependency on the fetch effect caused 432K-entry RPC call every 2s → browser crash

### Block Fetching
- Uses `connection.getBlock()` with `json` encoding (~5MB/block), NOT raw fetch with `jsonParsed` (~8.5MB)
- Parallel via `Promise.all` with per-block Alchemy fallback
- Program extraction: `programIdIndex` lookups from `msg.instructions` + `meta.innerInstructions` (CPI)
- Account keys: handle both legacy (`accountKeys`) and v0 (`staticAccountKeys` + `loadedAddresses`)

### Styling
- CSS vars: `--accent` (purple), `--accent-secondary` (blue), `--accent-tertiary` (green), `--success`, `--error`, `--warning`
- CSS-based charts only — no external chart library
- `CU_CATEGORIES` constant for compute unit categorization
- `CATEGORY_COLORS` for transaction type color coding
- Frosted glass header: `backdrop-blur-xl` + `saturate(180%)`

## Removed Components (don't recreate)
- `LiveTransactionStream` — low value, just scrolling signature hashes
- `TopProgramsSection` — was unused, program data shown in analytics instead
- Standalone `CUDistribution` — merged into compact AnalyticsSection
- Standalone block performance section — merged into BlockDeepDive
- `NetworkHealthSection` — removed during multi-page refactor, health data in overview stats
- Recent Failed TXs card — removed, was low value + wasted Helius API calls
- `EnhancedEpochAnalytics` — split into `EpochSummaryCards` + `EpochDetailedAnalytics`
- Hero leader card + timeline — replaced with clean row layout
- `ValidatorHealthSection` cards grid — removed, health shown in table column only
- Session vs 24h failure rate chart — removed, user preferred session-only
- TX detail sections (signature, programs, balance changes, instructions, logs) — removed from selected TX panel
- Epoch History Table — removed from Explorer
- Epoch selector on failures programs table — removed, simplified to current epoch comparison only
- "Failed Transactions by Epoch (volume)" bar chart — removed, rate trends more useful than raw counts
- "Failure Composition by category per block group" stacked chart — removed, too granular
- `blockComposition` tracking in analysis useMemo — removed with composition chart
- `selectedEpochIdx` state + `epochCorrelation` useMemo — removed with epoch selector

## Build & Deploy
```bash
bun install        # install deps
bun run dev        # dev server (Vite)
bun run build      # production build (tsc + vite build)
```
- Vercel auto-deploys from `main` branch
- Bundle is ~698KB (over 500KB warning threshold but acceptable)
