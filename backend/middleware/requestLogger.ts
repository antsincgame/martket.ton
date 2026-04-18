import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

const SLOW_THRESHOLD_MS = 3000;

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health') return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round(durationNs / 1_000_000);
    const status = res.statusCode;
    const method = req.method;
    const path = req.originalUrl || req.path;
    const requestId = req.requestId || '-';
    const ip = req.ip || req.socket.remoteAddress || '-';
    const ua = (req.headers['user-agent'] || '-').slice(0, 120);

    const meta = { requestId, method, path, status, durationMs, ip, ua };

    if (status >= 500) {
      logger.error('[http]', JSON.stringify(meta));
    } else if (durationMs >= SLOW_THRESHOLD_MS) {
      logger.warn('[http:slow]', JSON.stringify(meta));
    } else if (status >= 400) {
      logger.warn('[http]', JSON.stringify(meta));
    } else {
      logger.info('[http]', JSON.stringify(meta));
    }
  });

  next();
}
