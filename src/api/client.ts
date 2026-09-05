// Typed API seam — all fetch calls go through here.
//
// Two return conventions, one rule. Reads resolve to `T | null`: a failed read is
// indistinguishable from "no data", and every caller has a fallback. Writes
// resolve to `ApiResult<T>` so the caller can tell success from failure and show
// the reason — silently swallowing a failed write leaves an admin clicking a
// button that does nothing.

export interface ApiUser {
  id: number;
  osuId: number;
  username: string;
  country: string;
  avatarUrl: string;
  /** osu! global rank at last login; null for unranked accounts. */
  globalRank: number | null;
  isAdmin: boolean;
  /**
   * Whether this account may submit and vote. Computed server-side from the same
   * rule requireEligible uses, so the client never re-derives eligibility from
   * `country` and cannot drift from the gate that actually refuses the write.
   */
  canVote: boolean;
}

export interface ApiRound {
  id: number;
  roundNumber: number;
  phase: "submission" | "voting" | "challenge" | "ended";
  month: string;
  year: number;
  reward: string;
  /**
   * Scheduled phase ends, ISO 8601. Null when the round was created without
   * durations. These are a schedule, not a clock: advancing a phase early leaves
   * the later ends where they were unless the admin overrides them.
   */
  submissionEndsAt: string | null;
  votingEndsAt: string | null;
  challengeEndsAt: string | null;
  /**
   * How far this round's winner has got. The phase stays 'voting' while the winner
   * is 'pending' or 'tiebreak', so this is what says whether the ballot is open.
   */
  winnerStatus: "none" | "pending" | "tiebreak" | "official";
  /** Null until the winner is determined, and while a tie is unresolved. */
  winningSubmissionId: number | null;
  /** Frozen when voting closed. On a tie, the count each tied entry reached. */
  winnerVoteCount: number | null;
  /** Votes cast in the round, frozen alongside winnerVoteCount. */
  totalVotes: number | null;
  winnerApprovedAt: string | null;
}

/**
 * A round with everything the archive shows. Served by GET /rounds and GET /rounds/:id;
 * GET /rounds/current stays lean, because every page loads that one on every render.
 */
export interface ApiRoundDetail extends ApiRound {
  /**
   * The recorded winner, pending or official — winnerStatus says which. Null when
   * nothing is recorded yet, and while a tie is unresolved.
   */
  winner: ApiSubmission | null;
  /**
   * That round's challenge scores, in the order the server ordered them for this
   * round's own challenge requirement. Never re-sort them on the client.
   */
  leaderboard: ApiChallengeScore[];
  /** Distinct people who entered, voted, or posted a challenge score in this round. */
  participants: number;
}

export type MapStatus = "ranked" | "loved" | "approved";

export interface ApiSubmission {
  id: number;
  beatmapsetId: number;
  difficultyId: number;
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  /** The beatmap's own osu! status. Distinct from reviewStatus below. */
  mapStatus: MapStatus;
  coverUrl: string;
  previewUrl: string;
  stars: number;
  bpm: number;
  /** Display string ("2:19"); the column stores seconds. */
  length: string;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  challengeRequirement: string;
  modRequirement: string;
  submittedByName: string;
  voteCount: number;
  /** Admin review state. Only 'approved' rows come back from GET /submissions. */
  reviewStatus: "pending" | "approved" | "rejected";
  submittedAt: string;
  isFavorited?: boolean;
}

/**
 * What the server reads off the osu! API for a pasted URL. Not a submission yet —
 * it has no id, and the row is built from a fresh lookup at submit time rather
 * than from this.
 */
export interface ApiBeatmapPreview {
  difficultyId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  mapStatus: MapStatus;
  coverUrl: string;
  previewUrl: string;
  stars: number;
  bpm: number;
  lengthSeconds: number;
  cs: number | null;
  ar: number | null;
  od: number | null;
  hp: number | null;
}

