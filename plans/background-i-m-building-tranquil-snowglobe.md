# osu!dz — Backend Integration Plan (Step 1: Analysis & Architecture)

## Context

`osudz.ppy` is a React 19 + Vite 8 + Tailwind 4 single-page frontend (Figma Make project) for an osu! community platform for Algerian players. Almost all data is currently hardcoded sample/mock data, auth is faked, and every mutation (vote, submit, favorite, comment, admin action) is local-only and lost on unmount. The goal of this **first step** is to understand the current app and produce a backend integration plan — **no DB, no OAuth, no tables, no UI changes yet**. The frontend must stay visually and functionally identical.

This document is the deliverable. It ends with the exact recommended next implementation step, which should **not** begin until reviewed.

---

## A. Current frontend data flow

**State ownership is split three ways:**

1. **App-level (`src/App.tsx`)** — the only place with a real network call.
   - `initialBeatmaps: BeatmapBounty[]` hardcoded (lines ~17–234) → seeds `maps` state → passed to `VotePage`.
   - `MOCK_USER = { username: 'helixia_dz', rank: 12043, country: 'DZ' }` → login just does `setPlatformUser(MOCK_USER)`; logout clears it. No OAuth.
   - `platformPhase: Phase` held in client state, mutable from both the Dashboard demo switcher and Admin `RoundControl`.
   - Handlers `handleVote` / `handleFavorite` mutate `maps` locally (±1 vote, toggle flags) and adjust `userPoints`.
   - **Only live endpoint today:** `GET /api/beatmaps/list` (returns `SubmittedBeatmap[]`, filtered client-side to `type === 'bounty'`).
   - Routing is conditional rendering (no router lib) keyed on `platformPage`.

2. **Page-level reads from `sampleData.ts`** (static module):
   - `DashboardPage` → `favoriteBeatmaps`, `votingBeatmaps`, `challengeScores`.
   - `SearchPage` → `searchBeatmaps` (client-side filter/sort, no props).
   - `ArchivePage` → `archiveData` (read-only history).
   - `PlatformSubmitPage` → `favoriteBeatmaps`; URL lookup is faked with `setTimeout(800ms)` → `mockFetchResult`; submit just sets local `submitted=true`.

3. **Inline mock + local state:**
   - `AdminDashboard` — every tab (round/eligibility/rules/challenge/users/config) has inline seed consts and local state; all "Save…" buttons are no-ops except `RoundControl` which calls `onPhaseChange`.
   - `Leaderboard.tsx` — two hardcoded datasets (`topVoters`, `topMaps`) defined in-file.
   - `BeatmapCard.tsx` — flip card comments/replies are ephemeral (`id: Date.now()`, `user: 'you'`); replies are flat entries with `@mention` prefix, no nesting, no persistence. `VotePage` wires `onOpenComments` to a no-op.

**Two coexisting data models:** `BeatmapBounty`/`SubmittedBeatmap` (`src/types.ts`, game/browse + VotePage) vs `PlatformBeatmap`/`ChallengeScore`/`ArchiveEntry` (`src/components/platform/types.ts`). `SubmittedBeatmap` uses snake_case keys — closest to an intended API/DB shape.

**Audio preview** relies on `https://b.ppy.sh/preview/{beatmapSetId}.mp3`. `BeatmapCardPlatform` and `ArchivePage RoundCard` own their audio via `useRef`; `BeatmapCard` is parent-controlled. **This must not be touched** — backend only needs to return the osu! beatmapset id.

**Existing conventions to honor (from sibling `bounty-client/src/api.ts`):** same-origin `/api/*`, `fetch` with `credentials: 'include'` (session cookies), snake_case JSON bodies, numeric IDs, graceful `try/catch` returning null/empty. Endpoints already referenced across `App.tsx`/`SubmitPage.tsx`/`bounty-client`: `/api/auth/me`, `/api/auth/logout`, `/api/beatmaps/list`, `/api/challenges/current`, `/api/challenges/:id/vote`, comments routes, `/api/send-discord`, `/api/users/register`.

## Frontend actions that will need endpoints

- Login / logout / current user (osu! OAuth) — replaces `MOCK_USER`.
- Cast / retract vote (one per verified DZ account per round) — `App.handleVote`, `VotePage.handleVoteAttempt`.
- Toggle favorite (Dashboard, Search, Submit) — currently local/no-op stubs.
- Resolve beatmap by osu! URL → metadata (replaces `mockFetchResult`).
- Load osu! favorites (both Submit tabs — currently inert buttons).
- Submit a beatmap (one Challenge Requirement + one Mod Requirement) — `POST` needed.
- Comments + threaded replies (persisted) — wire `onOpenComments` / BeatmapCard.
- Read: current round/phase + countdowns, voting candidates with live counts, challenge leaderboard + my rank/qualification, archive, global leaderboard.
- Admin writes: advance/set phase + durations, eligibility (countries + user exceptions), beatmap rules, challenge config (mods, challenge types, bounty text), user list/search/ban, site config (name, Discord webhook, max subs, maintenance).

