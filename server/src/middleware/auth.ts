// Route guards, kept together so the auth contract lives in one place.
// routes/admin.ts gates its whole router with requireAdmin; submissions and votes
// mount requireAuth or requireEligible per route.

import type { Request, Response, NextFunction } from 'express';
import { readSession } from '../session.js';
import { findByOsuId, isEligible, type UserRow } from '../repo/users.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / requireAdmin. Absent on unauthenticated requests. */
      user?: UserRow;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const osuId = readSession(req);
  if (osuId === null) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let user: UserRow | null;
  try {
    user = await findByOsuId(osuId);
  } catch (err) {
    console.error('[auth] user lookup failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Database unavailable' });
    return;
  }

  if (!user) {
    // Signed cookie for an account that no longer exists — treat as signed out.
    res.status(401).json({ error: 'Session no longer valid' });
    return;
  }

  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user?.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

/**
 * requireAuth plus the country gate. isEligible lives in repo/users.ts so this gate
 * and the canVote flag on ApiUser cannot disagree about who may vote.
 */
export async function requireEligible(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user || !isEligible(req.user)) {
      res.status(403).json({
        error: 'Submitting and voting are limited to Algerian osu! accounts',
      });
      return;
    }
    next();
  });
}
