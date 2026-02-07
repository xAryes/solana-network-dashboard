# Decision Log

## 2026-02-05: Helius as Primary RPC, Alchemy as Fallback
**Context**: Dashboard needs reliable RPC access plus enhanced APIs (transaction enrichment, priority fee percentiles).
**Decision**: Helius primary, Alchemy fallback with per-call automatic failover.
**Rationale**: Helius offers `getPriorityFeeEstimate` and Enhanced Transactions API that Alchemy doesn't have. Alchemy is a reliable fallback for standard RPC methods.
**Alternatives**: Alchemy primary (was the original setup, but lacked enhanced APIs), QuickNode (not evaluated).

## 2026-02-05: connection.getBlock() Instead of Raw Fetch
**Context**: Block data fetching was using raw `fetch()` with `jsonParsed` encoding, producing ~8.5MB responses per block.
**Decision**: Switch to `connection.getBlock()` with default `json` encoding (~5MB per block) and parallel `Promise.all`.
**Rationale**: web3.js handles deserialization efficiently, smaller payloads, built-in retry logic. The `jsonParsed` format adds overhead that wasn't needed since we extract programs via `programIdIndex` anyway.
**Alternatives**: Keep raw fetch with `json` encoding (possible but loses web3.js benefits).

## 2026-02-05: Cache Leader Schedule in Ref, Not State
**Context**: `useLeaderSchedule` was calling `getLeaderSchedule()` (432K slot entries) on every `currentSlot` change (~every 2s), crashing the browser.
**Decision**: Split into two effects — fetch raw schedule once + 5min interval (stored in ref), recompute upcoming leaders on `[currentSlot]` (cheap in-memory).
**Rationale**: Leader schedule is epoch-level data that changes every ~2-3 days. Fetching it every 2 seconds is wasteful and destructive.

## 2026-02-05: Remove LiveTransactionStream
**Context**: WebSocket-based live transaction feed showing scrolling signature hashes.
**Decision**: Remove entirely.
**Rationale**: Low information density — just signature hashes with success/fail dots. The real-time analytics section provides more useful live data. Saved component complexity and WebSocket connection overhead.

## 2026-02-05: Remove TopProgramsSection
**Context**: Standalone section showing bar chart of most active programs.
**Decision**: Remove standalone component. Program data is shown within AnalyticsSection and BlockDeepDive instead.
**Rationale**: Redundant with inline program breakdowns in other sections. Reduces nav clutter.

## 2026-02-05: Single-File App.tsx Architecture
**Context**: App.tsx has grown to ~3300 lines with all components.
**Decision**: Keep as single file for now.
**Rationale**: Simpler imports, easier to search/navigate with IDE, no circular dependency issues. Will split if it grows past ~4000 lines or if multiple developers need to work concurrently.

## 2026-02-06: Split Epoch Analytics Between Dashboard and Explorer
**Context**: EnhancedEpochAnalytics was a single large component on the Dashboard page containing 4 summary cards, fee breakdown, CU efficiency deep dive, and epoch history table — too much vertical space.
**Decision**: Split into `EpochSummaryCards` (4 summary cards with mini bar charts, stays on Dashboard) and `EpochDetailedAnalytics` (fee breakdown + CU efficiency + epoch history table, moved to Explorer).
**Rationale**: Dashboard becomes more scannable. Explorer is where power users go for deep analysis. Shared helpers (`formatSOL`, `formatCompact`, `getTrend`, `TrendBadge`) extracted to module level.
**Alternatives**: Collapsible sections (adds complexity), tabs within the section (loses at-a-glance visibility).

## 2026-02-06: Compact Leader Rotation Layout
**Context**: Leader rotation had a large hero card (14x14 avatar, glow effects, slot progress, stats grid) plus a vertical timeline of 12 upcoming leaders — massive vertical space.
**Decision**: Replace with compact inline row for current leader (8x8 avatar, name, location, 4-dot progress) and 4-column grid for upcoming leaders (tiny avatars + timing).
**Rationale**: Current Slot and Validators stats were redundant (already in header). The hero card was visually heavy relative to its information density. Grid layout shows more leaders in less space.

## 2026-02-06: Module-Level formatSOL with Precision Ranges
**Context**: `formatSOL` was inside EnhancedEpochAnalytics and used `.toFixed(2)` for all values < 1 SOL. Per-TX averages (~5000 lamports = 0.000005 SOL) displayed as "0.00".
**Decision**: Extract to module level with graduated precision: ≥0.01 → 2 decimals, ≥0.0001 → 4 decimals, below that → show as lamports (e.g., "5k L", "500 L").
**Rationale**: SOL amounts span 9+ orders of magnitude. Fixed precision loses information at the small end. Lamports fallback is intuitive for Solana users.

