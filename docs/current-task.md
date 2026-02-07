# Current State — sol.watch v2+

## Status
Last commit: `adadd3e` on main. **UNCOMMITTED CHANGES** (~925 insertions, 7 files modified).

## Uncommitted Changes (v3-ux features)

### 1. SidebarNav — Scroll-spy Section Navigation
- **Location**: `src/App.tsx` near line 77 (SIDEBAR_SECTIONS) + line 108 (useSidebarActiveSection) + line 142 (SidebarNav component)
- Fixed left sidebar, visible only on 2xl+ screens (hidden on smaller)
- Per-route section definitions (Dashboard: 8 sections, Explorer: 4, Failures: 6, Validators: 3)
- Scroll-spy: picks section with most visible area in viewport. Bottom-of-page detection activates last section.
- Frosted glass: `rgba(10,10,10,0.75)` + `backdrop-filter: blur(16px)` + subtle border
- Dot + label per section; active dot pulses with `sidebarPulse` keyframe animation
- Click scrolls to section via `scrollIntoView({ behavior: 'smooth' })`
- CSS in `src/index.css`: `.sidebar-nav`, `.sidebar-item`, `.sidebar-dot-active`, `sidebarPulse` keyframe
- `scroll-margin-top` increased from 60px to 80px for better offset with sticky header

### 2. NetworkHeatmap — CU Fill + Failure Rate by Hour
- **Location**: `src/App.tsx` NetworkHeatmap component (in ExplorerPage)
- 24-column heatmap (one per UTC hour) showing avg CU fill % and avg failure rate
- Data from `useBlockHeatmap` hook in `src/hooks/useSolanaData.ts:~2054`
- **IndexedDB persistence**: New `heatmap_stats` object store (DB version bumped 1→2)
  - Stores per-block stats: `{ slot, blockTime, hour, cuUsed, txCount, failedCount }`
  - `blockTime` index for time-range queries
  - 7-day rolling cleanup via `cleanupHeatmapStats()`
- Backfills from recent blocks on mount, accumulates from live blocks
- `bucketStats()` aggregates by hour: avg CU fill %, avg failure rate, sample count
- Coverage metric: % of 24 hours with >= 3 samples
- `HeatmapData` type: `{ buckets: HeatmapBucket[], loading: boolean, coverage: number }`

### 3. Per-Leader Performance Tracking
- **Location**: `src/App.tsx` App() refs at ~line 235 + validatorPerformance useMemo at ~line 348
- 4 new refs in App(): `accLeaderBlocksRef`, `accLeaderCURef`, `accLeaderTxsRef`, `accLeaderFailedRef`
- Accumulated in the same `useEffect[blocks]` that handles failure accumulation
- Exposed as `validatorPerformance` Map via useMemo (keyed by leader pubkey)
- Each entry: `{ blocks, totalCU, totalTxs, failedTxs }`
- Passed to ValidatorsPage and EpochSlotDistribution

### 4. Epoch Slot Avg Comparison
- **Location**: `src/App.tsx` EpochSlotDistribution component
- EpochSlotDistribution now receives `networkHistory` prop
- Computes `histAvgSlotsPerEpoch` from all Solana Compass epoch data
- Shows delta percentage: current epoch allocation vs historical average
- Also shows `sessionAvgCuPct` from validatorPerformance data

## Key File Changes (approximate lines)

| File | Lines | Change |
|------|-------|--------|
| `src/App.tsx` | 5680 (+580) | SidebarNav, NetworkHeatmap, leader perf refs, epoch slot comparison |
| `src/hooks/useSolanaData.ts` | 2340 (+290) | useBlockHeatmap hook, IndexedDB heatmap_stats store |
| `src/index.css` | +39 lines | Sidebar CSS, scroll-margin-top bump |
| `CLAUDE.md` | +22 lines | Updated state + new features documented |
| `docs/decisions.md` | +26 lines | New decision entries |
| `docs/architecture.md` | +9 lines | Updated component map |
| `docs/current-task.md` | rewritten | This file |

## Unfinished User Requests
1. **Block queue expansion to 8 blocks**: User asked "can we test something, not sure it would work, but make the block queue more dynamic, maybe we could show or test to show 8 blocks in the queue and the rest doesnt change" — was interrupted, never implemented
2. **RPC connection failure**: User reported "rpc fail - connection failed" — needs investigation

## Remaining Tasks
- [x] RPC connection failure — was caused by backend proxy not running (fixed: use `bun src/index.ts` not `bun run dev`)
- [ ] Commit uncommitted changes (SidebarNav, Heatmap, leader perf, epoch slot comparison)
- [ ] Deploy backend proxy (Render/Railway)
- [ ] Set VITE_API_URL on Vercel to deployed backend URL
- [ ] Rotate API keys (old keys in git history)
- [ ] Block queue: test showing 8 blocks (experimental)
- [ ] UI/UX polish — ongoing
- [ ] Mobile experience (BlockDeepDive heavy on small screens)
- [ ] Loading timeout / "no data" states

## Future Focus — Data That Needs Time to Become Relevant

These features are built and working but need sustained data accumulation before they're truly useful:

1. **NetworkHeatmap (CU fill + failure rate by hour of day)**: Component + hook built but **removed from UI** (not rendered). Needs days/weeks of IndexedDB data to show meaningful hourly patterns. Code lives in App.tsx (NetworkHeatmap component) and useSolanaData.ts (useBlockHeatmap hook). Re-enable by adding `<NetworkHeatmap data={heatmapData} />` back to ExplorerPage and passing `heatmapData` prop.

2. **Per-validator CU fill + failure rate**: Session-accumulated via `validatorPerformance` refs in App(). Only shows leaders seen during the current session — too small a sample to draw conclusions. Future: persist to IndexedDB (like heatmap), accumulate across sessions, show per-validator efficiency trends. Goal: answer "which validators produce fuller/more efficient blocks?" and "which validators have higher failure rates?"

Both features are data-hungry — they'll grow more relevant as the user spends more time on the dashboard or as persistence is extended beyond single sessions.
