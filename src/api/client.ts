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
   * Whether this account may vote. Computed server-side by the same function the gate
   * that refuses the write uses, so the client never re-derives eligibility from
   * `country` and cannot drift from it.
   */
  canVote: boolean;
  /**
   * Whether this account may submit. Separate from canVote because an administrator
   * controls the two independently (C5) — a blocked voter may still be able to enter a
   * beatmap, and the reverse.
   */
  canSubmit: boolean;
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


/**
 * One country on the submit-and-vote allowlist.
 *
 * A row with enabled false is kept rather than deleted: it records that an administrator
 * considered the country and refused it, which an absent row does not say. The country
 * NAME is not stored — the client derives it from the code with Intl.DisplayNames, so
 * adding a country is two letters rather than a code change.
 */
export interface ApiAllowedCountry {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  enabled: boolean;
  /** The administrator who last changed this decision; null if their account is gone. */
  addedBy: number | null;
  addedAt: string;
}

/**
 * A per-player permission override — the "exception" an administrator sets after an
 * investigation (C5).
 *
 * Each flag is THREE-VALUED: null means no override for that capability, so the country
 * allowlist decides it; true grants it; false refuses it. An override wins in both
 * directions, which is why this is not a ban list.
 */
export interface ApiParticipantOverride {
  canSubmit: boolean | null;
  canVote: boolean | null;
  note: string | null;
  setBy: number | null;
  setAt: string | null;
}

/**
 * One account as the admin Users tab sees it.
 *
 * canSubmit and canVote are the EFFECTIVE answers — what the gates would actually decide.
 * `countryAllowed` and `override` are the two inputs that produced them, so the tab can
 * show why an account is allowed rather than guessing at it.
 */
export interface ApiAdminUser {
  id: number;
  osuId: number;
  username: string;
  country: string;
  avatarUrl: string;
  globalRank: number | null;
  isAdmin: boolean;
  canSubmit: boolean;
  canVote: boolean;
  countryAllowed: boolean;
  override: ApiParticipantOverride | null;
}

/** One override with the account it applies to, for the Eligibility tab's exception list. */
export interface ApiParticipantException extends ApiParticipantOverride {
  userId: number;
  username: string;
  osuId: number;
  country: string;
  avatarUrl: string;
  /** The administrator who set it, by name; null if their account is gone. */
  setByName: string | null;
  setAt: string;
}

/**
 * One favorited beatmap.
 *
 * TWO SOURCES, ONE LIST. 'dz' is a map favorited on this site, 'osu' is one imported from
 * the player's osu! profile. They are presented together and distinguished by source; an
 * import never overwrites a 'dz' row, which the primary key enforces server-side.
 *
 * mapStatus is a plain string here, unlike everywhere else: a favorite may be graveyard or
 * pending, because the ranked-status rule belongs to the submit path.
 */
export interface ApiFavorite {
  difficultyId: number;
  beatmapsetId: number;
  source: "dz" | "osu";
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  mapStatus: string;
  coverUrl: string;
  previewUrl: string;
  stars: number;
  bpm: number;
  lengthSeconds: number;
  favoritedAt: string;
}

/**
 * The administrator-defined submission rules (C8 and C9).
 *
 * A null bound means no bound — which is what migration 011 seeded, so nothing changed on the
 * day the store landed. The three lists are what the submit page offers and what the server
 * validates against, so they cannot drift the way the hardcoded copies did.
 */
export interface ApiSiteSettings {
  minStars: number | null;
  maxStars: number | null;
  minLengthSeconds: number | null;
  maxLengthSeconds: number | null;
  allowedStatuses: string[];
  allowedMods: string[];
  allowedChallengeTypes: string[];
}

/** The same rules plus who last changed them — GET /api/admin/settings only. */
export interface ApiAdminSiteSettings extends ApiSiteSettings {
  updatedBy: number | null;
  updatedAt: string;
}

