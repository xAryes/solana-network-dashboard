import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Whitelist of allowed Solana JSON-RPC methods
const ALLOWED_RPC_METHODS = new Set([
  'getSlot',
  'getEpochInfo',
  'getRecentPerformanceSamples',
  'getTransactionCount',
  'getBlock',
  'getSlotLeaders',
  'getSupply',
  'getVoteAccounts',
  'getInflationRate',
  'getClusterNodes',
  'getSlotLeader',
  'getBlockProduction',
  'getRecentPrioritizationFees',
  'getLeaderSchedule',
  'getPriorityFeeEstimate',
]);

export function validateRpcMethod(req: Request, res: Response, next: NextFunction): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const method = body.method;
  if (typeof method !== 'string' || !ALLOWED_RPC_METHODS.has(method)) {
    res.status(403).json({ error: `RPC method "${method}" is not allowed` });
    return;
  }

  next();
}