## Architectural problems to address before integration

1. **Two divergent data models** — pick server-authoritative DTOs and map at the API boundary; keep both frontend types initially via adapters rather than a risky refactor.
2. **Client-authoritative phase & vote state** — must become server-authoritative (round state, one-vote enforcement, eligibility) rather than `if (!user)` client checks.
3. **Hardcoded countdowns** (`NavHeader phaseConfig`, `DashboardPage roundMeta`) — derive from round end timestamps.
4. **No data-fetching layer** — scattered `fetch` calls; introduce a typed `src/api/` client mirroring `bounty-client` conventions.
5. **Ephemeral comments with no real IDs/nesting** — needs a persisted model with `parent_id`.
6. **Free-form mod/challenge strings** — normalize server-side; NM must display explicitly as "NM" / "No Mods".

---

## B. Proposed backend architecture

- **Stack:** Node + Express + `pg` (node-postgres), TypeScript. Session cookies (`express-session` or `cookie-session`) to match `credentials: 'include'`.
- **Location (monorepo, same repo):** new top-level `server/` directory alongside `src/` (frontend). Keeps one repo, one deploy target serving both static frontend and `/api/*`.
  - `server/src/index.ts` — Express app bootstrap.
  - `server/src/db.ts` — `pg` Pool.
  - `server/src/routes/*` — one router per resource (auth, beatmaps, submissions, challenges, votes, comments, rounds, admin, leaderboard).
  - `server/src/middleware/` — session/auth, requireAuth, requireAdmin, requireEligible (DZ).
  - `server/src/services/osu.ts` — osu! API wrapper (OAuth, beatmap lookup, favorites) — **secrets via env only**.
  - `server/src/discord.ts` — webhook notifier.
  - `server/migrations/` — SQL migrations (created in a later step, not now).
- **Secrets:** `.env` (already git-ignored) — `DATABASE_URL`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `SESSION_SECRET`, `DISCORD_WEBHOOK_URL`. Never referenced in `src/` frontend code.
- **Config:** add `server` package scripts + a Vite dev **proxy** (`/api` → `http://localhost:<serverPort>`) in `vite.config.ts`, since none exists today. Add `pg`, `express`, session lib, and osu! HTTP client as backend deps.

## C. Proposed database entities (high level — DO NOT create yet)

- **users** — id, osu_id, username, country, global_rank, is_eligible, is_admin, avatar_url, created_at.
- **sessions** — (if DB-backed sessions) sid, user_id, expires.
- **rounds** — id, number, month, year, phase (`submission|voting|challenge`), submission_ends_at, voting_ends_at, challenge_ends_at, bounty_text, status (`active|completed`).
- **challenge_requirements** — id, name, active (admin-defined options; exactly one per submission).
- **mod_requirements** — id, code (NM/HD/HR/DT/HDHR/EZ…), label, active (exactly one per submission).
- **beatmaps** — id, osu_beatmapset_id, osu_beatmap_id, title, artist, mapper, difficulty_name, stars, bpm, length, cs, ar, od, hp, status, cover_url, preview built from beatmapset id.
- **submissions** — id, round_id, beatmap_id, submitted_by (user_id), challenge_requirement_id, mod_requirement_id, reward (default "1 month osu!supporter"), created_at.
- **votes** — id, round_id, submission_id, user_id, created_at; **UNIQUE (round_id, user_id)** → exactly one vote per account per challenge.
- **favorites** — user_id, beatmap_id (composite PK).
- **comments** — id, submission_id, user_id, parent_id (nullable, self-ref for replies), body, created_at.
- **challenge_scores** — id, round_id, user_id, score, accuracy, misses, mods, qualified.
- **archive** — completed rounds preserved immutably: round winner snapshot, challenge_winner, leaderboard snapshot, participants (denormalized JSON or dedicated snapshot tables so archive never depends on mutable current data).
- **eligibility_countries** / **eligibility_exceptions** — admin allowlist + per-user overrides.
- **site_config** — site_name, discord_webhook, max_submissions, maintenance_mode.

Rules encoded: no points/tiers; default reward auto-applied; one challenge + one mod requirement per submission (FKs, NOT NULL); one vote per round per user (unique constraint); archive is a snapshot, not a view over live rows.

## D. Proposed API endpoints (high level — implement incrementally)

