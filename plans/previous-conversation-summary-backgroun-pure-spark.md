# Plan: Build osudz.ppy Community Voting Platform

## Context
The project already has a card battle game prototype (BeatmapCard, MatchMode, Leaderboard, SubmitPage).
We are now building the real community voting platform alongside it — the game components are left untouched.
All new platform pages live in new files; App.tsx gets a second nav section for platform pages.

---

## Approach: Parallel nav sections in App.tsx

Add a new `PlatformPage` union type and a second set of nav tabs to `App.tsx`.
The existing game tabs (Browse / Match / Leaderboard / Submit) stay exactly as-is.
The new platform tabs (Dashboard / Vote / Search / Submit) render new components.

```
type PlatformPage = 'dashboard' | 'vote' | 'search' | 'submit-platform';
```

App.tsx renders either the game view or the platform view based on a top-level toggle (e.g. a subtle "Platform" / "Game" switcher in the header, or the platform tabs are simply added as a second nav row).

---

## New files to create

All new, no edits to existing components.

| File | Purpose |
|---|---|
| `src/components/platform/DashboardPage.tsx` | Dashboard — all 3 phase states |
| `src/components/platform/VotePage.tsx` | Voting page (placeholder pending owner design) |
| `src/components/platform/SearchPage.tsx` | Beatmap search |
| `src/components/platform/PhaseBanner.tsx` | Global phase + countdown strip |
| `src/components/platform/BeatmapCardPlatform.tsx` | Platform beatmap card (placeholder until owner provides design) |
| `src/components/platform/Leaderboard.tsx` | Challenge leaderboard with score/acc/misses/qualification |
| `src/components/platform/NavHeader.tsx` | Platform navigation header |

---

## Build order (per plan Section 22)

### Step 1 — Nav + global shell
- `NavHeader.tsx`: Dashboard / Submit / Vote / Search tabs + phase badge + user avatar/login
- `PhaseBanner.tsx`: full-width "SUBMISSION PHASE · Ends in 2d 14h" strip
- Wire into App.tsx with mode toggle

### Step 2 — Dashboard (Submission phase)
- Round header (Monthly Challenge · Submission Phase · countdown)
- Favorite beatmaps grid using `BeatmapCardPlatform`
- "Load my osu! favorites" CTA
- "Submit a Beatmap" CTA

### Step 3 — Dashboard (Voting phase)
- Current Vote / "Your vote is waiting" section
- My Submissions with vote counts
- Leading beatmap emphasis

### Step 4 — Dashboard (Challenge phase)
- Winning beatmap hero
- Challenge countdown
- My Challenge Rank
- Challenge Leaderboard (green = qualified, red = not qualified)
- Bounty display

### Step 5 — Submit page (platform version)
- Wrap existing SubmitPage or build new one with:
  - Option 1: URL input + preview card
  - Option 2: Favorites grid
  - Phase gate ("Submissions closed" state)
  - Eligibility rules display

### Step 6 — Vote page (placeholder)
- Round header + countdown
- Grid of submitted beatmaps
- "Owner will provide final design" note in code

### Step 7 — Search page
- Search input
- Results grid using BeatmapCardPlatform
- Favorite button per card

---

## Data strategy
Use realistic hardcoded sample data throughout (no backend calls required for the prototype).
Sample data should use real osu! beatmap names, artists, mappers.
Phase state is controlled by a `useState` toggle for demo purposes (Submission / Voting / Challenge switcher).

---

## What is NOT touched
- `src/components/BeatmapCard.tsx`
- `src/components/MatchMode.tsx`
- `src/components/Leaderboard.tsx`
- `src/components/SubmitPage.tsx`
- `src/types.ts` (add only, never remove)
- `src/index.css`

---

## Verification
Visual check in the preview panel — no build step needed (Vite HMR).
Confirm: game tabs still work, platform tabs render new pages, phase switcher changes dashboard state.
