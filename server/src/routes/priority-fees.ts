import { Router } from 'express';
import type { Request, Response } from 'express';
import { rpcLimiter } from '../middleware/rate-limit.js';

const router = Router();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// POST /api/priority-fees — proxy Helius getPriorityFeeEstimate
router.post('/', rpcLimiter, async (req: Request, res: Response) => {
  try {
    const body = {
      jsonrpc: '2.0',
      id: 'priority-fees',
      method: 'getPriorityFeeEstimate',
      params: [{ options: { includeAllPriorityFeeLevels: true } }],
    };

    const upstream = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Priority fee API failed:', err);
    res.status(502).json({ error: 'Priority fee API unavailable' });
  }
});

export default router;
