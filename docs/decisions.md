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