/**
 * One beatmap search hit.
 *
 * A hit is a beatmapSET, represented by its hardest difficulty — `difficultyCount` says
 * how many the set has, so a card can be honest about showing one of several rather
 * than implying the set is a single map.
 */
export interface ApiSearchHit {
  difficultyId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  mapStatus: MapStatus;
  coverUrl: string;
  previewUrl: string;
  stars: number;
  bpm: number;
  lengthSeconds: number;
  difficultyCount: number;
}

/**
 * One player's play on a round's winning beatmap.
 *
 * `qualified` is what the play can be judged on by itself — the required mods, and a
 * full combo where that was the requirement. The other three challenge requirements
 * are relative, so they are expressed by the order the server returns rather than by
 * this flag; see server/src/repo/challengeScores.ts.
 */
export interface ApiChallengeScore {
  /** 1-based position in the order the server returned. 0 for a single score read. */
  rank: number;
  userId: number;
  osuId: number;
  username: string;
  avatarUrl: string;
  score: number;
  /** A percentage, 0-100. */
  accuracy: number;
  misses: number;
  /** Joined acronyms ('HDHR'), or 'NM'. */
  mods: string;
  qualified: boolean;
  /** Null when an administrator entered this by hand rather than importing it. */
  osuScoreId: number | null;
  submittedAt: string;
}

/**
 * One vote with the account that cast it — GET /admin/votes only.
 *
 * Ballot secrecy is a rule, not an oversight: no public endpoint carries voter identity,
 * and this shape exists so an administrator can investigate a dispute. Do not reuse it
 * on a public surface.
 */
