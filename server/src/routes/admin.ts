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
import {
  approveWinner,
  canTransition,
  closeVoting,
  create,
  findCurrent,
  isRoundPhase,
  listTiebreakEntries,
  setPhase,
  toApiRound,
} from '../repo/rounds.js';
import {
  findById as findSubmission,
  listForRound,
  review,
  toApiSubmission,
  REVIEW_DECISIONS,
  type ReviewDecision,
} from '../repo/submissions.js';
import { findByOsuId } from '../repo/users.js';
import { announceBallotClosed, announcePhase, announceWinner } from '../services/discord.js';
import { listForRound as listVotes, toApiVoteAudit } from '../repo/votes.js';
import {
  qualifies,
  toApiChallengeScore,
  upsert as upsertScore,
} from '../repo/challengeScores.js';

const router = Router();

router.use(requireAdmin);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Defaults match the day inputs already shown in AdminDashboard's Round Control. */
const DEFAULT_DAYS = { submission: 7, voting: 3, challenge: 21 } as const;

/** The challenge prize when a round is opened without one named. */
const DEFAULT_REWARD = 'One month of osu!supporter';

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

    // Forward, or terminal. canTransition explains why in repo/rounds.ts.
    if (!canTransition(open.phase, phase)) {
      res.status(409).json({
        error: `A round cannot move from the ${open.phase} phase to the ${phase} phase`,
      });
      return;
    }

    const updated = await setPhase(open.id, phase, ends);
    if (!updated) {
      res.status(409).json({ error: 'Round no longer exists' });
      return;
    }
    // Only when the phase actually moved: this endpoint is also how a deadline gets
    // rewritten, and canTransition allows from === to for exactly that reason.
    if (updated.phase !== open.phase) announcePhase(updated, updated.phase, false);
    res.json({ ok: true, round: toApiRound(updated) });
  } catch (err) {
    fail(res, err, 'phase update');
  }
});

// POST /api/admin/round/close-voting — end the ballot and record the outcome.
//
// The only way voting ends by hand. It does not advance the phase: the round stays
// in 'voting' with a winner pending, or tied, until POST /round/winner approves one.
// Everything is computed and frozen in one transaction — see repo/rounds.ts.
router.post('/round/close-voting', async (req, res) => {
  try {
    const open = await findCurrent();
    if (!open) {
      res.status(409).json({ error: 'No round is open' });
      return;
    }

    const outcome = await closeVoting(open.id);
    if (!outcome.ok) {
      const message =
        outcome.reason === 'not-voting'
          ? `This round is in the ${open.phase} phase, so there is no ballot to close`
          : outcome.reason === 'already-closed'
            ? 'Voting is already closed for this round'
            : 'Nothing was approved for voting, so there is no winner to record';
      res.status(409).json({ error: message });
      return;
    }

    announceBallotClosed(outcome.round, {
      tied: outcome.tied,
      votes: outcome.round.winner_vote_count,
      total: outcome.round.total_votes,
    });
    res.json({ ok: true, round: toApiRound(outcome.round), tied: outcome.tied });
  } catch (err) {
    fail(res, err, 'close voting');
  }
});

// POST /api/admin/round/winner — approve the winner and start the challenge.
//
// Body: { submissionId? }, required only when the round closed tied. This is the
// only path from voting to challenge; NEXT_PHASES does not offer that transition, so
// PATCH /round/phase cannot be used to skip this step.
router.post('/round/winner', async (req, res) => {
  const { submissionId } = (req.body ?? {}) as { submissionId?: unknown };
  let chosen: number | undefined;
  if (submissionId !== undefined) {
    const id = typeof submissionId === 'number' ? submissionId : Number(submissionId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'submissionId must be a submission id' });
      return;
    }
    chosen = id;
  }

  try {
    const open = await findCurrent();
    if (!open) {
      res.status(409).json({ error: 'No round is open' });
      return;
    }

    const admin = req.user;
    if (!admin) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const outcome = await approveWinner(open.id, admin.id, chosen);
    if (!outcome.ok) {
      const message =
        outcome.reason === 'not-closed'
          ? 'Close voting first — there is no winner to approve yet'
          : outcome.reason === 'already-official'
            ? 'This round already has an approved winner'
            : outcome.reason === 'needs-selection'
              ? 'This round is tied, so name which submission won'
              : 'That submission is not one of the entries you may choose from';
      res.status(409).json({ error: message });
      return;
    }

    // Named rather than numbered: an announcement that says submission #7 won tells a
    // reader nothing. A winner that has since been deleted announces without a name.
    const entry =
      outcome.round.winning_submission_id === null
        ? null
        : await findSubmission(outcome.round.winning_submission_id);
    announceWinner(outcome.round, entry);

    res.json({ ok: true, round: toApiRound(outcome.round) });
  } catch (err) {
    fail(res, err, 'approve winner');
  }
});

