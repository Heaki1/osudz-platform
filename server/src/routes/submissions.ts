import { Router } from 'express';

const router = Router();

// GET /api/submissions — list approved submissions for current round
router.get('/', (_req, res) => {
  // TODO: query submissions WHERE round_id = current AND status = 'approved'
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/submissions — submit a beatmap (auth required, submission phase only)
router.post('/', (_req, res) => {
  // TODO: validate phase, one submission per user per round, insert row
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/submissions/:id — single submission detail
router.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
