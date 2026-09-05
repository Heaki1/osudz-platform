// Route guards, kept together so the auth contract lives in one place.
// routes/admin.ts gates its whole router with requireAdmin; submissions and votes
// mount requireAuth or requireEligible per route.

import type { Request, Response, NextFunction } from 'express';
import { readSession } from '../session.js';
import { enabledSet } from '../repo/allowedCountries.js';
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
 * requireAuth plus the country gate. isEligible lives in repo/users.ts so this gate and
 * the canVote flag on ApiUser cannot disagree about who may vote.
 *
 * Two stages, written flat rather than nested, because the country half is async now
 * (C4 moved the countries into a table). Handing requireAuth an async callback would
 * leave a promise nobody awaits, and a rejection inside it would surface as an unhandled
 * rejection rather than a 503.
 *
 * The refusal NAMES the countries. It used to say "Algerian osu! accounts", which stops
 * being true the moment an administrator enables a second country, and a player refused
 * without being told what the rule is has nothing to act on.
 */
export async function requireEligible(req: Request, res: Response, next: NextFunction): Promise<void> {
  let authenticated = false;
  await requireAuth(req, res, () => {
    authenticated = true;
  });
  if (!authenticated) return; // requireAuth has already answered.

  let allowed: ReadonlySet<string>;
  try {
    allowed = await enabledSet();
  } catch (err) {
    console.error('[auth] country allowlist read failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Database unavailable' });
    return;
  }

  if (!req.user || !isEligible(req.user, allowed)) {
    const list = [...allowed].sort().join(', ');
    res.status(403).json({
      error: list
        ? `Submitting and voting are limited to these countries: ${list}`
        : 'Submitting and voting are closed — no country is currently enabled',
    });
    return;
  }
  next();
}