## 2026-02-06: Branding Moved to Header
**Context**: "Made with ♥ by xAryes" was in the footer, often below the fold.
**Decision**: Move compact "by xAryes" to header next to Mainnet badge, remove from footer.
**Rationale**: More visible, cleaner footer. Hidden on mobile to save space.

## 2026-02-06: X Icon in Footer, Not Header
**Context**: X (Twitter) link to @chainhera was initially placed in the header next to "by xAryes", then moved to header center below nav, then user requested it in the footer.
**Decision**: X icon sits in the footer on the same line as credits (Helius, refresh rate, Solana Compass). Icon only, no @chainhera text.
**Rationale**: User iterated through several positions. Footer center keeps the header clean and the icon is still accessible. No text needed — clicking the icon redirects to the profile.

## 2026-02-06: sol.watch v1 Baseline
**Context**: First complete branded release of the dashboard.
**Decision**: Tag commit `9af5283` as v1 baseline in memory. All features: 4-page routing, leader rotation with consecutive counter, validator search, epoch summary cards, session-only failure tracking, auto-pause on TX click, trimmed TX detail panel, CSS-based charts, Helius+Alchemy dual RPC, Stakewiz metadata, Solana Compass epoch data.
**Rationale**: User explicitly asked to save this as the first version to be able to return to it.

## 2026-02-06: Vercel URL Renamed to solwatch.vercel.app
**Context**: Default Vercel URL was `solana-network-dashboard.vercel.app` — too long.
**Decision**: Rename Vercel project to `solwatch` → `solwatch.vercel.app`. Updated in README and CLAUDE.md.
**Rationale**: Matches the sol.watch branding. Shorter, cleaner URL.

## 2026-02-06: Analytics Cards — Hero Metric Layout
**Context**: Fee Analysis and CU Efficiency cards used dense grids of small numbers that were hard to scan at a glance.
**Decision**: Redesign with hero metric pattern: one large number (total SOL fees / avg CU fill %) with supporting context, then progress bars and stacked distribution bars below.
**Rationale**: At-a-glance readability. The most important number is immediately visible. Stacked bars replace horizontal bar lists — more compact and more intuitive for proportion display. Fee percentiles become inline chips instead of a 5-column grid.
**Alternatives**: Keep grid layout with bigger fonts (still not scannable), use external chart library (adds bundle size).

## 2026-02-06: Error Type Tracking in Failure Accumulation
**Context**: Failures page showed program failure rates and top wallets, but not *why* transactions failed.
**Decision**: Add `accErrorTypesRef` to parse error types from `tx.errorMsg` JSON. Parse `InstructionError[1]` for the specific error name, fall back to top-level key or raw string.
**Rationale**: "Custom" (program-specific) vs runtime errors (InsufficientFundsForFee, InvalidAccountData) gives users actionable insight into failure causes.

## 2026-02-06: Session Failure Trend — SVG Area Chart
**Context**: Failure rate was shown as a single number. No visibility into whether it's improving or worsening over time.
**Decision**: Add time-series snapshots (1/sec, max 120) tracking per-batch failure rates. Render as SVG area chart with average reference line, cumulative rate, and live dot.
**Rationale**: Gives users a visual sense of failure rate trends during their session. Pure CSS/SVG, no chart library. Snapshots are cheap (just 4 numbers per entry).

## 2026-02-06: Tooltip Backgrounds → bg-black
**Context**: Tooltips used `bg-[var(--bg-primary)]/95` which resolves to semi-transparent #000000 — but with backdrop-blur, the underlying content could bleed through inconsistently depending on what's behind the tooltip.
**Decision**: Replace with `bg-black/95` (or `bg-black` without alpha) for all tooltip backgrounds across the app.
**Rationale**: Solid black gives consistent contrast and readability. Applied to epoch tooltips, TX visualization tooltips, fee-by-position tooltips, and validator health tooltips.

## 2026-02-06: Epoch Links → Solscan
**Context**: Epoch numbers in analytics linked to `solanacompass.com/epochs/{epoch}`.
**Decision**: Change to `solscan.io/epoch/{epoch}`.
**Rationale**: Solscan has richer epoch detail pages with transaction breakdowns, validator info, and fee analysis. More useful destination for users wanting to drill deeper.

## 2026-02-06: Failures Page — Remove Epoch Selector, Simplify to Current Epoch
**Context**: Programs table had ‹/› epoch navigator + epoch context strip with stats + mini bar navigator for browsing historical epochs. User found this overcomplicated.
**Decision**: Remove epoch selector entirely. "vs Epoch" column now compares each program's failure rate against the current epoch's network-wide rate only. Removed `selectedEpochIdx` state, `epochCorrelation` useMemo, and the mini epoch bar navigator.
**Rationale**: Users care about how programs compare to the *current* network baseline, not historical epochs. Simpler UI, less state, fewer lines of code.

