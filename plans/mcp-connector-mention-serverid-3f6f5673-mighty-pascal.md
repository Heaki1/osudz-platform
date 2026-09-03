# Plan: Import Beatmap Bounty Frontend as New Page

## Context

The target repository (`Heaki1/beta-client-`) is an osu! community site for Algerian players. It already has:
- An Express.js backend with a full REST API (osu! OAuth, challenges, voting, comments, admin)
- A vanilla HTML/CSS site for the main pages
- A React 18 + Vite SPA in `vote-client/` that builds to `public/vote/` and serves at `/vote`

The goal is to add the new beatmap bounty frontend (built in this Figma Make session — React + Vite + Tailwind CSS v4 + TypeScript) as a new page at `/bounty`, wired to the real API and database instead of the current mock data.

---

## Approach: New `bounty-client/` Sub-Project

Mirror the exact pattern of `vote-client/` → `public/vote/`:

- New sub-project at `bounty-client/` (React 18 + Vite + Tailwind CSS v4 + TypeScript)
- Builds to `public/bounty/`
- Express serves it statically at `/bounty`
- Dev proxy: `/api` → `http://localhost:3000`

This is **non-invasive** — nothing in the existing `vote-client/` or HTML pages is modified.

---

## Files to Create (New Sub-Project)

### `bounty-client/package.json`
Mirror `vote-client/package.json` but add TypeScript, Tailwind CSS v4, and lucide-react:
```json
{
  "name": "osu-bounty-client",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@tailwindcss/vite": "^4.0.0",
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.11"
  }
}
```

### `bounty-client/vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/bounty/',
  build: { outDir: '../public/bounty', emptyOutDir: true },
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
```

### `bounty-client/index.html`
Standard Vite HTML shell mounting `src/main.tsx`.

### `bounty-client/src/` — Source Files

Copy from the Figma Make project with the following adaptations:

| File | Action |
|---|---|
| `src/types.ts` | Copy as-is |
| `src/index.css` | Copy as-is (Google Fonts @import + Tailwind) |
| `src/main.tsx` | Copy as-is |
| `src/components/BeatmapCard.tsx` | Copy as-is |
| `src/components/Leaderboard.tsx` | Copy as-is (mock data OK for now) |
| `src/components/MatchMode.tsx` | Copy as-is (purely frontend game) |
| `src/api.ts` | **New file** — real API calls (see below) |
| `src/App.tsx` | **Adapt** — replace mock data + handlers with API calls |

---

## Key Adaptation: `src/api.ts`

All API calls send `credentials: 'include'` (for the JWT httpOnly cookie):

```ts
const BASE = '';

export async function getMe() {
  const r = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
  return r.ok ? r.json() : null;
}

export async function getCurrentChallenge() {
  const r = await fetch(`${BASE}/api/challenges/current`, { credentials: 'include' });
  if (!r.ok) return null;
  return r.json();
}

export async function castVote(challengeId: number, beatmapId: number) {
  const r = await fetch(`${BASE}/api/challenges/${challengeId}/vote`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beatmap_id: beatmapId }),
  });
  return r.ok;
}

export async function getComments(challengeId: number, beatmapId: number) {
  const r = await fetch(`${BASE}/api/challenges/${challengeId}/candidates/${beatmapId}/comments`, { credentials: 'include' });
  return r.ok ? r.json() : [];
}

