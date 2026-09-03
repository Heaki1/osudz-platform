// Read-only round endpoints. Every write lives in routes/admin.ts behind
// requireAdmin, so nothing here needs a session.

import { Router } from 'express';
import type { Response } from 'express';
import { findById, findCurrent, listAll, toApiRound } from '../repo/rounds.js';

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

// GET /api/rounds/:id — one round.
// TODO: the archive also wants the winning submission and the challenge
// leaderboard for this round. Both need data that does not exist yet (no votes
// are cast and challenge_scores is empty), so this returns round metadata only.
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
    res.json(toApiRound(row));
  } catch (err) {
    dbDown(res, err, 'get');
  }
});

export default router;
