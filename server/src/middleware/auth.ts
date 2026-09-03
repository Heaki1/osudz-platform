// Route guards. Nothing uses these yet — the submission, vote, and admin routes
// are still 501 stubs — but they are what those routes will mount, and having
// them here keeps the auth contract in one place.

import type { Request, Response, NextFunction } from 'express';
import { readSession } from '../session.js';
import { findByOsuId, type UserRow } from '../repo/users.js';

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