export async function postComment(challengeId: number, beatmapId: number, body: string, parentId?: number) {
  const r = await fetch(`${BASE}/api/challenges/${challengeId}/candidates/${beatmapId}/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, parent_id: parentId ?? null }),
  });
  return r.ok ? r.json() : null;
}
```

---

## Key Adaptation: `src/App.tsx`

Replace `useState(initialBeatmaps)` with a `useEffect` that:
1. Calls `getMe()` → stores `session` (username, avatar, can_vote, is_admin)
2. Calls `getCurrentChallenge()` → maps response to `BeatmapBounty[]`

**API → `BeatmapBounty` mapping** (from `schema.sql` field names):

```ts
function mapCandidate(c: any, userVotedId: number | null): BeatmapBounty {
  return {
    id: String(c.beatmap_id),
    title: c.title,
    artist: c.artist ?? c.title,
    mapper: c.mapper ?? 'unknown',
    genre: 'Electronic',            // API has no genre field — default
    difficultyRating: parseFloat(c.stars) || 0,
    difficultyCategory: difficultyCategory(parseFloat(c.stars)),
    difficultyName: c.difficulty_name ?? '',
    votes: c.vote_count ?? 0,
    userVoted: userVotedId === c.beatmap_id,
    userFavorited: false,           // local state only
    bannerUrl: c.cover_url ?? '',
    previewDuration: c.length ?? '0:00',
    previewSeconds: parseLength(c.length),
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: parseFloat(c.bpm) || 0,
    length: c.length ?? '0:00',
    circleSize: parseFloat(c.cs) || 0,
    approachRate: parseFloat(c.ar) || 0,
    accuracy: parseFloat(c.od) || 0,
    hpDrain: parseFloat(c.hp) || 0,
    bountyRewardPoints: 50,
    description: '',
    comments: [],                   // loaded on-demand per card
    challenges: defaultChallenges(parseFloat(c.stars)),
  };
}
```

**Vote handler** — calls `castVote(challengeId, beatmapId)`, falls back to showing login redirect if `session` is null.

**Comments** — `BeatmapCard`'s `onOpenComments` fetches `getComments(challengeId, beatmapId)` and merges into local state. `onPostComment` calls `postComment(...)`.

**Login bar** — add a small banner: if `session` is null, show "Sign in with osu!" linking to `/api/auth/osu/login`. If session exists, show avatar + username + logout.

---

## Files to Modify in the Repo

### `server.js` — Add two blocks

1. **Static serving** (near the top where other `express.static` calls live):
```js
app.use('/bounty', express.static(path.join(__dirname, 'public/bounty')));
```

2. **SPA catch-all** (after all API routes, before the existing catch-all or at the end):
```js
app.get('/bounty/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/bounty/index.html'));
});
```

### `scripts/build-client.js` — Add bounty-client build step

After the existing `vote-client` build, add:
```js
execSync('npm install', { cwd: path.join(__dirname, '../bounty-client'), stdio: 'inherit' });
execSync('npm run build', { cwd: path.join(__dirname, '../bounty-client'), stdio: 'inherit' });
```

---

## What You Need to Provide

Nothing — the repo is public and I have everything needed. Once you approve, I will:
1. Clone / push directly to the repo, OR commit the new files here and you push them.

> **Preferred workflow**: I'll create all the files locally here (in the working directory) and then you can copy `bounty-client/` into your local repo clone and push. Alternatively, I can push directly via the GitHub API if you want.

---

## Verification

1. `cd bounty-client && npm install && npm run build` — should produce `public/bounty/`
2. `node server.js` — visit `http://localhost:3000/bounty` — should load the React app
3. `npm run dev:client` equivalent for bounty: `npm --prefix bounty-client run dev` (port 5174) — hot-reload dev mode
4. Sign in with osu! → vote on a map → confirm vote appears in the DB
5. Post a comment → confirm it appears in `challenge_comments` table
6. `npm run build` from repo root — should build both clients

---

## Out of Scope (Future)

- **Leaderboard API**: No `/api/leaderboard` endpoint exists. The Leaderboard component will use mock data initially; a real endpoint (`SELECT u.username, COUNT(v.*) ...`) can be added later.
- **Match Mode**: Purely local — no backend needed.
- **Genre field**: The DB has no genre column. Default to `'Electronic'` or parse from the title string.
- **Bounty challenges**: The DB has a `bounty` text field (free text), not structured challenges. Keep generated static challenges per difficulty tier.
