// Route guards, kept together so the auth contract lives in one place.
// routes/admin.ts gates its whole router with requireAdmin; submissions and votes
// mount requireAuth, requireCanSubmit or requireCanVote per route.

import type { Request, Response, NextFunction } from 'express';
import { readSession } from '../session.js';
import { enabledSet } from '../repo/allowedCountries.js';
import { findForUser } from '../repo/participantPermissions.js';
import {
  canParticipate,
  findByOsuId,
  isEligible,
  type Capability,
  type CapabilityOverride,
  type UserRow,
} from '../repo/users.js';

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
 * requireAuth plus the COUNTRY rule alone — no per-player override.
 *
 * Used by the challenge, and only by it. The decision recorded in docs/todo.txt E2 is that
 * the challenge keeps the gate submitting and voting had before C5 split them, and that
 * gate was the country rule. So a per-player block does not currently reach the challenge.
 *
 * FLAGGED, NOT DECIDED: whether it should. An administrator blocking somebody after an
 * investigation would plausibly expect them out of the challenge too, but C5 names two
 * capabilities and neither of them is "challenge", so inventing a third here would be
 * inventing policy. See docs/todo.txt C5.
 */
export async function requireEligibleCountry(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
    res.status(403).json({ error: countryRefusal(allowed) });
    return;
  }
  next();
}

/**
 * requireAuth plus one capability, resolved through canParticipate so this gate and the
 * canSubmit / canVote flags on ApiUser are the same sentence rather than two copies.
 *
 * Two stages written flat rather than nested: both halves are async now, and handing
 * requireAuth an async callback would leave a promise nobody awaits, so a rejection inside
 * it would surface as an unhandled rejection instead of a 503.
 */
function requireCapability(capability: Capability) {
  return async function gate(req: Request, res: Response, next: NextFunction): Promise<void> {
    let authenticated = false;
    await requireAuth(req, res, () => {
      authenticated = true;
    });
    if (!authenticated) return;

    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let allowed: ReadonlySet<string>;
    let override: CapabilityOverride | null;
    try {
      [allowed, override] = await Promise.all([enabledSet(), findForUser(user.id)]);
    } catch (err) {
      console.error('[auth] eligibility read failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Database unavailable' });
      return;
    }

    if (canParticipate(capability, user, allowed, override)) {
      next();
      return;
    }

    // Which rule refused matters to the person reading it: "your country is not on the
    // list" and "an administrator restricted your account" call for different actions.
    const blocked = capability === 'submit' ? override?.can_submit : override?.can_vote;
    res.status(403).json({
      error:
        blocked === false
          ? `An administrator has restricted this account from ${capability === 'submit' ? 'submitting' : 'voting'}.`
          : countryRefusal(allowed),
    });
  };
}

/**
 * The country refusal NAMES the countries. It used to say "Algerian osu! accounts", which
 * stops being true the moment an administrator enables a second country, and a player
 * refused without being told the rule has nothing to act on.
 */
function countryRefusal(allowed: ReadonlySet<string>): string {
  const list = [...allowed].sort().join(', ');
  return list
    ? `Submitting and voting are limited to these countries: ${list}`
    : 'Submitting and voting are closed — no country is currently enabled';
}

/** The gate for entering a beatmap, and for withdrawing one. */
export const requireCanSubmit = requireCapability('submit');

/** The gate for casting a vote. Retracting one is requireAuth — see routes/votes.ts. */
export const requireCanVote = requireCapability('vote');
