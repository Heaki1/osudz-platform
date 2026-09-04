// Admin endpoints.
//
// router.use(requireAdmin) gates every route in this file, including the ones
// still stubbed — an admin route can never be added here and accidentally ship
// open. Admin status comes from ADMIN_OSU_IDS and is re-derived on each login
// (see repo/users.ts), so granting or revoking it is an env change plus a
// re-login, not a manual UPDATE.

import { Router } from 'express';
import type { Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { create, findCurrent, isRoundPhase, setPhase, toApiRound } from '../repo/rounds.js';
import {
  listForRound,
  review,
  toApiSubmission,
  REVIEW_DECISIONS,
  type ReviewDecision,
} from '../repo/submissions.js';

const router = Router();

router.use(requireAdmin);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Defaults match the day inputs already shown in AdminDashboard's Round Control. */
const DEFAULT_DAYS = { submission: 7, voting: 3, challenge: 21 } as const;

function fail(res: Response, err: unknown, where: string): void {
  console.error(`[admin] ${where} failed:`, err instanceof Error ? err.message : err);
  res.status(503).json({ error: 'Database unavailable' });
}

/** Returns the day count, or null if the caller sent something unusable. */
function readDays(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : null;
}

// PATCH /api/admin/round/phase — move the open round to another phase.
//
// Body: { phase, endsAt? }. `endsAt` (ISO 8601, or null to clear) rewrites the
// scheduled end of the phase being entered; omit it to keep the schedule set when
// the round was created. Setting phase to 'ended' closes the round — the next one
// is a separate POST /api/admin/rounds.
router.patch('/round/phase', async (req, res) => {
  const { phase, endsAt } = (req.body ?? {}) as { phase?: unknown; endsAt?: unknown };

  if (!isRoundPhase(phase)) {
    res.status(400).json({
      error: "phase must be one of 'submission', 'voting', 'challenge', 'ended'",
    });
    return;
  }

  let ends: Date | null | undefined;
  if (endsAt !== undefined) {
    if (endsAt === null) {
      ends = null;
    } else if (typeof endsAt === 'string' && !Number.isNaN(Date.parse(endsAt))) {
      ends = new Date(endsAt);
    } else {
      res.status(400).json({ error: 'endsAt must be an ISO 8601 timestamp or null' });
      return;
    }
  }

  try {
    const open = await findCurrent();
    if (!open) {
      res.status(409).json({ error: 'No round is open — create one first' });
      return;
    }

    const updated = await setPhase(open.id, phase, ends);
    if (!updated) {
      res.status(409).json({ error: 'Round no longer exists' });
      return;
    }
    res.json({ ok: true, round: toApiRound(updated) });
  } catch (err) {
    fail(res, err, 'phase update');
  }
});

// POST /api/admin/rounds — open the next round, numbered MAX + 1.
//
// Body: all optional — { month, year, reward, submissionDays, votingDays,
// challengeDays }. month/year default to the current UTC month and year. The
// three day counts become absolute end timestamps that cascade: each phase is
// scheduled to start when the previous one closes.
//
// Rejects with 409 while a round is open, because rounds_single_open allows only
// one non-ended row.
router.post('/rounds', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const now = new Date();

  const month =
    body.month === undefined || body.month === null || body.month === ''
      ? now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
      : body.month;
  if (typeof month !== 'string' || month.trim() === '' || month.length > 32) {
    res.status(400).json({ error: 'month must be a non-empty string of at most 32 characters' });
    return;
  }

  const year =
    body.year === undefined || body.year === null || body.year === ''
      ? now.getUTCFullYear()
      : Number(body.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    res.status(400).json({ error: 'year must be an integer between 2020 and 2100' });
    return;
  }

  const reward =
    body.reward === undefined || body.reward === null || body.reward === ''
      ? null
      : String(body.reward).slice(0, 200);

  const submissionDays = readDays(body.submissionDays, DEFAULT_DAYS.submission);
  const votingDays = readDays(body.votingDays, DEFAULT_DAYS.voting);
  const challengeDays = readDays(body.challengeDays, DEFAULT_DAYS.challenge);
  if (submissionDays === null || votingDays === null || challengeDays === null) {
    res.status(400).json({
      error: 'submissionDays, votingDays and challengeDays must be integers between 1 and 365',
    });
    return;
  }

  const submissionEndsAt = new Date(now.getTime() + submissionDays * DAY_MS);
  const votingEndsAt = new Date(submissionEndsAt.getTime() + votingDays * DAY_MS);
  const challengeEndsAt = new Date(votingEndsAt.getTime() + challengeDays * DAY_MS);

  try {
    if (await findCurrent()) {
      res.status(409).json({ error: 'A round is already open — end it before opening the next' });
      return;
    }

    const row = await create({
      month: month.trim(),
      year,
      reward,
      submissionEndsAt,
      votingEndsAt,
      challengeEndsAt,
    });
    res.status(201).json(toApiRound(row));
  } catch (err) {
    // 23505 = unique_violation. Either rounds_single_open or round_number caught
    // a create that raced another one.
    if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505') {
      res.status(409).json({ error: 'A round is already open — end it before opening the next' });
      return;
    }
    fail(res, err, 'round create');
  }
});

// GET /api/admin/submissions — every submission in a round, pending included.
// Defaults to the open round; pass ?roundId= to review an earlier one.
router.get('/submissions', async (req, res) => {
  const raw = req.query.roundId;
  if (raw !== undefined && !(typeof raw === 'string' && /^\d+$/.test(raw))) {
    res.status(400).json({ error: 'roundId must be a positive integer' });
    return;
  }

  try {
    let roundId: number;
    if (typeof raw === 'string') {
      roundId = Number(raw);
    } else {
      const open = await findCurrent();
      if (!open) {
        res.json([]);
        return;
      }
      roundId = open.id;
    }

    const rows = await listForRound(roundId);
    res.json(rows.map(toApiSubmission));
  } catch (err) {
    fail(res, err, 'submission list');
  }
});

// PATCH /api/admin/submissions/:id — approve or reject.
// Only 'approved' rows reach GET /api/submissions, so this is the gate between a
// submission existing and it being votable.
router.patch('/submissions/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Submission id must be a positive integer' });
    return;
  }

  const { status } = (req.body ?? {}) as { status?: unknown };
  if (typeof status !== 'string' || !(REVIEW_DECISIONS as readonly string[]).includes(status)) {
    res.status(400).json({ error: `status must be one of ${REVIEW_DECISIONS.join(', ')}` });
    return;
  }

  // requireAdmin guarantees req.user, but the type does not know that.
  const reviewer = req.user;
  if (!reviewer) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const updated = await review(Number(req.params.id), status as ReviewDecision, reviewer.id);
    if (!updated) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    res.json({ ok: true, submission: toApiSubmission(updated) });
  } catch (err) {
    fail(res, err, 'submission review');
  }
});

export default router;