// GET /api/admin/round/tiebreak — the entries a tied round may be resolved to.
router.get('/round/tiebreak', async (_req, res) => {
  try {
    const open = await findCurrent();
    if (!open) {
      res.json([]);
      return;
    }
    res.json(await listTiebreakEntries(open.id));
  } catch (err) {
    fail(res, err, 'tiebreak list');
  }
});

// GET /api/admin/votes?roundId= — who voted for what.
//
// The only endpoint anywhere that pairs a voter with their choice. It is behind
// requireAdmin like everything in this file, and exists for investigating a dispute:
// docs/todo.txt B11 keeps ballot secrecy for everyone else, and no public route gains
// voter identity because of this one.
router.get('/votes', async (req, res) => {
  const raw = req.query.roundId;
  let roundId: number;

  if (raw === undefined) {
    const open = await findCurrent().catch(() => null);
    if (!open) {
      res.json([]);
      return;
    }
    roundId = open.id;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    roundId = Number(raw);
  } else {
    res.status(400).json({ error: 'roundId must be a positive integer' });
    return;
  }

  try {
    const rows = await listVotes(roundId);
    res.json(rows.map(toApiVoteAudit));
  } catch (err) {
    fail(res, err, 'vote audit');
  }
});

// POST /api/admin/challenge/scores — record or override a challenge score by hand.
//
// The manual half of the decision that scores are BOTH fetched automatically and
// enterable by an administrator: for a play the osu! API will not give up, or a
// correction. osu_score_id is deliberately left null on this path — the column exists
// to mark API-imported plays, and its UNIQUE constraint is what stops a hand-entered
// score from ever colliding with an imported one.
//
// The player is named by osu! id, which is what an administrator can read off a
// profile. They must have signed in at least once, because challenge_scores.user_id is
// a foreign key to a real account.
router.post('/challenge/scores', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const osuId = Number(body.osuId);
  if (!Number.isInteger(osuId) || osuId <= 0) {
    res.status(400).json({ error: 'osuId must be the player osu! id' });
    return;
  }

  const score = Number(body.score);
  const accuracy = Number(body.accuracy);
  const misses = Number(body.misses);
  if (!Number.isInteger(score) || score < 0) {
    res.status(400).json({ error: 'score must be a non-negative integer' });
    return;
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    res.status(400).json({ error: 'accuracy must be a percentage between 0 and 100' });
    return;
  }
  if (!Number.isInteger(misses) || misses < 0) {
    res.status(400).json({ error: 'misses must be a non-negative integer' });
    return;
  }

  const mods =
    body.mods === undefined || body.mods === null || body.mods === '' ? 'NM' : body.mods;
  if (typeof mods !== 'string' || mods.length > 16) {
    res.status(400).json({ error: 'mods must be joined acronyms, at most 16 characters' });
    return;
  }

  try {
    const open = await findCurrent();
    if (!open) {
      res.status(409).json({ error: 'No round is open' });
      return;
    }
    if (open.winning_submission_id === null) {
      res.status(409).json({ error: 'This round has no recorded winner to judge a score against' });
      return;
    }

    const winner = await findSubmission(open.winning_submission_id);
    if (!winner) {
      res.status(409).json({ error: 'The recorded winning entry no longer exists' });
      return;
    }

    const player = await findByOsuId(osuId);
    if (!player) {
      res.status(404).json({
        error: 'No account with that osu! id has signed in to osu!DZ, so a score cannot be attributed to it',
      });
      return;
    }

    const row = await upsertScore({
      roundId: open.id,
      userId: player.id,
      score,
      accuracy: Math.round(accuracy * 100) / 100,
      misses,
      mods,
      qualified: qualifies(
        { mods, misses },
        {
          modRequirement: winner.mod_requirement,
          challengeRequirement: winner.challenge_requirement,
        }
      ),
      osuScoreId: null,
    });

    res.json({ ok: true, score: toApiChallengeScore(row, 0) });
  } catch (err) {
    fail(res, err, 'record score');
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

  // The bounty IS the challenge prize, and it has a default rather than being blank:
  // a round with no prize on screen reads as a round with no prize. An administrator
  // can still set anything here when opening the round.
  const reward =
    body.reward === undefined || body.reward === null || body.reward === ''
      ? DEFAULT_REWARD
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
