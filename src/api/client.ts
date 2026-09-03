// Typed API seam — all fetch calls go through here.
// While the backend is not yet live, every method falls back silently
// and the UI continues using its local sample data.

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

async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function del<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function patch<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: () => get<ApiUser>("/auth/me"),
    loginUrl: () => `${BASE}/auth/login`,
    logout: () => post<{ ok: boolean }>("/auth/logout"),
  },

  // ── Rounds ─────────────────────────────────────────────────────────────────
  rounds: {
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
    }) => post<ApiSubmission>("/submissions", body),
  },

  // ── Votes ──────────────────────────────────────────────────────────────────
  votes: {
    my: () => get<{ submissionId: number } | null>("/votes/my"),
    cast: (submissionId: number) => post<{ ok: boolean }>("/votes", { submissionId }),
    retract: () => del<{ ok: boolean }>("/votes"),
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  admin: {
    setPhase: (phase: ApiRound["phase"]) => patch<{ ok: boolean }>("/admin/round/phase", { phase }),
    submissions: () => get<ApiSubmission[]>("/admin/submissions"),
    reviewSubmission: (id: number, status: "approved" | "rejected") =>
      patch<{ ok: boolean }>(`/admin/submissions/${id}`, { status }),
    createRound: (body: { month: string; year: number; reward?: string }) =>
      post<ApiRound>("/admin/rounds", body),
  },

  // ── Health ─────────────────────────────────────────────────────────────────
  health: () => get<{ ok: boolean }>("/health"),
};
