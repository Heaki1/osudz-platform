import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRouter from './routes/auth.js';
import roundsRouter from './routes/rounds.js';
import submissionsRouter from './routes/submissions.js';
import votesRouter from './routes/votes.js';
import adminRouter from './routes/admin.js';
import challengeRouter from './routes/challenge.js';
import searchRouter from './routes/search.js';
import favoritesRouter from './routes/favorites.js';
import settingsRouter from './routes/settings.js';
import commentsRouter from './routes/comments.js';

const app = express();

/**
 * API_PORT first, then PORT.
 *
 * API_PORT is this repo's own name for it and the one server/.env.example documents. PORT is
 * what a container host injects, and it has to be honoured or the platform's health check
 * hits a port nothing is listening on. API_PORT wins because PORT is already spoken for
 * locally — vite.config.ts:35 reads it for the CLIENT on 8443, so preferring it here would
 * put both processes on one port for anyone who exports it.
 *
 * `||` rather than `??` on purpose. An environment variable that exists and is empty is how a
 * host expresses "unset", and `??` would accept that empty string, hand parseInt a '' and
 * bind a random port instead of falling through to the next name.
 */
const PORT = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10);

// One origin, with credentials. env.ts validates it and refuses to boot in production
// without it, rather than silently allowing localhost on a deployed host.
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/rounds', roundsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/challenge', challengeRouter);
app.use('/api/search', searchRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/admin', adminRouter);

// ── The built client, when it is deployed beside this server ─────────────────
//
// SINGLE ORIGIN IS NOT A PREFERENCE HERE, IT IS A REQUIREMENT. src/api/client.ts:397 calls
// the API at the relative path '/api', and session.ts:72 marks the cookie sameSite 'lax',
// which a browser will not send on a cross-site fetch. Split across two hostnames the login
// would appear to succeed and every request after it would answer 401. Serving the bundle
// from this process is what makes the one origin.
//
// LOCAL DEVELOPMENT IS UNAFFECTED. Vite serves the client on 8443 and proxies /api here, so
// the directory below does not exist, serveClient is false, and none of this runs. The
// default sits beside the compiled server — server/dist/index.js resolves ../public — which
// is also where the Dockerfile puts it.
const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../public');
const serveClient = existsSync(path.join(clientDist, 'index.html'));

if (serveClient) {
  // index: false so the static layer never answers '/' itself — the fallback below owns
  // that, and one place deciding what '/' means is easier to reason about than two.
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));

  /**
   * Every non-API GET renders the SPA.
   *
   * The /api guard is the whole point of doing this by hand rather than with a catch-all
   * route: an unknown /api path MUST keep falling through to the JSON 404 below. G2 made
   * that contract, verify-public.mjs asserts it ("an unknown path answers 404 with { error }"
   * — and it is JSON, not an Express HTML page), and answering index.html there would hand
   * the client HTML to parse as JSON. Restricted to GET for the same reason: a POST to a
   * mistyped path is a bug worth a 404, not a page.
   */
  app.use((req, res, next) => {
    if (req.method !== 'GET' || /^\/api(\/|$)/.test(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Fallbacks ────────────────────────────────────────────────────────────────
//
// Every route in this server answers { error: string } on failure, and
// src/api/client.ts's send() reads exactly that shape. Without these two the
// contract had holes at both ends: an unknown path fell through to Express's HTML
// 404, and a malformed JSON body was rejected by express.json() before any handler
// ran, so that came back as HTML too. The client then reported "Request failed
// (400)" with no idea why.

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.path}` });
});

// Four arguments, or Express treats this as ordinary middleware and never calls it.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const { type, status, statusCode } = err as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  // express.json() labels its own refusals; everything else here is unexpected.
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }

  const known = typeof status === 'number' ? status : typeof statusCode === 'number' ? statusCode : 0;
  if (known >= 400 && known < 500) {
    res.status(known).json({ error: 'Request could not be read' });
    return;
  }

  console.error('[api] unhandled error:', err instanceof Error ? err.stack ?? err.message : err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});

app.listen(PORT, () => {
  console.log(`osudz API listening on http://localhost:${PORT}`);
  // Said out loud because the two deployments differ in exactly this, and a single-origin
  // container that quietly failed to find its bundle would look like a routing bug.
  console.log(
    serveClient ? `  serving the client from ${clientDist}` : '  no client bundle — API only'
  );
});
