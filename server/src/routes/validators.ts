import { Router } from 'express';
import type { Request, Response } from 'express';
import { getLimiter } from '../middleware/rate-limit.js';

const router = Router();

// In-memory cache for Stakewiz data (refreshes every 5 min)
let validatorCache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/validators — proxy to Stakewiz with caching
router.get('/', getLimiter, async (_req: Request, res: Response) => {
  const now = Date.now();
  if (validatorCache && now - validatorCache.fetchedAt < CACHE_TTL) {
    res.json(validatorCache.data);
    return;
  }

  try {
    const upstream = await fetch('https://api.stakewiz.com/validators');
    if (!upstream.ok) {
      throw new Error(`Stakewiz returned ${upstream.status}`);
    }
    const data = await upstream.json();
    validatorCache = { data, fetchedAt: now };
    res.json(data);
  } catch (err) {
    console.error('Stakewiz API failed:', err);
    // Serve stale cache if available
    if (validatorCache) {
      res.json(validatorCache.data);
      return;
    }
    res.status(502).json({ error: 'Validator API unavailable' });
  }
});

export default router;
