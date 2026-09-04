// Read-only round endpoints. Every write lives in routes/admin.ts behind
// requireAdmin, so nothing here needs a session.

import { Router } from 'express';
import type { Response } from 'express';
import { findById, findCurrent, listAll, toApiRound } from '../repo/rounds.js';
import { findById as findSubmission, toApiSubmission } from '../repo/submissions.js';

const router = Router();

function dbDown(res: Response, err: unknown, where: string): void {
  console.error(`[rounds] ${where} failed:`, err instanceof Error ? err.message : err);
  res.status(503).json({ error: 'Database unavailable' });
}

// GET /api/rounds/current — the open round, or null when none is running.
// Declared before /:id so "current" is never parsed as an id.
router.get('/current', async (_req, res) => {
  try {
    const row = await findCurrent();
    res.json(row ? toApiRound(row) : null);
  } catch (err) {
    dbDown(res, err, 'current');
  }
});

// GET /api/rounds — every round, newest first (the archive list).
router.get('/', async (_req, res) => {
  try {
    const rows = await listAll();
    res.json(rows.map(toApiRound));
  } catch (err) {
    dbDown(res, err, 'list');
  }
});

// GET /api/rounds/:id — one round, with the entry recorded as its winner.
//
// The winner is read by id, never recomputed from the vote table: it is the entry an
// administrator approved, and a later retraction or rejection does not move it. It
// comes back as a whole submission rather than an id because the archive shows the
// map, and would otherwise need a second request per round.
//
// winner_status says how far it has got, so the row is returned whether it is
// pending or official — the caller decides how to label it. A tied round has no
// recorded entry yet, so winner is null there.
//
// TODO: the archive also wants this round's challenge leaderboard. challenge_scores
// has no read path yet (roadmap E1), so it is absent rather than empty.
router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Round id must be a positive integer' });
    return;
  }

  try {
    const row = await findById(Number(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }

    const winner =
      row.winning_submission_id === null ? null : await findSubmission(row.winning_submission_id);

    res.json({ ...toApiRound(row), winner: winner ? toApiSubmission(winner) : null });
  } catch (err) {
    dbDown(res, err, 'get');
  }
});

export default router;