## 2026-02-06: Failures Page — Remove Volume Chart and Composition Chart
**Context**: Two charts were added then rejected by the user: "Failure Composition by category per block group" (stacked bars showing dex/perps/core etc per batch of blocks) and "Failed Transactions by Epoch (volume)" (bar chart of absolute failure counts per epoch).
**Decision**: Remove both. The area chart showing failure *rate* by epoch is sufficient for historical context.
**Rationale**: User explicitly said both were "not interesting." Rate trends are more actionable than raw volume, and category composition per block group was too granular to be useful.

## 2026-02-06: Context Descriptions on All Sections
**Context**: Users landing on the dashboard had no explanation of what each chart/card shows.
**Decision**: Add a brief descriptive subtitle to every section header and card title across all 4 pages (16+ descriptions total).
**Rationale**: Onboarding and clarity. Each description is 1-2 sentences explaining what the data means and why it matters. Helps both new users and returning users who forgot what a metric represents.

## 2026-02-06: Interactive Fee-by-Position Chart
**Context**: Fee-by-position chart in Block Explorer was view-only with hover tooltips.
**Decision**: Make bars clickable. Clicking a bar shows a summary panel below the chart with: avg priority fee, avg Jito tip, total fees (SOL), avg CU, success rate, and top programs in that section as colored pill badges.
**Rationale**: Transforms a visual-only chart into an analytical tool. Users can see which block positions have the most MEV activity, failures, or program concentration. State resets when switching blocks.

## 2026-02-06: Explorer Card Alignment with flex-col + mt-auto
**Context**: Fee Distribution and TX Compute Distribution stacked bars in the 2-column Explorer analytics layout were misaligned vertically because the content above them differed in height.
**Decision**: Both cards use `flex flex-col`, inner content uses `flex flex-col flex-1 gap-3`, and the bottom stacked bar gets `mt-auto` to push it to the card bottom.
**Rationale**: Standard CSS flexbox pattern. Ensures bars align regardless of different content heights above them.

## 2026-02-06: Nakamoto Coefficient Line in Validators Table
**Context**: User wanted a visual indicator of the Nakamoto coefficient in the main validators table.
**Decision**: Draw a green line (`border-[var(--accent-tertiary)]/60`, 2px) across the validators table at the row where cumulative stake exceeds 33.33%. Add an annotation row below with small dot + explanation text.
**Rationale**: Makes the concentration of stake immediately visible. 33.33% is the threshold for consensus halt (supermajority is 66.67%). Computed by stake (not slots) in `nakamotoStake` useMemo.
**Alternatives**: Separate Nakamoto card (too disconnected from the data), background highlight (less visible than a line).

## 2026-02-06: HealthGauge on Leader Schedule Table
**Context**: Leader schedule table had no health indicator. User wanted "the same as the one in the validator page."
**Decision**: Add HealthGauge SVG ring (size=28) with hover tooltip showing score breakdown (skip 40%, commission 20%, liveness 20%, vote 20%) to each row in UpcomingLeadersTable.
**Rationale**: Consistent health visualization across validator-related tables. Reuses existing HealthGauge component and computeHealthScore function.

## 2026-02-06: Geography — Hex Colors, No Stacked Bar
**Context**: ValidatorGeography used CSS vars for continent colors (low contrast) and a large stacked bar showing continent distribution.
**Decision**: Replace CSS vars with direct hex colors for better contrast. Remove stacked bar entirely. Keep only clean list with small color squares + thin progress bars at 0.7 opacity. Country bars thinned to h-1.5 at 0.6 opacity.
**Rationale**: User said stacked bar was "too aggressive" and "not good looking." Direct hex colors provide consistent contrast regardless of theme. Thinner bars reduce visual weight.

## 2026-02-06: Revert Agent Changes to Health Design
**Context**: A background agent replaced HealthGauge SVG rings with progress bars in the expanded validator row and added bezier curves/gradients to the failure rate chart.
**Decision**: Revert both. Keep HealthGauge SVG rings for expanded health. Keep straight-line failure rate chart.
**Rationale**: User explicitly said the previous designs were better. SVG rings are more compact and visually distinctive than progress bars. Straight lines are cleaner than bezier curves for epoch-level data.

## 2026-02-06: formatLocation — Country Name Instead of Flag Emoji
**Context**: `formatLocation()` used flag emojis (e.g., "🇺🇸 New York") which render inconsistently across OS/browser.
**Decision**: Changed to "City, Country" text format (e.g., "New York, United States").
**Rationale**: More readable, consistent rendering, no emoji dependency.

