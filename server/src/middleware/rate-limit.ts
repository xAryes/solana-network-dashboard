import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

// Trust proxy headers (Railway, Render, Cloudflare all set X-Forwarded-For)
// This ensures rate limiting is per real client IP, not per proxy IP
export const trustProxy = 'loopback, linklocal, uniquelocal';

// General RPC: 600 req/min per IP (app is high-frequency: slots, blocks, leaders)
export const rpcLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many RPC requests, try again later' },
});

// Enhanced TX / heavy endpoints: 30 req/min per IP
export const heavyLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many requests to this endpoint, try again later' },
});

// Cacheable GET endpoints: 120 req/min per IP
export const getLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many requests, try again later' },
});

// Global rate limit — hard ceiling per IP across all routes (1200 req/min)
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

// Extract real client IP from proxy headers
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Abuse detection — track IPs that repeatedly hit rate limits
const abuseTracker = new Map<string, { hits: number; firstSeen: number; blocked: boolean }>();
const ABUSE_THRESHOLD = 5;       // rate limit hits before blocking
const ABUSE_WINDOW = 5 * 60_000; // 5 minutes
const BLOCK_DURATION = 15 * 60_000; // 15 min block

export function abuseDetection(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = abuseTracker.get(ip);
  if (record) {
    // Check if block expired
    if (record.blocked && now - record.firstSeen > BLOCK_DURATION) {
      abuseTracker.delete(ip);
    } else if (record.blocked) {
      res.status(429).json({ error: 'Temporarily blocked due to abuse. Try again later.' });
      return;
    }
  }

  // Clean up old entries every ~100 requests
  if (Math.random() < 0.01) {
    for (const [k, v] of abuseTracker) {
      if (now - v.firstSeen > BLOCK_DURATION) abuseTracker.delete(k);
    }
  }

  next();
}

// Called when a rate limit is hit — tracks repeat offenders
export function onRateLimitHit(ip: string): void {
  const now = Date.now();
  const record = abuseTracker.get(ip) || { hits: 0, firstSeen: now, blocked: false };

  if (now - record.firstSeen > ABUSE_WINDOW) {
    record.hits = 1;
    record.firstSeen = now;
  } else {
    record.hits++;
  }

  if (record.hits >= ABUSE_THRESHOLD) {
    record.blocked = true;
    console.warn(`[ABUSE] Blocked IP ${ip} after ${record.hits} rate limit violations`);
  }

  abuseTracker.set(ip, record);
}
