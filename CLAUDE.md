# Solana Network Dashboard

## Context Recovery

IMPORTANT: At session start, read all .md files in the /docs/ directory to restore full project context from the previous session.

## Current State

- **Branch**: main
- **Status**: Dashboard is live on Vercel, all major sections functional. UI polish pass completed.
- **Last updated**: 2026-02-06
- **Live URL**: https://solana-network-dashboard.vercel.app/
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
- [x] X (Twitter) profile link in header
- [ ] UI/UX polish — design isn't final, needs visual improvements
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

## Project Structure

- `src/App.tsx` (~4300 lines) — All UI components + 4 page wrappers in one file
- `src/hooks/useSolanaData.ts` (~1900 lines) — All data fetching hooks + IndexedDB
- `src/index.css` — CSS variables, animations, utility classes
- `src/main.tsx` — Entry point with React Error Boundary + HashRouter

## Key Architecture

### Routing (react-router-dom v7)
4 pages via HashRouter:
| Path | Page | Contents |
|------|------|----------|
| `/` | DashboardPage | Overview, Epoch Progress, EpochSummaryCards (4 cards), Validators & Network, Supply, Leader Rotation, Limits |
| `/explorer` | ExplorerPage | EpochDetailedAnalytics (fees/CU), Real-time Analytics, Block Deep Dive (with fee-by-position chart) |
| `/failures` | FailuresPage | Failure Overview, Cost of Failures, All Failing Programs (session-accumulated), Top Failing Wallets |
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
Desktop: horizontal NavLink bar in header (4 items) + "by xAryes" + X link
Mobile: fixed bottom NavLink bar (4 items)
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
- Refs (processedSlotsRef, accProgramFailuresRef, etc.) live in App(), NOT in FailedTransactionsAnalysis
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

## Build & Deploy
```bash
bun install        # install deps
bun run dev        # dev server (Vite)
bun run build      # production build (tsc + vite build)
```
- Vercel auto-deploys from `main` branch
- Bundle is ~698KB (over 500KB warning threshold but acceptable)
