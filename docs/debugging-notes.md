# Debugging Notes

## Black Screen / Browser Tab Crash (2026-02-05)

### Symptoms
- Dashboard loads fine for 3-5 seconds, then page goes completely black
- Browser tab becomes unresponsive
- No error in console (tab crashes before errors can display)
- `--bg-primary: #000000` means unmounted React tree = black page

### Root Cause
`useLeaderSchedule` in `src/hooks/useSolanaData.ts` had `[currentSlot]` as its `useEffect` dependency. Since `useNetworkStats` updates `currentSlot` every 2 seconds via `getSlot()`, this triggered `connection.getLeaderSchedule()` every 2 seconds.

`getLeaderSchedule()` returns the entire epoch's leader schedule: ~432,000 slot entries for ~1,500 validators. Each response is several megabytes of JSON. Firing this every 2s caused:
- Accumulated JSON responses exhausting browser memory
- Main thread blocked parsing multi-MB JSON
- Helius rate limiting (429 errors)
- Browser tab crash → React unmounts → black page

### Fix
Split into two effects:
1. **Fetch effect** (`[]` deps) — calls `getLeaderSchedule()` once on mount, then every 5 minutes
2. **Compute effect** (`[currentSlot]` deps) — recomputes upcoming 20 leaders from cached data (pure computation, no RPC)

Raw schedule stored in a `useRef` to avoid triggering re-renders on cache update.

### Gotcha
The 30-second `setInterval` in the original code was fine — the problem was `[currentSlot]` dependency causing the entire effect (including the initial fetch) to re-run, which created a new interval AND immediately fetched again.

---

## "Rendered more hooks than during the previous render" (2026-02-05)

### Symptoms
- React error: "Rendered more hooks than during the previous render"
- Stack trace: `updateWorkInProgressHook` → `updateMemo` → `BlockDeepDive`
- Error Boundary catches it and shows error page

### Root Cause
In `BlockDeepDive` component (`src/App.tsx:2083`), a `useMemo` (`chartSummary`) was placed **after** a conditional early return:

```
useState (×6) → useRef → useMemo → useEffect → useMemo → EARLY RETURN → useMemo (BUG)
```

On first render, `selectedBlock` is null → early return fires → React sees 5 hooks.
On next render, blocks load → no early return → React sees 6 hooks → crash.

### Fix
Moved `chartSummary` useMemo above the early return. Added null guard inside the memo body (`if (!txsForChart.length) return null`).

### Gotcha
ESLint's `react-hooks/rules-of-hooks` rule doesn't always catch this pattern. Manual review of hook order vs conditional returns is necessary.

---

## Block Fetching: jsonParsed vs json Encoding (2026-02-05)

### Symptoms
- Blocks never load, `blocks` stays `[]`
- Network tab shows 8.5MB responses per block request
- Browser struggles to parse 34MB of JSON (4 blocks × 8.5MB)

### Root Cause
Raw `fetch()` with `encoding: 'jsonParsed'` produces significantly larger responses than `connection.getBlock()` with default `json` encoding (~5.3MB). The jsonParsed format includes fully parsed instruction data with human-readable account names, which we don't need.

### Fix
Switch to `connection.getBlock()` from `@solana/web3.js` with parallel `Promise.all`. Extract programs via `programIdIndex` lookups instead of relying on parsed `programId` fields.

### Gotcha
Account keys differ between legacy and v0 transactions:
- Legacy: `message.accountKeys` (array of PublicKey objects)
- V0: `message.staticAccountKeys` + `meta.loadedAddresses` (writable + readonly)

Must handle both with `toBase58()` for PublicKey objects and passthrough for strings.
