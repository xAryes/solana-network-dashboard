import { Router } from 'express';
import type { Request, Response } from 'express';
import { rpcLimiter } from '../middleware/rate-limit.js';
import { validateRpcMethod } from '../middleware/security.js';

const router = Router();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const ALCHEMY_RPC = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// POST /api/rpc — proxy JSON-RPC to Helius (fallback Alchemy)
router.post('/', rpcLimiter, validateRpcMethod, async (req: Request, res: Response) => {
  try {
    // Try Helius first
    const heliusRes = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (heliusRes.ok) {
      const data = await heliusRes.json();
      res.json(data);
      return;
    }

    // Fallback to Alchemy
    console.warn(`Helius RPC failed (${heliusRes.status}), falling back to Alchemy`);
    const alchemyRes = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await alchemyRes.json();
    res.status(alchemyRes.status).json(data);
  } catch (err) {
    // If Helius threw, try Alchemy
    try {
      const alchemyRes = await fetch(ALCHEMY_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await alchemyRes.json();
      res.status(alchemyRes.status).json(data);
    } catch {
      console.error('Both RPC providers failed:', err);
      res.status(502).json({ error: 'All RPC providers failed' });
    }
  }
});

export default router;
