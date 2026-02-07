import { Router } from 'express';
import type { Request, Response } from 'express';
import { heavyLimiter } from '../middleware/rate-limit.js';

const router = Router();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

// POST /api/enhanced-tx — proxy to Helius Enhanced Transaction API
router.post('/', heavyLimiter, async (req: Request, res: Response) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0 || transactions.length > 100) {
    res.status(400).json({ error: 'transactions must be an array of 1-100 signatures' });
    return;
  }

  try {
    const url = `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Enhanced TX API failed:', err);
    res.status(502).json({ error: 'Enhanced TX API unavailable' });
  }
});

export default router;