- **Auth:** `GET /api/auth/login` (osu! OAuth redirect), `GET /api/auth/callback`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Rounds/phase:** `GET /api/rounds/current`, `GET /api/rounds/archive`, `GET /api/rounds/:id`.
- **Beatmaps:** `GET /api/beatmaps/search`, `GET /api/beatmaps/resolve?url=…`, `GET /api/beatmaps/list` (keep existing), `GET /api/users/me/osu-favorites`.
- **Submissions:** `GET /api/rounds/:id/submissions`, `POST /api/submissions` (requireEligible + phase=submission + per-round limit).
- **Votes:** `POST /api/rounds/:id/vote`, `DELETE /api/rounds/:id/vote` (requireEligible, unique enforced).
- **Favorites:** `GET /api/users/me/favorites`, `POST /api/favorites`, `DELETE /api/favorites/:beatmapId`.
- **Comments:** `GET /api/submissions/:id/comments`, `POST /api/submissions/:id/comments` (`parent_id` optional).
- **Leaderboards:** `GET /api/rounds/:id/challenge-scores`, `GET /api/leaderboard` (global voters/maps).
- **Admin (requireAdmin):** `POST /api/admin/rounds/advance`, round durations, `/api/admin/eligibility/*`, `/api/admin/rules`, `/api/admin/challenge-config`, `/api/admin/mods`, `/api/admin/challenge-requirements`, `/api/admin/users` (+ ban), `/api/admin/config`.
- **Notifications:** `POST /api/send-discord` (keep existing; server-side webhook).

## E. Authentication approach

- osu! OAuth2 authorization-code flow, entirely server-side; tokens/secrets never reach the browser.
- Server sets an HTTP-only session cookie; frontend keeps `fetch(..., { credentials: 'include' })` (already the convention).
- On callback: fetch osu! profile, upsert `users`, compute eligibility (country == DZ or has exception), store role.
- Middleware: `requireAuth`, `requireEligible` (voting/submitting), `requireAdmin`. Eligibility and one-vote rule enforced server-side, not by client `if (!user)`.
- Frontend replaces `MOCK_USER` + `onLogin/onLogout` with real `getMe()` / login redirect / logout — but **not in this step**.

## F. Migration plan (sample data → real data)

1. **Introduce API layer, no behavior change:** add `src/api/` typed client (mirrors `bounty-client/src/api.ts`) but keep `sampleData.ts` as fallback. Do not delete `sampleData.ts`.
2. **Add Vite `/api` proxy** and stand up the Express server returning shapes that match existing frontend types (adapters map DB DTOs → `PlatformBeatmap`/`BeatmapBounty`).
3. **Page-by-page swap** reads from `sampleData` imports to API calls behind the same props/shapes, starting with read-only pages (Archive, Search), then Dashboard, then VotePage.
4. **Wire mutations** (vote, favorite, submit, comments) to endpoints with optimistic UI preserved.
5. **Auth last** among features: swap `MOCK_USER` for real session.
6. **Retire sample data** only once every consumer is switched; keep it importable for storybook/dev until then.

Throughout: UI markup, styling, audio preview (`b.ppy.sh` + `useRef`), and component structure stay unchanged — only data sources change.

## G. Exact recommended next implementation step

**Scaffold the Express + `pg` backend skeleton and the frontend API client seam — with zero UI/behavior change and no database yet.** Concretely:

1. Create `server/` (Express + TypeScript): `index.ts` app + health route, `db.ts` `pg` Pool (reads `DATABASE_URL`, lazy/optional so it boots without a DB), `routes/health.ts`. Add `server` scripts to `package.json` and backend deps (`express`, `pg`, session lib, `@types/*`).
2. Add a Vite dev **proxy** for `/api` → the Express port in `vite.config.ts` (there is none today).
3. Add `src/api/client.ts` — a thin typed `fetch` wrapper (`credentials: 'include'`, JSON helpers, error handling) modeled on `bounty-client/src/api.ts`. Do **not** rewire any page to use it yet.
4. Add `.env.example` documenting `DATABASE_URL`, `OSU_CLIENT_ID/SECRET`, `SESSION_SECRET`, `DISCORD_WEBHOOK_URL` (no real values; `.env` stays git-ignored).

This establishes the backend home, the communication channel, and the client seam without touching sample data, auth, the DB schema, or any component's visuals — everything the user deferred. Subsequent steps then implement DB migrations, auth, and the page-by-page data swap from section F.

## Verification (for the next step, when executed)

- `pnpm dev` (frontend) + backend `dev` script both boot; `GET /api/health` returns 200 through the Vite proxy.
- App loads and behaves identically (sample data still drives all pages); no console/network regressions.
- No secrets present in `src/`; `.env` git-ignored; TypeScript builds clean for both `src/` and `server/`.
