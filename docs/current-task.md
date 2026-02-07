# Current State — sol.watch v3

## Status
Latest commits on main include v3-ux features (SidebarNav, heatmap, leader perf, dark/light theme).

## Recent Changes

### Dark/Light Theme Toggle
- `data-theme` attribute on root div (`dark`/`light`)
- All colors via CSS custom properties — full light theme override in `[data-theme="light"]`
- Toggle button (sun/moon SVG icons) in header, persisted in localStorage (`sol-theme`)
- Light mode: white cards with subtle shadows, adapted borders/text, deeper accent colors
- Dark mode: solid dark cards (no ambient background)
- Sidebar nav, tooltips, scrollbars, skeleton loaders all theme-aware
- Readability audit: fixed peak CU indicator, filter ring highlights, sidebar hover, program row hover

### Ambient Background (removed, archived in decisions.md)
- Went through multiple iterations: gradient orbs → animated floating orbs → glass morphism → data streams
- User said "no solana weird background" — removed entirely
- Archive details in `docs/decisions.md` under "Ambient Background Removed"

### SidebarNav — Scroll-spy Section Navigation
- Fixed left sidebar, visible only on 2xl+ screens
- Per-route section definitions (Dashboard: 8, Explorer: 4, Failures: 6, Validators: 3)
- Scroll-spy with largest-visible-area algorithm
- Frosted glass styling, theme-aware (light mode override)

### NetworkHeatmap (built, not rendered)
- Component + hook built but removed from UI — needs days of IndexedDB data
- Code in App.tsx (NetworkHeatmap) and useSolanaData.ts (useBlockHeatmap)
- IndexedDB `heatmap_stats` store (DB version 2), 7-day rolling cleanup

### Per-Leader Performance Tracking
- 4 refs in App() for session-accumulated leader stats
- Exposed as `validatorPerformance` Map via useMemo
- Used in EpochSlotDistribution and ValidatorsPage

### Header Layout
- Nav truly centered via `absolute left-1/2 -translate-x-1/2`
- TPS badge matches Slot/Epoch compact pill style

## Remaining Tasks
- [ ] Deploy backend proxy (Render/Railway)
- [ ] Set VITE_API_URL on Vercel to deployed backend URL
- [ ] Rotate API keys (old keys in git history)
- [ ] Block queue: test showing 8 blocks (experimental)
- [ ] UI/UX polish — ongoing
- [ ] Mobile experience (BlockDeepDive heavy on small screens)
- [ ] Loading timeout / "no data" states

## Future Focus — Data That Needs Time

1. **NetworkHeatmap**: Built but not rendered. Re-enable by adding `<NetworkHeatmap data={heatmapData} />` to ExplorerPage.
2. **Per-validator CU fill + failure rate**: Session-only. Future: persist to IndexedDB for cross-session trends.