## 2026-02-07: SidebarNav — Scroll-Spy Section Navigation
**Context**: With 4 pages and many sections per page, users on large screens had no quick way to jump between sections.
**Decision**: Add fixed left sidebar (visible only on 2xl+ screens) with per-route section definitions and scroll-spy active tracking. Frosted glass styling matching header.
**Rationale**: Improves navigation on wide screens without affecting smaller viewports. Uses largest-visible-area algorithm for active section detection. Dot + label pattern is minimal but functional.
**Alternatives**: Table of contents dropdown (less visible), sticky section headers (intrusive), no sidebar (status quo — requires scrolling).

## 2026-02-07: NetworkHeatmap — CU Fill by Hour of Day
**Context**: Users had no visibility into network activity patterns by time of day.
**Decision**: Add 24-column heatmap on Explorer page showing average CU fill % and failure rate per UTC hour. Data persisted in IndexedDB with 7-day rolling window.
**Rationale**: Time-of-day patterns reveal MEV activity windows, validator performance cycles, and congestion peaks. IndexedDB persistence means the heatmap improves over time even across page refreshes.
**Alternatives**: Line chart by hour (less intuitive for cyclical data), server-side aggregation (requires backend changes).

## 2026-02-07: Per-Leader Performance Tracking in App Refs
**Context**: Validator performance data (blocks produced, CU used, failure rate) was computed per-block but not accumulated across session.
**Decision**: Add 4 refs in App() (accLeaderBlocksRef, accLeaderCURef, accLeaderTxsRef, accLeaderFailedRef) following the same pattern as failure accumulation refs. Exposed as `validatorPerformance` Map via useMemo.
**Rationale**: Enables richer validator comparison (session avg CU fill, failure rate per leader). Same proven ref-based accumulation pattern as failure tracking. Data used in EpochSlotDistribution and ValidatorsPage.

## 2026-02-07: Epoch Slot Avg Comparison
**Context**: User requested "cumulate the number of slots since the latest epoch we have, make a total, then make an avg per epoch to compare with the current one they have attributed."
**Decision**: EpochSlotDistribution computes historical average slots per epoch from Solana Compass networkHistory data and shows delta percentage vs current epoch allocation.
**Rationale**: Directly fulfills user request. Shows whether current epoch has more or fewer slots than historical average — useful for understanding validator reward dynamics.

## 2026-02-07: Dark/Light Theme Toggle
**Context**: Dashboard was dark-only. User wanted a light mode option.
**Decision**: Add `data-theme` attribute on root div with `dark`/`light` values. All colors via CSS custom properties. Toggle button (sun/moon icons) in header. Theme persisted in localStorage (`sol-theme` key).
**Rationale**: Full theme support via CSS vars means every element adapts automatically. No external library needed.

## 2026-02-07: Ambient Background Removed (archived for reference)
**Context**: Iterated through several background designs: subtle gradient orbs → individually animated floating orbs (4 orbs with independent float paths, 60-100px blur, parallax depth) → glass morphism cards (semi-transparent rgba + backdrop-blur) → data stream streaks → noise grain + dot grid + vignette. User ultimately preferred clean solid backgrounds.
**Decision**: Remove all ambient background code. Keep clean dark/light toggle only.
**Rationale**: User explicitly said "no solana weird background." Solid backgrounds are cleaner and more professional. The ambient code was ~200 lines of CSS (keyframes for orbFloat1-4, data-stream, noiseShift, orb elements, wave lines, noise SVG, dot grid, vignette) plus JSX in App.tsx (sol-ambient div with 4 orb elements + 5 wave line elements). All removed.
**Archive**: If ever re-enabled, the approach was: 4 gradient orbs (purple 800px, green 700px, blue 500px, magenta 350px) with independent `orbFloat1-4` keyframe animations (25-40s), varying blur depths for parallax, absolute positioned in a fixed container behind content (z-0), content at z-10. Glass morphism cards used `rgba(13,13,13,0.6)` + `backdrop-filter: blur(16px)` + `saturate(130%)`.

## 2026-02-07: Light Mode Readability Audit
**Context**: After adding light theme, needed to verify all UI elements are readable on white backgrounds.
**Decision**: Audit and fix: (1) Sidebar nav — light background override, (2) sidebar item hover — dark overlay instead of white, (3) program row hover — dark inset shadow, (4) CU peak indicator — `var(--text-primary)` instead of white, (5) filter ring highlights — `var(--text-primary)` instead of white. Tooltip text/bg already used CSS vars.
**Rationale**: Hardcoded `white/40` and `rgba(255,255,255,0.04)` are invisible on white backgrounds.

## 2026-02-07: IndexedDB Version Bump (1→2)
**Context**: New `heatmap_stats` object store needed for NetworkHeatmap feature.
**Decision**: Bumped DB_VERSION from 1 to 2. Added `heatmap_stats` store with `slot` keyPath and `blockTime` index in the `onupgradeneeded` handler.
**Rationale**: Standard IndexedDB schema migration pattern. Existing `blocks` store preserved during upgrade.
