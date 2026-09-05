// Favorites — the caller's own, both sources.
//
// docs/todo.txt A4. src/App.tsx used to flip React state, so every heart was lost on
// reload; these persist it. The osu! import that fills source 'osu' is A5 and lives here
// too, since it writes the same table.
//
// requireAuth, not a capability gate: favoriting is neither submitting nor voting, and
// my_plan.txt gives reading and browsing to everybody. A player who cannot vote can still
// keep a list of maps they like.
//
// THE SERVER LOOKS THE BEATMAP UP ITSELF rather than trusting what the client sends, the
// same rule routes/submissions.ts follows: metadata that arrives in a request body is
// metadata a crafted request can invent, and these rows are rendered as though they were
// facts about a beatmap.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { listForUser, put, remove, toApiFavorite } from '../repo/favorites.js';
import { BeatmapNotFound, fetchBeatmapAnyStatus } from '../services/osu.js';

const router = Router();

/**
 * Generous, because browsing and favoriting a handful of maps in a row is the normal way
 * to use this — but present, because every write spends one osu! request.
 */
const favoriteLimit = rateLimit({ limit: 30, windowMs: 60_000, what: 'favorite changes' });

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await listForUser(req.user!.id);
    res.json(rows.map(toApiFavorite));
  } catch (err) {
    console.error('[favorites] list failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

/** Reads the id off the path, or null when it is not a positive integer. */
function readDifficultyId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.put('/:difficultyId', requireAuth, favoriteLimit, async (req, res) => {
  const difficultyId = readDifficultyId(req.params.difficultyId);
  if (difficultyId === null) {
    res.status(400).json({ error: 'difficultyId must be a positive integer' });
    return;
  }

  try {
    // ANY status. A player may legitimately favorite a graveyard or pending map; the
    // ranked-status rule belongs to the submit path (docs/todo.txt A4).
    const beatmap = await fetchBeatmapAnyStatus(difficultyId);
    const row = await put(req.user!.id, 'dz', beatmap);
    res.json({ ok: true, favorite: toApiFavorite(row) });
  } catch (err) {
    if (err instanceof BeatmapNotFound) {
      res.status(404).json({ error: 'osu! has no beatmap with that difficulty id' });
      return;
    }
    console.error('[favorites] add failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Could not reach osu! to read that beatmap. Try again shortly.' });
  }
});

router.delete('/:difficultyId', requireAuth, favoriteLimit, async (req, res) => {
  const difficultyId = readDifficultyId(req.params.difficultyId);
  if (difficultyId === null) {
    res.status(400).json({ error: 'difficultyId must be a positive integer' });
    return;
  }

  try {
    const removed = await remove(req.user!.id, difficultyId);
    if (removed === 0) {
      res.status(404).json({ error: 'That beatmap is not in your favorites' });
      return;
    }
    res.json({ ok: true, removed });
  } catch (err) {
    console.error('[favorites] remove failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
