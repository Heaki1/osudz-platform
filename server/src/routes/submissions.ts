// Submission endpoints.
//
// The client never supplies beatmap metadata. It sends a URL (or a difficulty id)
// and the server reads title, artist, stars and the rest from the osu! API — so a
// crafted request cannot invent a 1-star "ranked" map. The lookup runs twice: once
// for the preview, once again at submit time, because the preview is only a hint
// and the row must be built from a fresh read.

import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, requireEligible } from '../middleware/auth.js';
import { findCurrent } from '../repo/rounds.js';
import {
  ALLOWED_CHALLENGE_TYPES,
  ALLOWED_MODS,
  create,
  findById,
  findByUserAndRound,
  listForRound,
  toApiSubmission,
} from '../repo/submissions.js';
import {
  BeatmapNotFound,
  BeatmapRejected,
  fetchBeatmap,
  parseDifficultyId,
  type OsuBeatmap,
} from '../services/osu.js';

const router = Router();

function fail(res: Response, err: unknown, where: string): void {
  console.error(`[submissions] ${where} failed:`, err instanceof Error ? err.message : err);
  res.status(503).json({ error: 'Something went wrong reading the beatmap. Try again.' });
}

/** Turns a lookup failure into the right status instead of a blanket 503. */
function beatmapError(res: Response, err: unknown, where: string): void {
  if (err instanceof BeatmapNotFound) {
    res.status(404).json({ error: 'osu! has no beatmap difficulty with that id' });
    return;
  }
  if (err instanceof BeatmapRejected) {
    res.status(422).json({ error: err.message });
    return;
  }
  fail(res, err, where);
}

// GET /api/submissions — approved submissions for the open round.
// Returns [] rather than 404 when no round is open, so the vote page renders an
// empty state instead of an error.
router.get('/', async (_req, res) => {
  try {
    const round = await findCurrent();
    if (!round) {
      res.json([]);
      return;
    }
    const rows = await listForRound(round.id, 'approved');
    res.json(rows.map(toApiSubmission));
  } catch (err) {
    fail(res, err, 'list');
  }
});

// GET /api/submissions/mine — the caller's entry in the open round, or null.
// Separate from GET / because a pending submission is invisible there, and the
// submitter still needs to see that it is awaiting review.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const round = await findCurrent();
    if (!round || !req.user) {
      res.json(null);
      return;
    }
    const row = await findByUserAndRound(req.user.id, round.id);
    res.json(row ? toApiSubmission(row) : null);
  } catch (err) {
    fail(res, err, 'mine');
  }
});

// POST /api/submissions/lookup — resolve a pasted URL to beatmap metadata.
// Read-only: nothing is written, so this needs a session but no phase check.
router.post('/lookup', requireEligible, async (req, res) => {
  const { url } = (req.body ?? {}) as { url?: unknown };
  if (typeof url !== 'string' || url.trim() === '') {
    res.status(400).json({ error: 'Paste an osu! beatmap URL' });
    return;
  }

  const difficultyId = parseDifficultyId(url);
  if (difficultyId === null) {
    res.status(400).json({
      error:
        'That link does not name a difficulty. Open the beatmap, pick the difficulty you mean, and copy the URL again.',
    });
    return;
  }

  try {
    res.json(await fetchBeatmap(difficultyId));
  } catch (err) {
    beatmapError(res, err, 'lookup');
  }
});

// POST /api/submissions — enter a beatmap in the open round.
// Requires an eligible session, the submission phase, and no existing entry.
router.post('/', requireEligible, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const difficultyId =
    typeof body.difficultyId === 'number' || typeof body.difficultyId === 'string'
      ? parseDifficultyId(String(body.difficultyId))
      : null;
  if (difficultyId === null) {
    res.status(400).json({ error: 'difficultyId must be an osu! beatmap difficulty id' });
    return;
  }

  const { modRequirement, challengeRequirement } = body;
  if (typeof modRequirement !== 'string' || !(ALLOWED_MODS as readonly string[]).includes(modRequirement)) {
    res.status(400).json({ error: `modRequirement must be one of ${ALLOWED_MODS.join(', ')}` });
    return;
  }
  if (
    typeof challengeRequirement !== 'string' ||
    !(ALLOWED_CHALLENGE_TYPES as readonly string[]).includes(challengeRequirement)
  ) {
    res.status(400).json({
      error: `challengeRequirement must be one of ${ALLOWED_CHALLENGE_TYPES.join(', ')}`,
    });
    return;
  }

  try {
    const round = await findCurrent();
    if (!round) {
      res.status(409).json({ error: 'No round is open' });
      return;
    }
    if (round.phase !== 'submission') {
      res.status(409).json({ error: 'Submissions are closed — this round is in the ' + round.phase + ' phase' });
      return;
    }

    // requireEligible guarantees req.user, but the type does not know that.
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const existing = await findByUserAndRound(user.id, round.id);
    if (existing) {
      res.status(409).json({
        error: 'You already have a submission in this round',
        submission: toApiSubmission(existing),
      });
      return;
    }

    let beatmap: OsuBeatmap;
    try {
      beatmap = await fetchBeatmap(difficultyId);
    } catch (err) {
      beatmapError(res, err, 'submit lookup');
      return;
    }

    const row = await create({
      roundId: round.id,
      userId: user.id,
      beatmapsetId: beatmap.beatmapsetId,
      difficultyId: beatmap.difficultyId,
      title: beatmap.title,
      artist: beatmap.artist,
      mapper: beatmap.mapper,
      difficultyName: beatmap.difficultyName,
      mapStatus: beatmap.mapStatus,
      coverUrl: beatmap.coverUrl,
      previewUrl: beatmap.previewUrl,
      stars: beatmap.stars,
      bpm: beatmap.bpm,
      lengthSeconds: beatmap.lengthSeconds,
      cs: beatmap.cs,
      ar: beatmap.ar,
      od: beatmap.od,
      hp: beatmap.hp,
      modRequirement,
      challengeRequirement,
    });

    res.status(201).json(toApiSubmission(row));
  } catch (err) {
    // 23505 = unique_violation from submissions_one_per_user_per_round, if two
    // submits raced past the check above.
    if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505') {
      res.status(409).json({ error: 'You already have a submission in this round' });
      return;
    }
    fail(res, err, 'submit');
  }
});

// GET /api/submissions/:id — one submission, whatever its review status.
router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Submission id must be a positive integer' });
    return;
  }

  try {
    const row = await findById(Number(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    res.json(toApiSubmission(row));
  } catch (err) {
    fail(res, err, 'get');
  }
});

export default router;
