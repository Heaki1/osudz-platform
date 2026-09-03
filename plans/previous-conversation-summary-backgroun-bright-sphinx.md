# Plan: Add Submit Beatmap Page

## Context

The Figma Make preview app (`src/`) is an osu! beatmap voting site for the Algerian community (osudz.ppy). It currently has three pages managed by a `useState<Page>` switch: Browse, Match, Leaderboard. The user wants to add a fourth **Submit** page where players can submit beatmaps via a form, and have those submitted beatmaps also appear in the Browse page under a "Community Submissions" section.

The reference design is in `src/imports/submitpage.md` — a standalone vanilla-HTML page showing the form structure, API endpoints, and auth flow.

---

## Approach

### 1. New `SubmitPage` component — `src/components/SubmitPage.tsx`

A self-contained React component matching the reference design's form + list layout, styled with the existing dark-blue + amber design system.

**Form inputs** (matching the HTML reference exactly):
- Beatmap URL (text input — triggers auto-fetch on blur)
- Challenge (text, max 80 chars — "Pass, FC, #1 Algeria, Best Acc")
- Mods (text, max 40 — "NM, HD, HR, DT")
- Map Difficulty (text, max 40 — "Insane, Expert")
- Song Title, Stars, CS, AR, OD, BPM, Length — readonly, populated by API

**Auto-fetch**: on URL `blur`, extract beatmap ID from `#osu/(\d+)` pattern, call `/api/beatmap/:id`, fill readonly fields. Show "Loading…" state while in-flight, clear on error.

**Auth flow** (matching the HTML reference):
- On mount: `fetch('/api/auth/me')` → store session state
- Render auth bar: signed-in shows avatar + username + sign-out; guest shows "Sign in with osu!" link
- Submit blocked if no identity; shows sign-in modal overlay instead
- Legacy path: localStorage `act_user_id` / `act_username` as fallback identity

**Submit**: POST to `/api/beatmaps/submit` with all fields plus `type: "bounty"`. On success: clear form, call `onSubmitSuccess()` prop (triggers parent to refresh the browse list).

**Editing/deleting**: Show owned beatmaps in the listed submissions below the form. Own cards get Edit and Delete buttons (PUT `/api/beatmaps/:id`, DELETE `/api/beatmaps/:id`).

**No lucide-react imports** — use emoji labels or simple inline `<svg>` elements to avoid the Figma Make SVG timeout bug from the previous conversation.

---

### 2. `src/App.tsx` changes

**a. Add page type**: `type Page = 'browse' | 'match' | 'leaderboard' | 'submit'`

**b. Add state for API-submitted beatmaps**:
```ts
const [submittedMaps, setSubmittedMaps] = useState<SubmittedBeatmap[]>([]);
```

**c. Fetch on mount + after submission**:
```ts
async function loadSubmittedMaps() {
  try {
    const res = await fetch('/api/beatmaps/list');
    const data = await res.json();
    setSubmittedMaps((Array.isArray(data) ? data : []).filter(x => x.type === 'bounty'));
  } catch { /* offline – no-op */ }
}
useEffect(() => { loadSubmittedMaps(); }, []);
```

**d. Browse page**: below the existing `BeatmapCard` grid, add a "Community Submissions" section that maps `submittedMaps` into flat submission cards. The section only renders when `submittedMaps.length > 0`.

**e. Nav tab**: Add a Submit tab:
```ts
{ key: 'submit', label: 'Submit', icon: <span>↑</span> }
```

**f. Page render**: Add `{page === 'submit' && <SubmitPage onSubmitSuccess={loadSubmittedMaps} />}` block.

---

### 3. `SubmittedBeatmap` type (defined in `src/App.tsx` or `src/types.ts`)

```ts
interface SubmittedBeatmap {
  id: string;
  url: string;
  title: string;
  artist?: string;
  mapper?: string;
  stars?: string | number;
  cs?: string | number;
  ar?: string | number;
  od?: string | number;
  bpm?: string | number;
  length?: string;
  mod?: string;
  slot?: string;
  skill?: string;
  cover_url?: string;
  preview_url?: string;
  submitted_by?: string;
  submitted_by_name?: string;
  type?: string;
}
```

---

### 4. Community Submissions card (inline in Browse page render)

Simple flat card, no flip animation — styled consistently:
- Cover image on the left (if available), beatmap info on the right
- Shows: title, artist, stars badge, mod/difficulty pill, CS/AR/OD/BPM row, "Submitted by" line
- Link to osu! beatmap URL
- External link opens in new tab

---

## Files to Modify

| File | Change |
|---|---|
| `src/App.tsx` | Add `'submit'` page type, `submittedMaps` state, `loadSubmittedMaps()`, useEffect on mount, Submit nav tab, SubmitPage render block, Community Submissions section in Browse |
| `src/components/SubmitPage.tsx` | **New file** — full submission form + auth + list |
| `src/types.ts` | Add `SubmittedBeatmap` interface (or define inline in App.tsx) |

---

## Reused patterns

- Auth fetch pattern from the HTML reference (`/api/auth/me`, `/api/beatmaps/list`, `/api/beatmaps/submit`, etc.)
- Same input/button styling already in the app (dark slate backgrounds, amber accents, rounded-xl borders)
- `extractId` / `extractSetId` URL parsing logic (port from HTML reference to TS)

---

## Verification

1. Navigate to Submit tab — form renders with all fields
2. Paste a real or mock osu! URL, tab away — readonly fields populate (or gracefully show empty on API error)
3. Submit with no identity — sign-in modal appears
4. Submit with identity — POST fires, form clears, Browse page "Community Submissions" section appears with new card
5. Browse page loads existing API beatmaps on mount without needing to visit Submit tab