export interface ApiVoteAudit {
  voteId: number;
  userId: number;
  username: string;
  osuId: number;
  avatarUrl: string;
  country: string;
  submissionId: number;
  submissionTitle: string;
  submissionArtist: string;
  difficultyName: string;
  castAt: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

const BASE = "/api";

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function send<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Not every response carries JSON — 501 stubs and proxy errors may not.
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Request failed (${res.status})`;
      return { ok: false, status: res.status, error: message };
    }

    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: "Cannot reach the API — is the server running?" };
  }
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    me: () => get<ApiUser>("/auth/me"),
    loginUrl: () => `${BASE}/auth/login`,
    logout: () => send<{ ok: boolean }>("POST", "/auth/logout"),
  },

  // ── Rounds ─────────────────────────────────────────────────────────────────
  rounds: {
    /** Resolves to null both when no round is open and when the API is down. */
    current: () => get<ApiRound>("/rounds/current"),
    /** Every round, newest first, with winner, leaderboard and participants. */
    list: () => get<ApiRoundDetail[]>("/rounds"),
    /** One round, in the same shape as the list. */
    get: (id: number) => get<ApiRoundDetail>(`/rounds/${id}`),
  },

  // ── Submissions ────────────────────────────────────────────────────────────
  submissions: {
    /** Approved entries in the open round; [] when no round is open. */
    list: () => get<ApiSubmission[]>("/submissions"),
    get: (id: number) => get<ApiSubmission>(`/submissions/${id}`),
    /** The caller's own entry, pending included — GET /submissions hides it. */
    mine: () => get<ApiSubmission | null>("/submissions/mine"),
    /** Resolves a pasted osu! URL to beatmap metadata for the preview card. */
    lookup: (url: string) => send<ApiBeatmapPreview>("POST", "/submissions/lookup", { url }),
    /** Withdraws the caller's entry. Submission phase only, server-enforced. */
    withdraw: () => send<{ ok: boolean }>("DELETE", "/submissions/mine"),
    submit: (body: {
      difficultyId: number;
      modRequirement: string;
      challengeRequirement: string;
    }) => send<ApiSubmission>("POST", "/submissions", body),
  },

  // ── Votes ──────────────────────────────────────────────────────────────────
  votes: {
    my: () => get<{ submissionId: number } | null>("/votes/my"),
    cast: (submissionId: number) => send<{ ok: boolean }>("POST", "/votes", { submissionId }),
    retract: () => send<{ ok: boolean }>("DELETE", "/votes"),
  },

  // ── Challenge ──────────────────────────────────────────────────────────────
  challenge: {
    /** A round's leaderboard, best first. Defaults to the open round; [] when none. */
    scores: (roundId?: number) =>
      get<ApiChallengeScore[]>(
        roundId === undefined ? "/challenge/scores" : `/challenge/scores?roundId=${roundId}`
      ),
    /** The caller's own recorded score for the open round, or null. */
    my: () => get<ApiChallengeScore | null>("/challenge/my"),
    /**
     * Imports the caller's osu! score for the winning beatmap. The body is empty:
     * the map comes from the recorded winner and the player from the session.
     */
    importMine: () =>
      send<{ ok: boolean; score: ApiChallengeScore }>("POST", "/challenge/scores"),
  },

  // ── Search ────────────────────────────────────────────────────────────────────
  search: {
    /**
     * Beatmap search over the osu! API.
     *
     * send() rather than get(), against this file's read convention and deliberately:
     * a search has four failures the page has to tell apart — signed out, rate
     * limited, osu! unavailable, and simply no matches — and get()'s `null` collapses
     * all four into the last one, which is the only one that is not an error.
     */
    beatmaps: (params: { q: string; status: MapStatus | "any"; sort: "stars" | "bpm" }) =>
      send<{ results: ApiSearchHit[] }>(
        "GET",
        `/search/beatmaps?${new URLSearchParams(params).toString()}`
      ),
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  admin: {
    /** `endsAt` overrides the scheduled end of the phase being entered. */
    setPhase: (phase: ApiRound["phase"], endsAt?: string | null) =>
      send<{ ok: boolean; round: ApiRound }>(
        "PATCH",
        "/admin/round/phase",
        endsAt === undefined ? { phase } : { phase, endsAt }
      ),
    /** Every field optional: month/year default to the current UTC month. */
    createRound: (body?: {
      month?: string;
      year?: number;
      reward?: string;
      submissionDays?: number;
      votingDays?: number;
      challengeDays?: number;
    }) => send<ApiRound>("POST", "/admin/rounds", body ?? {}),
    /** Every submission in a round, pending included. Defaults to the open round. */
    submissions: (roundId?: number) =>
      get<ApiSubmission[]>(roundId === undefined ? "/admin/submissions" : `/admin/submissions?roundId=${roundId}`),
    reviewSubmission: (id: number, status: "approved" | "rejected") =>
      send<{ ok: boolean; submission: ApiSubmission }>("PATCH", `/admin/submissions/${id}`, { status }),
    /** Ends the ballot and records a pending or tied winner. Does not advance the phase. */
    closeVoting: () =>
      send<{ ok: boolean; round: ApiRound; tied: number[] }>("POST", "/admin/round/close-voting"),
    /** Approves the winner and starts the challenge. submissionId is required on a tie. */
    approveWinner: (submissionId?: number) =>
      send<{ ok: boolean; round: ApiRound }>(
        "POST",
        "/admin/round/winner",
        submissionId === undefined ? {} : { submissionId }
      ),
    /**
     * Who voted for what, for moderation. Admin-only by construction — nothing public
     * exposes voter identity.
     */
    votes: (roundId?: number) =>
      get<ApiVoteAudit[]>(roundId === undefined ? "/admin/votes" : `/admin/votes?roundId=${roundId}`),
    /** Submission ids a tied round may be resolved to. */
    tiebreakEntries: () => get<number[]>("/admin/round/tiebreak"),
    /**
     * Records or overrides a challenge score by hand, for a play the osu! API will
     * not give up or a correction. The player is named by osu! id.
     */
    recordScore: (body: {
      osuId: number;
      score: number;
      accuracy: number;
      misses: number;
      mods?: string;
    }) => send<{ ok: boolean; score: ApiChallengeScore }>("POST", "/admin/challenge/scores", body),
  },

  // ── Health ─────────────────────────────────────────────────────────────────
  health: () => get<{ ok: boolean }>("/health"),
};
