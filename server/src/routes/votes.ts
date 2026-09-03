import { Router } from 'express';

const router = Router();

// GET /api/votes/my — return the current user's vote for this round (auth required)
router.get('/my', (_req, res) => {
  // TODO: query votes WHERE user_id = session AND round_id = current
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/votes — cast or change vote (auth required, voting phase, one per round)
router.post('/', (_req, res) => {
  // TODO: upsert vote, enforce Algerian account eligibility
  res.status(501).json({ error: 'Not implemented' });
});

// DELETE /api/votes — retract vote (auth required, voting phase)
router.delete('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
