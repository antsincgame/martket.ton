import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { logger } from '../logger.js';
import * as repo from '../core/repository.js';
import type { Profile } from '../domain/types.js';

declare global {
  namespace Express {
    interface Request {
      profile?: Profile;
    }
  }
}

export async function resolveProfile(req: Request): Promise<Profile | null> {
  const auth = getAuth(req);
  if (!auth || !auth.userId) return null;
  return repo.findUserByClerkId(auth.userId);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  resolveProfile(req)
    .then((profile) => {
      if (!profile || !isAdminRole(profile.role)) {
        res.status(403).json({ success: false, message: 'Admin access required' });
        return;
      }
      req.profile = profile;
      next();
    })
    .catch((err: Error) => {
      logger.error('requireAdmin error:', err.message);
      res.status(500).json({ success: false, message: 'Internal error' });
    });
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function apiRequireAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const auth = getAuth(req);
      if (!auth || !auth.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Auth verification failed:', message);
      res.status(401).json({ success: false, message: 'Authentication failed' });
    }
  };
}
