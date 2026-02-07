import { Router } from 'express';
import type { Request, Response } from 'express';
import { getLimiter } from '../middleware/rate-limit.js';

const router = Router();

// In-memory cache for epoch data (keyed by epoch number, 1h TTL)
const epochCache = new Map<number, { data: unknown; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Fetch a single epoch from Solana Compass and cache it
async function fetchAndCacheEpoch(epoch: number): Promise<unknown> {
  const now = Date.now();
  const cached = epochCache.get(epoch);
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const url = `https://solanacompass.com/api/epoch-performance/${epoch}`;
  const upstream = await fetch(url);
  if (!upstream.ok) {
    throw new Error(`Solana Compass returned ${upstream.status}`);
  }
  const raw = await upstream.json() as { data: Array<Record<string, unknown>>; meta?: unknown };

  // Extract only the aggregate entry (leader: null) — drops ~780 per-validator rows
  const aggregate = raw.data?.find((d: Record<string, unknown>) => d.leader === null) || raw.data?.[0];
  const filtered = { data: aggregate ? [aggregate] : [], meta: raw.meta };

  epochCache.set(epoch, { data: filtered, fetchedAt: now });

  // Evict old entries (keep max 60 epochs cached)
  if (epochCache.size > 60) {
    const oldest = [...epochCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) epochCache.delete(oldest[0]);
  }

  return filtered;
}

// GET /api/epochs/batch?epochs=922,921,920,... — fetch multiple epochs in one request
router.get('/batch', getLimiter, async (req: Request, res: Response) => {
  const epochsParam = req.query.epochs;
  if (typeof epochsParam !== 'string' || !epochsParam.trim()) {
    res.status(400).json({ error: 'epochs query parameter required (comma-separated)' });
    return;
  }

  const epochNums = epochsParam.split(',').map(e => parseInt(e.trim(), 10)).filter(e => !isNaN(e) && e >= 0);
  if (epochNums.length === 0 || epochNums.length > 60) {
    res.status(400).json({ error: 'Provide 1-60 valid epoch numbers' });
    return;
  }

  const results: Record<number, unknown> = {};
  const uncached: number[] = [];

  // Serve from cache first
  const now = Date.now();
  for (const epoch of epochNums) {
    const cached = epochCache.get(epoch);
    if (cached && now - cached.fetchedAt < CACHE_TTL) {
      results[epoch] = cached.data;
    } else {
      uncached.push(epoch);
    }
  }

  // Fetch uncached in parallel (max 10 concurrent to avoid hammering Solana Compass)
  if (uncached.length > 0) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const fetched = await Promise.allSettled(batch.map(async (epoch) => {
        const data = await fetchAndCacheEpoch(epoch);
        return { epoch, data };
      }));

      for (const result of fetched) {
        if (result.status === 'fulfilled') {
          results[result.value.epoch] = result.value.data;
        }
      }
    }
  }

  res.json({ epochs: results, cached: epochNums.length - uncached.length, fetched: uncached.length });
});

// GET /api/epochs/:epoch — single epoch (kept for backward compat)
router.get('/:epoch', getLimiter, async (req: Request<{ epoch: string }>, res: Response) => {
  const epoch = parseInt(req.params.epoch, 10);
  if (isNaN(epoch) || epoch < 0) {
    res.status(400).json({ error: 'Invalid epoch number' });
    return;
  }

  try {
    const data = await fetchAndCacheEpoch(epoch);
    res.json(data);
  } catch (err) {
    console.error(`Epoch ${epoch} API failed:`, err);
    const cached = epochCache.get(epoch);
    if (cached) {
      res.json(cached.data);
      return;
    }
    res.status(502).json({ error: 'Epoch data unavailable' });
  }
});

// Pre-warm cache on server startup — fetches last 51 epochs
export async function prewarmEpochCache(): Promise<void> {
  try {
    // Get current epoch from Helius RPC
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
    const rpcRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getEpochInfo' }),
    });
    const rpcData = await rpcRes.json() as { result?: { epoch?: number } };
    const currentEpoch = rpcData.result?.epoch;
    if (!currentEpoch) {
      console.warn('Could not determine current epoch for prewarm');
      return;
    }

    console.log(`[PREWARM] Warming epoch cache: epochs ${currentEpoch - 50} to ${currentEpoch}...`);
    const epochs = Array.from({ length: 51 }, (_, i) => currentEpoch - i);

    // Fetch in batches of 10 to avoid overwhelming Solana Compass
    const BATCH_SIZE = 10;
    let loaded = 0;
    for (let i = 0; i < epochs.length; i += BATCH_SIZE) {
      const batch = epochs.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(e => fetchAndCacheEpoch(e)));
      loaded += batch.length;
      console.log(`[PREWARM] ${loaded}/${epochs.length} epochs cached`);
    }
    console.log(`[PREWARM] Done — ${epochCache.size} epochs in cache`);
  } catch (err) {
    console.warn('[PREWARM] Failed:', err);
  }
}

export default router;
