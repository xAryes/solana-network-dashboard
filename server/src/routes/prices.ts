import { Router } from 'express';
import type { Request, Response } from 'express';
import { getLimiter } from '../middleware/rate-limit.js';

const router = Router();

// In-memory cache for price data (30s TTL)
let priceCache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

// Mint address → CoinGecko ID mapping
const MINT_TO_COINGECKO: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'solana',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'jupiter-exchange-solana',
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 'jito-governance-token',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'bonk',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'marinade-staked-sol',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jito-staked-sol',
};

// Reverse mapping for response
const COINGECKO_TO_MINT: Record<string, string> = {};
for (const [mint, cgId] of Object.entries(MINT_TO_COINGECKO)) {
  COINGECKO_TO_MINT[cgId] = mint;
}

// GET /api/prices?ids=mint1,mint2 — proxy to CoinGecko free API
// Returns data in Jupiter-compatible format: { data: { [mint]: { price: string } } }
router.get('/', getLimiter, async (_req: Request, res: Response) => {
  const now = Date.now();
  if (priceCache && now - priceCache.fetchedAt < CACHE_TTL) {
    res.json(priceCache.data);
    return;
  }

  try {
    const cgIds = Object.values(MINT_TO_COINGECKO).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      throw new Error(`CoinGecko returned ${upstream.status}`);
    }
    const cgData = await upstream.json() as Record<string, { usd: number; usd_24h_change: number }>;

    // Transform to Jupiter-compatible format (keyed by mint address)
    const data: Record<string, { price: string; extraInfo?: { lastSwappedPrice?: { lastJupiterSellPrice?: string }; change24h?: number } }> = {};
    for (const [cgId, priceInfo] of Object.entries(cgData)) {
      const mint = COINGECKO_TO_MINT[cgId];
      if (mint) {
        data[mint] = {
          price: String(priceInfo.usd),
          extraInfo: {
            change24h: priceInfo.usd_24h_change,
          },
        };
      }
    }

    const result = { data };
    priceCache = { data: result, fetchedAt: now };
    res.json(result);
  } catch (err) {
    console.error('CoinGecko price API failed:', err);
    if (priceCache) {
      res.json(priceCache.data);
      return;
    }
    res.status(502).json({ error: 'Price API unavailable' });
  }
});

export default router;
