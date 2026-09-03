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
}

export interface ApiSubmission {
  id: number;
  beatmapsetId: number;
  difficultyId: number;
  title: string;
  artist: string;
  mapper: string;
  coverUrl: string;
  previewUrl: string;
  stars: number;
  bpm: number;
  length: string;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  challengeRequirement: string;
  modRequirement: string;
  submittedByName: string;
  voteCount: number;
  isVoted?: boolean;
  isFavorited?: boolean;
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
    list: () => get<ApiRound[]>("/rounds"),
    get: (id: number) => get<ApiRound>(`/rounds/${id}`),
  },

  // ── Submissions ────────────────────────────────────────────────────────────
  submissions: {
    list: () => get<ApiSubmission[]>("/submissions"),
    get: (id: number) => get<ApiSubmission>(`/submissions/${id}`),
    submit: (body: {
      beatmapsetId: number;
      difficultyId: number;
      challengeRequirement: string;
      modRequirement: string;
    }) => send<ApiSubmission>("POST", "/submissions", body),
  },

  // ── Votes ──────────────────────────────────────────────────────────────────
  votes: {
    my: () => get<{ submissionId: number } | null>("/votes/my"),
    cast: (submissionId: number) => send<{ ok: boolean }>("POST", "/votes", { submissionId }),
    retract: () => send<{ ok: boolean }>("DELETE", "/votes"),
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
    submissions: () => get<ApiSubmission[]>("/admin/submissions"),
    reviewSubmission: (id: number, status: "approved" | "rejected") =>
      send<{ ok: boolean }>("PATCH", `/admin/submissions/${id}`, { status }),
  },

  // ── Health ─────────────────────────────────────────────────────────────────
  health: () => get<{ ok: boolean }>("/health"),
};
