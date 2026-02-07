import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/security.js';
import { globalLimiter, abuseDetection, trustProxy } from './middleware/rate-limit.js';
import { requestLogger } from './middleware/logger.js';
import rpcRouter from './routes/rpc.js';
import enhancedTxRouter from './routes/enhanced-tx.js';
import priorityFeesRouter from './routes/priority-fees.js';
import validatorsRouter from './routes/validators.js';
import epochsRouter from './routes/epochs.js';
import pricesRouter from './routes/prices.js';
import { prewarmEpochCache } from './routes/epochs.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Trust proxy for correct client IP behind Railway/Render/Cloudflare
app.set('trust proxy', trustProxy);

// Global middleware (order matters)
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(abuseDetection);
app.use(globalLimiter);

// Health check (no rate limit)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// API routes
app.use('/api/rpc', rpcRouter);
app.use('/api/enhanced-tx', enhancedTxRouter);
app.use('/api/priority-fees', priorityFeesRouter);
app.use('/api/validators', validatorsRouter);
app.use('/api/epochs', epochsRouter);
app.use('/api/prices', pricesRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`solwatch-proxy listening on port ${PORT}`);
  console.log(`CORS origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:5173'}`);

  // Pre-warm epoch cache in background after server starts
  prewarmEpochCache().catch(err => console.warn('Epoch cache prewarm failed:', err));
});
