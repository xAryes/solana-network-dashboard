import type { Request, Response, NextFunction } from 'express';

// Request logging — logs method, path, status, response time, client IP
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const ip = getIp(req);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const path = req.originalUrl || req.url;

    // Color-code by status
    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    // Log RPC method for POST /api/rpc
    const rpcMethod = method === 'POST' && path === '/api/rpc' ? ` [${req.body?.method || '?'}]` : '';

    console.log(
      `${statusColor}${status}${reset} ${method} ${path}${rpcMethod} ${duration}ms — ${ip}`
    );

    // Warn on slow requests
    if (duration > 5000) {
      console.warn(`[SLOW] ${method} ${path} took ${duration}ms from ${ip}`);
    }
  });

  next();
}

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}
