# Current State — sol.watch v1

## Status
First version shipped and live at solwatch.vercel.app. All commits pushed to main, auto-deployed to Vercel.

## Latest Commit
`9af5283` — "Restore full footer credits on one line with X icon"

## What Was Done This Session
1. Fixed epoch bar chart alignment (flex-col + mt-auto, pulsing current epoch indicator)
2. Simplified leader rotation to clean horizontal row + upcoming chip strip
3. Added consecutive block counter (xN bubble) and faster animations (0.2s)
4. Auto-pause blocks on TX click, trimmed TX detail panel
5. Removed 24h failure comparison (session-only now), cleaned entire prop chain
6. Added validator search input in table pagination
7. Rebranded to sol.watch (text logo, "s." favicon)
8. X icon moved to footer (centered, same line as credits)
9. Rewrote README with full architecture documentation
10. Updated Vercel URL to solwatch.vercel.app

## Remaining Tasks
- UI/UX polish — design isn't final
- Mobile experience improvements (BlockDeepDive is heavy on small screens)
- Loading timeout / "no data" states for empty sections

## v1 Baseline
Commit `9af5283` is saved as the v1 reference point. User can return to this at any time.
