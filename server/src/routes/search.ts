// GET /api/search/beatmaps — beatmap search over the osu! API.
//
// BEHIND requireAuth, AND THAT IS A TRADE WORTH NAMING. Every call spends one request
// from the application's osu! quota, which is exactly what made the beatmap lookup
// worth limiting (routes/submissions.ts), and the limiter in this project keys on the
// account: G3 refused IP keying because an IP is shared by a household or a campus. So
// a search open to the world would either be unlimited or be limited by the wrong key.
// Requiring a session costs a visitor nothing they could act on — searching exists to
// find a map to favorite or submit, and both of those already need one.
//
// requireAuth rather than requireEligible: reading is for everybody, Algerian or not
// (docs/my_plan.txt), and a search is a read. The DZ gate belongs on the write.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { isSearchStatus, orderHits, searchBeatmapsets } from '../services/osu.js';

const router = Router();

/** The same ceiling as the beatmap lookup: both spend one osu! request per call. */
const searchLimit = rateLimit({ limit: 20, windowMs: 60_000, what: 'beatmap searches' });

router.get('/beatmaps', requireAuth, searchLimit, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const status = typeof req.query.status === 'string' ? req.query.status : 'any';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'stars';

  if (!isSearchStatus(status)) {
    res.status(400).json({ error: 'status must be ranked, loved, approved, or any' });
    return;
  }
  // Validated rather than defaulted quietly: a typo'd sort should be a 400, not a page
  // silently ordered by something the caller did not ask for.
  if (sort !== 'stars' && sort !== 'bpm') {
    res.status(400).json({ error: 'sort must be stars or bpm' });
    return;
  }

  try {
    const hits = await searchBeatmapsets(query, status);
    res.json({ results: orderHits(hits, sort === 'bpm' ? 'bpm' : 'stars') });
  } catch (err) {
    // osu! being unavailable is not this server being broken, so it answers 503 with a
    // sentence a player can act on rather than the 500 the error handler would give.
    console.error('[api] beatmap search failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'osu! search is unavailable right now. Try again shortly.' });
  }
});

export default router;
