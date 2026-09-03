import { Router } from 'express';

const router = Router();

// All admin routes require an admin session — add middleware here when auth is wired.

// PATCH /api/admin/round/phase — advance or set round phase
router.patch('/round/phase', (_req, res) => {
  // TODO: validate admin, update rounds.phase
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/admin/submissions — all submissions including pending
router.get('/submissions', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// PATCH /api/admin/submissions/:id — approve or reject a submission
router.patch('/submissions/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/admin/rounds — create a new round
router.post('/rounds', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
