import { Router } from 'express';

const router = Router();

// GET /api/rounds/current — active round metadata + phase
router.get('/current', (_req, res) => {
  // TODO: query rounds table for the open round
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/rounds — all rounds (for archive)
router.get('/', (_req, res) => {
  // TODO: query rounds table ordered by round_number DESC
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/rounds/:id — single round detail (archive entry)
router.get('/:id', (_req, res) => {
  // TODO: query round + winner + leaderboard for :id
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