/**
 * Read-only server configuration, for the admin config tab.
 *
 * Booleans and counts, never the values: the Discord webhook and the admin id list are
 * credentials, and an endpoint that returned them would put a secret on the wire to answer a
 * question that only needs a yes.
 */
export interface ApiAdminConfig {
  discordConfigured: boolean;
  clientOrigin: string;
  publicBaseUrl: string;
  secureCookies: boolean;
  adminCount: number;
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

  // ── Favorites ──────────────────────────────────────────────────────────────
  favorites: {
    /** The caller's favorites, both sources, newest first. [] when signed out. */
    list: () => get<ApiFavorite[]>("/favorites"),
    /**
     * Favorites a beatmap as source 'dz'. The server looks the beatmap up itself, so the
     * id is all this sends — metadata in a request body is metadata a request can invent.
     */
    add: (difficultyId: number) =>
      send<{ ok: boolean; favorite: ApiFavorite }>("PUT", `/favorites/${difficultyId}`),
    /** Removes it across BOTH sources — the heart means "not in my favorites here". */
    remove: (difficultyId: number) =>
      send<{ ok: boolean; removed: number }>("DELETE", `/favorites/${difficultyId}`),
    /**
     * Pulls the caller's osu! profile favourites in as source 'osu'. The body is empty: the
     * account comes from the session, and the server reads the list with its own token, so
     * there is nothing for a caller to assert.
     *
     * A MIRROR of that half — community favorites are untouched, and pressing it twice does
     * not double the list.
     */
    import: () =>
      send<{ ok: boolean; imported: number; favorites: ApiFavorite[] }>("POST", "/favorites/import"),
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    /** The submission rules. Public: a player has to know what they must satisfy. */
    get: () => get<ApiSiteSettings>("/settings"),
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
    /** Read-only server configuration — what is set, never the secrets themselves. */
    config: () => get<ApiAdminConfig>("/admin/config"),
    /** The submission rules, with who last changed them. */
    settings: () => get<ApiAdminSiteSettings>("/admin/settings"),
    /**
     * Saves part of the rules. A PATCH, so the `rules` tab saving star limits cannot rewrite
     * the `challenge` tab's lists with whatever it last rendered.
     */
    saveSettings: (patch: Partial<ApiSiteSettings>) =>
      send<{ ok: boolean; settings: ApiAdminSiteSettings }>("PUT", "/admin/settings", patch),
    /** Every account, with the effective capability flags and any override. */
    users: () => get<ApiAdminUser[]>("/admin/users"),
    /** Only the accounts that carry an override — the exception list. */
    participants: () => get<ApiParticipantException[]>("/admin/participants"),
    /**
     * Sets one account's override. Pass null for a capability to leave it to the country
     * rule; at least one of the two must be true or false, since a row overriding nothing
     * records nothing.
     */
    setParticipant: (
      userId: number,
      body: { canSubmit: boolean | null; canVote: boolean | null; note?: string | null }
    ) => send<{ ok: boolean; override: ApiParticipantOverride }>("PUT", `/admin/participants/${userId}`, body),
    /** Clears the override, so the country rule applies to that account again. */
    clearParticipant: (userId: number) =>
      send<{ ok: boolean }>("DELETE", `/admin/participants/${userId}`),
    /**
     * The country allowlist. Every row, disabled ones included — the admin tab shows
     * both, and a disabled row is a decision rather than an absence.
     */
    countries: () => get<ApiAllowedCountry[]>("/admin/countries"),
    /** Adds a country, or flips one that is already listed. */
    setCountry: (code: string, enabled: boolean) =>
      send<{ ok: boolean; country: ApiAllowedCountry }>(
        "PUT",
        `/admin/countries/${code.toUpperCase()}`,
        { enabled }
      ),
    /** Removes the row outright — for a code typed by mistake, not for disabling one. */
    removeCountry: (code: string) =>
      send<{ ok: boolean }>("DELETE", `/admin/countries/${code.toUpperCase()}`),
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
