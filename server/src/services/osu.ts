// osu! OAuth2 + API v2 client.
//
// Two kinds of token live here. The authorization-code flow produces a *user*
// token, used once at login to read the account; it is not stored. Beatmap
// lookups instead use a *client-credentials* token, which represents the
// application rather than any user, and is cached until it expires.
//
// Nothing here touches the database or Express — it is just the outbound half.

import { env } from '../env.js';

const AUTHORIZE_URL = 'https://osu.ppy.sh/oauth/authorize';
const TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const API_BASE = 'https://osu.ppy.sh/api/v2';
const SCOPES = 'identify public';

/** The subset of the osu! User object this project reads. */
export interface OsuMe {
  id: number;
  username: string;
  country_code: string;
  avatar_url?: string | null;
  /** Present on /me because the token is the user's own. Restricted accounts are refused. */
  is_restricted?: boolean | null;
  statistics?: { global_rank?: number | null } | null;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.osuClientId,
    redirect_uri: env.osuRedirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges the callback code for an access token. Throws on any non-2xx. */
export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.osuClientId,
      client_secret: env.osuClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.osuRedirectUri,
    }),
  });

  if (!res.ok) {
    // Body is logged server-side only; it can name the misconfigured field
    // (usually a redirect_uri that does not match the registered one).
    throw new Error(`osu! token exchange failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('osu! token exchange returned no access_token');
  return body.access_token;
}

export async function fetchMe(accessToken: string): Promise<OsuMe> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`osu! GET /me failed: ${res.status}`);

  const me = (await res.json()) as OsuMe;
  if (!Number.isInteger(me.id) || !me.username) {
    throw new Error('osu! GET /me returned an unexpected shape');
  }
  return me;
}

// ── Beatmap lookup (client-credentials) ──────────────────────────────────────

/** Ranked statuses a submission is allowed to use, per docs/my_plan.txt. */
export const SUBMITTABLE_STATUSES = ['ranked', 'loved', 'approved'] as const;
export type SubmittableStatus = (typeof SUBMITTABLE_STATUSES)[number];

/** Raised when the beatmap exists but is not eligible, so routes can answer 422. */
export class BeatmapRejected extends Error {}

/** Raised when osu! has no such difficulty, so routes can answer 404. */
export class BeatmapNotFound extends Error {}

/** The fields this project reads off a BeatmapExtended, flattened and validated. */
export interface OsuBeatmap {
  difficultyId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  mapStatus: SubmittableStatus;
  coverUrl: string;
  previewUrl: string;
  /** Rounded for numeric(4,2). */
  stars: number;
  /** Rounded: the API returns fractional BPM (360.3) and the column is integer. */
  bpm: number;
  lengthSeconds: number;
  cs: number | null;
  ar: number | null;
  od: number | null;
  hp: number | null;
}

let appToken: { value: string; expiresAt: number } | null = null;

/**
 * A token for the application itself. Cached with a minute of slack so a lookup
 * never races the expiry it just checked.
 */
async function getAppToken(): Promise<string> {
  if (appToken && Date.now() < appToken.expiresAt) return appToken.value;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.osuClientId,
      client_secret: env.osuClientSecret,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });

  if (!res.ok) {
    throw new Error(`osu! client_credentials grant failed: ${res.status}`);
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('osu! client_credentials returned no access_token');

  const ttlMs = Math.max(60, (body.expires_in ?? 86_400) - 60) * 1000;
  appToken = { value: body.access_token, expiresAt: Date.now() + ttlMs };
  return appToken.value;
}

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Reads one difficulty and flattens it. Throws BeatmapNotFound when osu! has no
 * such difficulty and BeatmapRejected when it exists but cannot be submitted.
 */
export async function fetchBeatmap(difficultyId: number): Promise<OsuBeatmap> {
  const res = await fetch(`${API_BASE}/beatmaps/${difficultyId}`, {
    headers: { Authorization: `Bearer ${await getAppToken()}`, Accept: 'application/json' },
  });

  if (res.status === 404) throw new BeatmapNotFound('No such beatmap difficulty');
  if (!res.ok) throw new Error(`osu! GET /beatmaps/${difficultyId} failed: ${res.status}`);

  const b = (await res.json()) as Record<string, unknown>;
  const set = (b.beatmapset ?? {}) as Record<string, unknown>;
  const covers = (set.covers ?? {}) as Record<string, unknown>;

  const status = typeof b.status === 'string' ? b.status : '';
  if (!(SUBMITTABLE_STATUSES as readonly string[]).includes(status)) {
    throw new BeatmapRejected(
      `This beatmap is ${status || 'of an unknown status'}. Only Ranked, Loved and Approved beatmaps can be submitted.`
    );
  }

  const beatmapsetId = asNumber(b.beatmapset_id);
  const stars = asNumber(b.difficulty_rating);
  const bpm = asNumber(b.bpm);
  const lengthSeconds = asNumber(b.total_length);
  const title = typeof set.title === 'string' ? set.title : '';
  const artist = typeof set.artist === 'string' ? set.artist : '';
  const mapper = typeof set.creator === 'string' ? set.creator : '';
  const difficultyName = typeof b.version === 'string' ? b.version : '';

  if (beatmapsetId === null || stars === null || bpm === null || lengthSeconds === null ||
      !title || !artist || !mapper || !difficultyName) {
    throw new Error(`osu! GET /beatmaps/${difficultyId} returned an unexpected shape`);
  }

  return {
    difficultyId,
    beatmapsetId,
    title,
    artist,
    mapper,
    difficultyName,
    mapStatus: status as SubmittableStatus,
    coverUrl: typeof covers.cover === 'string' ? covers.cover : '',
    previewUrl: typeof set.preview_url === 'string' ? set.preview_url : '',
    stars: Math.round(stars * 100) / 100,
    bpm: Math.round(bpm),
    lengthSeconds: Math.round(lengthSeconds),
    cs: asNumber(b.cs),
    ar: asNumber(b.ar),
    od: asNumber(b.accuracy),
    hp: asNumber(b.drain),
  };
}

/**
 * Pulls the difficulty id out of an osu! beatmap URL. Returns null when the link
 * names only a beatmapset, because a submission is one difficulty and picking one
 * for the user would be guessing.
 *
 * Handles: /beatmapsets/41823#osu/131891, /beatmaps/131891, /b/131891,
 * and a bare numeric id.
 */
export function parseDifficultyId(input: string): number | null {
  const text = input.trim();
  if (/^\d+$/.test(text)) return Number(text);

  const patterns = [
    /beatmapsets\/\d+#[a-z]+\/(\d+)/i,
    /beatmapsets\/\d+\/(\d+)/i,
    /\/beatmaps\/(\d+)/i,
    /\/b\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

// ── Challenge scores (client-credentials) ────────────────────────────────────
//
// A player's score on one difficulty is public data, and the application token reads
// it with no user context at all. That was verified against the live API before this
// was written — see docs/todo.txt E2 — and it is the reason nothing in this project
// stores a per-user osu! token.

/** The fields challenge_scores records, flattened out of one osu! score. */
export interface OsuScore {
  osuScoreId: number;
  score: number;
  /** A percentage, 0-100. The API reports a 0..1 fraction. */
  accuracy: number;
  misses: number;
  /** Acronyms joined ('HDHR'), or 'NM' when the play had none. */
  mods: string;
  rank: string;
  passed: boolean;
  endedAt: string | null;
}

/** Raised when the player has no score on that difficulty, so routes can answer 404. */
export class ScoreNotFound extends Error {}

/**
 * Normalises the mods array. osu! returns plain acronyms on older scores and
 * { acronym, settings } objects on newer ones, and both shapes reach this project
 * because a challenge map can have plays from either era.
 */
function readMods(raw: unknown): string {
  if (!Array.isArray(raw)) return 'NM';
  const acronyms = raw
    .map((mod) => {
      if (typeof mod === 'string') return mod;
      if (mod && typeof mod === 'object' && typeof (mod as { acronym?: unknown }).acronym === 'string') {
        return (mod as { acronym: string }).acronym;
      }
      return '';
    })
    .filter((acronym) => acronym !== '');
  return acronyms.length === 0 ? 'NM' : acronyms.join('');
}

/**
 * One player's score on one difficulty. Throws ScoreNotFound when they have never
 * set one, which osu! answers with a 404 rather than an empty body.
 */
export async function fetchUserScore(difficultyId: number, osuUserId: number): Promise<OsuScore> {
  const res = await fetch(`${API_BASE}/beatmaps/${difficultyId}/scores/users/${osuUserId}`, {
    headers: { Authorization: `Bearer ${await getAppToken()}`, Accept: 'application/json' },
  });

  if (res.status === 404) throw new ScoreNotFound('No score on this beatmap');
  if (!res.ok) {
    throw new Error(`osu! GET /beatmaps/${difficultyId}/scores/users/${osuUserId} failed: ${res.status}`);
  }

  // The endpoint wraps the score alongside its leaderboard position.
  const body = (await res.json()) as { score?: Record<string, unknown> };
  const s = (body.score ?? body) as Record<string, unknown>;

  const total = asNumber(s.total_score) ?? asNumber(s.score);
  const accuracy = asNumber(s.accuracy);
  if (total === null || accuracy === null) {
    throw new Error(`osu! returned a score with no usable total or accuracy`);
  }

  const stats = (s.statistics ?? {}) as Record<string, unknown>;
  const misses = asNumber(stats.count_miss) ?? asNumber(stats.miss) ?? 0;
  const id = asNumber(s.id);

  return {
    osuScoreId: id ?? 0,
    score: Math.round(total),
    // numeric(5,2) holds a percentage; the API's 0..1 fraction would store as 0.99.
    accuracy: Math.round(accuracy * 10_000) / 100,
    misses: Math.round(misses),
    mods: readMods(s.mods),
    rank: typeof s.rank === 'string' ? s.rank : '',
    passed: s.passed !== false,
    endedAt:
      typeof s.ended_at === 'string'
        ? s.ended_at
        : typeof s.created_at === 'string'
          ? s.created_at
          : null,
  };
}
