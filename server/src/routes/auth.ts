import { Router } from 'express';

const router = Router();

// GET /api/auth/me — returns the session user or null
router.get('/me', (_req, res) => {
  // TODO: read session cookie and return authenticated user
  res.json(null);
});

// GET /api/auth/login — redirects to osu! OAuth2 authorization endpoint
router.get('/login', (_req, res) => {
  // TODO: build osu! OAuth2 URL and redirect
  res.status(501).json({ error: 'OAuth not yet configured' });
});

// GET /api/auth/callback — osu! OAuth2 callback
router.get('/callback', (_req, res) => {
  // TODO: exchange code for token, upsert user, set session
  res.status(501).json({ error: 'OAuth not yet configured' });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  // TODO: destroy session
  res.json({ ok: true });
});

export default router;
