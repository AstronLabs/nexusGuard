import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { keeperService } from './services/keeper.service';

// Routes
import healthRoutes from './routes/health.routes';
import claimsRoutes from './routes/claims.routes';
import ipfsRoutes from './routes/ipfs.routes';
import notificationsRoutes from './routes/notifications.routes';
import poolsRoutes from './routes/pools.routes';

const app = express();

// ── Global Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);
    if (!origin || allowed.some((o) => origin.startsWith(o!))) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logging ─────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug('HTTP', `${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 50),
  });
  next();
});

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/pools', poolsRoutes);

// ── 404 handler ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested endpoint does not exist',
    statusCode: 404,
  });
});

// ── Error handler (must be last) ────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────────
const PORT = config.port;

app.listen(PORT, () => {
  logger.info('Server', `🚀 NexusGuard backend running on http://localhost:${PORT}`);
  logger.info('Server', `Environment: ${config.nodeEnv}`);
  logger.info('Server', `Stellar Network: ${config.stellar.network}`);

  // Start the keeper service
  if (config.stellar.secretKey && config.stellar.secretKey !== 'S...your_testnet_secret_key') {
    keeperService.start();
    logger.info('Server', '⏰ Keeper service started (every 15 minutes)');
  } else {
    logger.warn('Server', '⚠️  Keeper service NOT started — no Stellar secret key configured');
  }
});

export default app;
