// Authenticated verification for osu!dz. READ-ONLY by default: it makes no writes
// unless you pass --allow-writes, and it says exactly what it would change first.
//
// Run it from the repo root with the API up, pasting your own browser session cookie:
//
//   node verify-authenticated.mjs "<the osudz_session cookie value>"
//
// To find the cookie: open the site, DevTools -> Application -> Cookies -> osudz_session,
// and copy the Value. It identifies you, so do not paste it anywhere else.

const BASE = 'http://localhost:3001/api';
const session = process.argv[2];
const allowWrites = process.argv.includes('--allow-writes');

if (!session) {
  console.error('usage: node verify-authenticated.mjs "<osudz_session cookie value>" [--allow-writes]');
  process.exit(2);
}

const headers = { Cookie: `osudz_session=${session}`, Accept: 'application/json' };
let pass = 0;
let fail = 0;
let skip = 0;

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`ok    ${label}`);
    pass++;
  } else {
    console.log(`FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
    fail++;
  }
}

function skipped(label, why) {
  console.log(`skip  ${label}\n        ${why}`);
  skip++;
}

console.log('--- who am I ---');
const me = await call('/auth/me');
if (me.status !== 200 || me.body === null) {
  console.error('FAIL  the session cookie was not accepted. Copy it again — it may have expired.');
  process.exit(1);
}
const user = me.body;
console.log(
  `      ${user.username} (osu! id ${user.osuId}, ${user.country}) admin=${user.isAdmin} canVote=${user.canVote}`
);

const round = (await call('/rounds/current')).body;
if (!round) {
  console.error('FAIL  no round is open, so there is nothing to verify against.');
  process.exit(1);
}
console.log(
  `      round ${round.roundNumber} (id ${round.id}) phase=${round.phase} winnerStatus=${round.winnerStatus}`
);

console.log('\n--- per-caller reads answer for this account ---');
const mine = await call('/submissions/mine');
ok('GET /submissions/mine answers 200', mine.status === 200, `got ${mine.status}`);
const myVote = await call('/votes/my');
ok('GET /votes/my answers 200', myVote.status === 200, `got ${myVote.status}`);
const myScore = await call('/challenge/my');
ok('GET /challenge/my answers 200', myScore.status === 200, `got ${myScore.status}`);

console.log('\n--- the phase gates refuse out-of-phase writes ---');
if (round.phase === 'submission') {
  const vote = await call('/votes', { method: 'POST', body: JSON.stringify({ submissionId: 1 }) });
  ok(
    'POST /votes is refused during the submission phase',
    vote.status === 409,
    `got ${vote.status}: ${JSON.stringify(vote.body)}`
  );
  const score = await call('/challenge/scores', { method: 'POST' });
  ok(
    'POST /challenge/scores is refused outside the challenge phase',
    score.status === 409,
    `got ${score.status}: ${JSON.stringify(score.body)}`
  );
} else if (round.phase === 'voting') {
  const ballotClosed = round.winnerStatus !== 'none';
  const submit = await call('/submissions', { method: 'POST', body: JSON.stringify({}) });
  ok(
    'POST /submissions is refused during the voting phase',
    submit.status === 409 || submit.status === 400,
    `got ${submit.status}: ${JSON.stringify(submit.body)}`
  );
  if (ballotClosed) {
    const cast = await call('/votes', { method: 'POST', body: JSON.stringify({ submissionId: 1 }) });
    ok(
      'POST /votes is refused once the ballot is closed',
      cast.status === 409 && String(cast.body?.error).includes('closed'),
      `got ${cast.status}: ${JSON.stringify(cast.body)}`
    );
    const retract = await call('/votes', { method: 'DELETE' });
    ok(
      'DELETE /votes is refused once the ballot is closed',
      retract.status === 409 && String(retract.body?.error).includes('closed'),
      `got ${retract.status}: ${JSON.stringify(retract.body)}`
    );
  } else {
    skipped('the frozen-ballot refusals', 'the ballot is still open — close voting first to test them');
  }
} else if (round.phase === 'challenge') {
  const submit = await call('/submissions', { method: 'POST', body: JSON.stringify({}) });
  ok(
    'POST /submissions is refused during the challenge phase',
    submit.status === 409 || submit.status === 400,
    `got ${submit.status}: ${JSON.stringify(submit.body)}`
  );
  const cast = await call('/votes', { method: 'POST', body: JSON.stringify({ submissionId: 1 }) });
  ok(
    'POST /votes is refused during the challenge phase',
    cast.status === 409,
    `got ${cast.status}: ${JSON.stringify(cast.body)}`
  );
}

console.log('\n--- self-voting is refused in both layers ---');
if (mine.body && round.phase === 'voting' && round.winnerStatus === 'none') {
  const own = await call('/votes', {
    method: 'POST',
    body: JSON.stringify({ submissionId: mine.body.id }),
  });
  ok(
    'POST /votes for your own entry is refused',
    own.status === 409,
    `got ${own.status}: ${JSON.stringify(own.body)}`
  );
} else {
  skipped(
    'the self-vote refusal',
    mine.body ? 'the ballot is not open' : 'this account has no entry in the open round'
  );
}

console.log('\n--- admin gating ---');
if (user.isAdmin) {
  for (const [label, path] of [
    ['GET /admin/submissions', '/admin/submissions'],
    ['GET /admin/votes', '/admin/votes'],
    ['GET /admin/round/tiebreak', '/admin/round/tiebreak'],
  ]) {
    const res = await call(path);
    ok(`${label} answers 200 for an admin`, res.status === 200, `got ${res.status}`);
  }

  const badPhase = await call('/admin/round/phase', {
    method: 'PATCH',
    body: JSON.stringify({ phase: 'submission' }),
  });
  ok(
    'PATCH /admin/round/phase refuses a backwards move',
    badPhase.status === 409 || round.phase === 'submission',
    `got ${badPhase.status}: ${JSON.stringify(badPhase.body)}`
  );

  if (round.phase === 'voting') {
    const skipApproval = await call('/admin/round/phase', {
      method: 'PATCH',
      body: JSON.stringify({ phase: 'challenge' }),
    });
    ok(
      'PATCH /admin/round/phase cannot skip the winner approval (voting -> challenge)',
      skipApproval.status === 409,
      `got ${skipApproval.status}: ${JSON.stringify(skipApproval.body)}`
    );
  } else {
    skipped('the voting -> challenge bypass check', `the round is in the ${round.phase} phase`);
  }

  const badScore = await call('/admin/challenge/scores', {
    method: 'POST',
    body: JSON.stringify({ osuId: user.osuId, score: -1, accuracy: 50, misses: 0 }),
  });
  ok(
    'POST /admin/challenge/scores rejects a negative score',
    badScore.status === 400,
    `got ${badScore.status}: ${JSON.stringify(badScore.body)}`
  );

  const noSuchPlayer = await call('/admin/challenge/scores', {
    method: 'POST',
    body: JSON.stringify({ osuId: 999999999, score: 1, accuracy: 50, misses: 0 }),
  });
  ok(
    'POST /admin/challenge/scores refuses an account that has never signed in',
    noSuchPlayer.status === 404 || noSuchPlayer.status === 409,
    `got ${noSuchPlayer.status}: ${JSON.stringify(noSuchPlayer.body)}`
  );
} else {
  for (const [label, path] of [
    ['GET /admin/submissions', '/admin/submissions'],
    ['GET /admin/votes', '/admin/votes'],
    ['POST /admin/rounds', '/admin/rounds'],
  ]) {
    const res = await call(path);
    ok(`${label} answers 403 for a non-admin`, res.status === 403, `got ${res.status}`);
  }
}

console.log('');
console.log('--- beatmap search (H4) ---');
// Read-only and cheap enough to run without --allow-writes: eight requests against a
// 20-a-minute allowance. This is the half of H4 that cannot be checked signed out,
// because requireAuth answers before the parameter validation ever runs.
{
  const submittable = ['ranked', 'loved', 'approved'];

  const found = await call('/search/beatmaps?q=souzou');
  const hits = Array.isArray(found.body?.results) ? found.body.results : [];
  ok(
    'GET /search/beatmaps returns results for a real title',
    found.status === 200 && hits.length > 0,
    `got ${found.status}: ${JSON.stringify(found.body).slice(0, 200)}`
  );

  ok(
    'every hit carries what a card needs',
    hits.length > 0 &&
      hits.every(
        (h) =>
          Number.isFinite(h.difficultyId) &&
          Number.isFinite(h.beatmapsetId) &&
          Number.isFinite(h.stars) &&
          Number.isFinite(h.bpm) &&
          Number.isFinite(h.lengthSeconds) &&
          h.difficultyCount >= 1 &&
          h.title && h.artist && h.mapper && h.difficultyName
      ),
    `first hit: ${JSON.stringify(hits[0])}`
  );

  // Search offers what can be entered. A qualified or graveyard map the submit path
  // would refuse is a trap rather than a wider search.
  ok(
    'no hit has a status the submit path would refuse',
    hits.every((h) => submittable.includes(h.mapStatus)),
    `saw ${[...new Set(hits.map((h) => h.mapStatus))].join(', ')}`
  );

  ok(
    'hits come back ordered by stars, hardest first',
    hits.every((h, i) => i === 0 || hits[i - 1].stars >= h.stars),
    hits.map((h) => h.stars).join(' ')
  );

  const byBpm = await call('/search/beatmaps?q=souzou&sort=bpm');
  const bpmHits = Array.isArray(byBpm.body?.results) ? byBpm.body.results : [];
  ok(
    'sort=bpm orders by bpm, fastest first',
    byBpm.status === 200 && bpmHits.every((h, i) => i === 0 || bpmHits[i - 1].bpm >= h.bpm),
    bpmHits.map((h) => h.bpm).join(' ')
  );

  const loved = await call('/search/beatmaps?q=love&status=loved');
  const lovedHits = Array.isArray(loved.body?.results) ? loved.body.results : [];
  ok(
    'status=loved returns only loved maps',
    loved.status === 200 && lovedHits.every((h) => h.mapStatus === 'loved'),
    `saw ${[...new Set(lovedHits.map((h) => h.mapStatus))].join(', ')}`
  );

  // The browse state: the page fetches before anyone has typed, and an empty q is how.
  const browse = await call('/search/beatmaps');
  ok(
    'an empty query is a browse, not an error',
    browse.status === 200 && Array.isArray(browse.body?.results),
    `got ${browse.status}`
  );

  const nothing = await call('/search/beatmaps?q=zzzzqqqxxnotarealbeatmapzzz');
  ok(
    'a query with no matches is an empty list, not a failure',
    nothing.status === 200 &&
      Array.isArray(nothing.body?.results) &&
      nothing.body.results.length === 0,
    `got ${nothing.status}: ${JSON.stringify(nothing.body).slice(0, 120)}`
  );

  const badStatus = await call('/search/beatmaps?status=graveyard');
  ok('a status the submit path refuses answers 400', badStatus.status === 400, `got ${badStatus.status}`);

  const badSort = await call('/search/beatmaps?sort=nope');
  ok('an unknown sort answers 400 rather than defaulting', badSort.status === 400, `got ${badSort.status}`);
}

console.log('');
console.log('--- country allowlist (C4) ---');
{
  const list = await call('/admin/countries');
  if (list.status === 403) {
    skipped('the allowlist checks', 'this session is not an administrator');
  } else {
    const rows = Array.isArray(list.body) ? list.body : [];
    ok(
      'GET /admin/countries reads the table',
      list.status === 200 && Array.isArray(list.body),
      `got ${list.status}: ${JSON.stringify(list.body).slice(0, 160)}`
    );
    // Migration 005 seeds DZ enabled. Without that row the allowlist refuses everyone,
    // so this doubles as proof the seed landed.
    ok(
      'DZ is listed and enabled, so the seed in 005 landed',
      rows.some((c) => c.country === 'DZ' && c.enabled === true),
      JSON.stringify(rows)
    );

    const badCode = await call('/admin/countries/DZA', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    ok('a three-letter code answers 400', badCode.status === 400, `got ${badCode.status}`);

    const badBody = await call('/admin/countries/TN', {
      method: 'PUT',
      body: JSON.stringify({ enabled: 'yes' }),
    });
    ok('a non-boolean enabled answers 400', badBody.status === 400, `got ${badBody.status}`);

    const missing = await call('/admin/countries/ZZ', { method: 'DELETE' });
    ok(
      'removing a country that is not listed answers 404',
      missing.status === 404,
      `got ${missing.status}`
    );

    if (allowWrites) {
      // Enable TN, confirm it reads back, then remove it — the tree is left as it was.
      const added = await call('/admin/countries/TN', {
        method: 'PUT',
        body: JSON.stringify({ enabled: true }),
      });
      ok('enabling a second country succeeds', added.status === 200, `got ${added.status}`);

      const after = await call('/admin/countries');
      const tn = (Array.isArray(after.body) ? after.body : []).find((c) => c.country === 'TN');
      ok('the second country reads back enabled', tn?.enabled === true, JSON.stringify(tn));

      // canVote is computed from this same allowlist, so /auth/me must agree with it.
      const me = await call('/auth/me');
      ok(
        'GET /auth/me still reports canVote from the allowlist',
        me.status === 200 && typeof me.body?.canVote === 'boolean',
        JSON.stringify(me.body)
      );

      const gone = await call('/admin/countries/TN', { method: 'DELETE' });
      ok('removing it again succeeds, leaving the list as it was', gone.status === 200, `got ${gone.status}`);
    } else {
      skipped('the enable/disable round trip', 'it writes to the allowlist — pass --allow-writes');
    }
  }
}

console.log('');
console.log('--- per-player permissions (C5) ---');
{
  const roster = await call('/admin/users');
  if (roster.status === 403) {
    skipped('the permission checks', 'this session is not an administrator');
  } else {
    const users = Array.isArray(roster.body) ? roster.body : [];
    ok(
      'GET /admin/users returns the roster',
      roster.status === 200 && users.length > 0,
      `got ${roster.status}: ${JSON.stringify(roster.body).slice(0, 160)}`
    );
    ok(
      'every row carries the effective flags and the inputs that produced them',
      users.every(
        (u) =>
          typeof u.canSubmit === 'boolean' &&
          typeof u.canVote === 'boolean' &&
          typeof u.countryAllowed === 'boolean' &&
          (u.override === null || typeof u.override === 'object')
      ),
      JSON.stringify(users[0])
    );

    const overrides = await call('/admin/participants');
    ok(
      'GET /admin/participants lists the overrides',
      overrides.status === 200 && Array.isArray(overrides.body),
      `got ${overrides.status}`
    );

    const badId = await call('/admin/participants/nope', {
      method: 'PUT',
      body: JSON.stringify({ canSubmit: false, canVote: null }),
    });
    ok('a non-numeric userId answers 400', badId.status === 400, `got ${badId.status}`);

    const badFlag = await call('/admin/participants/1', {
      method: 'PUT',
      body: JSON.stringify({ canSubmit: 'no', canVote: null }),
    });
    ok('a non-boolean flag answers 400', badFlag.status === 400, `got ${badFlag.status}`);

    // A row overriding nothing records nothing, so it is refused rather than stored.
    const bothNull = await call('/admin/participants/1', {
      method: 'PUT',
      body: JSON.stringify({ canSubmit: null, canVote: null }),
    });
    ok('an override that overrides nothing answers 400', bothNull.status === 400, `got ${bothNull.status}`);

    const noSuchUser = await call('/admin/participants/999999', {
      method: 'PUT',
      body: JSON.stringify({ canSubmit: false, canVote: null }),
    });
    ok(
      'an account that has never signed in answers 404',
      noSuchUser.status === 404,
      `got ${noSuchUser.status}`
    );

    const nothingToClear = await call('/admin/participants/999999', { method: 'DELETE' });
    ok(
      'clearing an override that does not exist answers 404',
      nothingToClear.status === 404,
      `got ${nothingToClear.status}`
    );

    if (allowWrites) {
      // The case a single ban flag could not express, and C5's own VERIFY: block one
      // capability and the other must be untouched. Restored at the end.
      const me = await call('/auth/me');
      const myId = me.body?.id;
      const before = { canSubmit: me.body?.canSubmit, canVote: me.body?.canVote };

      const blocked = await call(`/admin/participants/${myId}`, {
        method: 'PUT',
        body: JSON.stringify({ canSubmit: null, canVote: false, note: 'verify-authenticated.mjs' }),
      });
      ok('blocking one capability succeeds', blocked.status === 200, `got ${blocked.status}`);

      const after = await call('/auth/me');
      ok(
        'canVote goes false and canSubmit is untouched',
        after.body?.canVote === false && after.body?.canSubmit === before.canSubmit,
        `canVote ${after.body?.canVote}, canSubmit ${after.body?.canSubmit} (was ${before.canSubmit})`
      );

      // The gate and the flag have to be the same sentence, so the write must refuse too.
      const refused = await call('/votes', {
        method: 'POST',
        body: JSON.stringify({ submissionId: 1 }),
      });
      ok(
        'POST /votes answers 403 and says an administrator restricted the account',
        refused.status === 403 && /administrator/i.test(refused.body?.error ?? ''),
        `got ${refused.status}: ${JSON.stringify(refused.body)}`
      );

      const listed = await call('/admin/participants');
      ok(
        'the override appears in the exception list',
        (Array.isArray(listed.body) ? listed.body : []).some((p) => p.userId === myId),
        JSON.stringify(listed.body)
      );

      const cleared = await call(`/admin/participants/${myId}`, { method: 'DELETE' });
      ok('clearing the override succeeds', cleared.status === 200, `got ${cleared.status}`);

      const restored = await call('/auth/me');
      ok(
        'clearing it hands the account back to the country rule',
        restored.body?.canVote === before.canVote && restored.body?.canSubmit === before.canSubmit,
        `canVote ${restored.body?.canVote} (was ${before.canVote})`
      );
    } else {
      skipped('the block/restore round trip', 'it writes an override on your own account — pass --allow-writes');
    }
  }
}

console.log('');
console.log('--- favorites (A4) ---');
{
  const list = await call('/favorites');
  ok(
    'GET /favorites returns the caller list',
    list.status === 200 && Array.isArray(list.body),
    `got ${list.status}: ${JSON.stringify(list.body).slice(0, 160)}`
  );

  const badId = await call('/favorites/nope', { method: 'PUT' });
  ok('a non-numeric difficulty id answers 400', badId.status === 400, `got ${badId.status}`);

  const missing = await call('/favorites/999999999', { method: 'DELETE' });
  ok(
    'removing a beatmap that is not favorited answers 404',
    missing.status === 404,
    `got ${missing.status}`
  );

  if (allowWrites) {
    // Souzou Forest [Expert] — the difficulty this instance already has a submission for.
    const id = 4907876;
    const started = (Array.isArray(list.body) ? list.body : []).some((f) => f.difficultyId === id);

    const added = await call(`/favorites/${id}`, { method: 'PUT' });
    ok('favoriting a real beatmap succeeds', added.status === 200, `got ${added.status}`);
    ok(
      'the row comes back with the metadata a card needs',
      added.body?.favorite?.title &&
        added.body?.favorite?.source === 'dz' &&
        Number.isFinite(added.body?.favorite?.stars),
      JSON.stringify(added.body?.favorite)
    );

    // A4's VERIFY: favoriting the same map twice must not create a second row.
    const again = await call(`/favorites/${id}`, { method: 'PUT' });
    const after = await call('/favorites');
    const rows = (Array.isArray(after.body) ? after.body : []).filter((f) => f.difficultyId === id);
    ok('favoriting twice does not create a second row', again.status === 200 && rows.length === 1, `${rows.length} rows`);

    // A graveyard map is a legitimate favorite even though it cannot be submitted — the
    // ranked-status rule belongs to the submit path, not to what somebody may like.
    const graveyard = await call('/favorites/75', { method: 'PUT' });
    ok(
      'an unsubmittable beatmap can still be favorited',
      graveyard.status === 200,
      `got ${graveyard.status}: ${JSON.stringify(graveyard.body)}`
    );
    if (graveyard.status === 200) await call('/favorites/75', { method: 'DELETE' });

    if (!started) {
      const gone = await call(`/favorites/${id}`, { method: 'DELETE' });
      ok('unfavoriting removes it, leaving the list as it was', gone.status === 200, `got ${gone.status}`);
    } else {
      skipped('the unfavorite step', 'that beatmap was already favorited before this run');
    }
  } else {
    skipped('the favorite round trip', 'it writes favorites — pass --allow-writes');
  }
}

console.log('');
console.log('--- osu! favorites import (A5) ---');
if (allowWrites) {
  // A community favorite planted first, so the import can be shown not to disturb it —
  // which is the A4 decision this item is most able to break.
  const planted = 4907876;
  await call(`/favorites/${planted}`, { method: 'PUT' });

  const first = await call('/favorites/import', { method: 'POST' });
  ok(
    'POST /favorites/import succeeds with the app token alone',
    first.status === 200 && Number.isFinite(first.body?.imported),
    `got ${first.status}: ${JSON.stringify(first.body).slice(0, 160)}`
  );

  const rows = Array.isArray(first.body?.favorites) ? first.body.favorites : [];
  const dz = rows.filter((f) => f.source === 'dz');
  const osu = rows.filter((f) => f.source === 'osu');

  ok(
    'the community favorite is still there, untouched',
    dz.some((f) => f.difficultyId === planted),
    JSON.stringify(dz.map((f) => f.difficultyId))
  );
  ok(
    'imported rows are tagged as osu! favorites',
    osu.every((f) => f.source === 'osu'),
    `${osu.length} imported rows`
  );
  if (osu.length === 0) {
    console.log('      note: this account has no osu! favourites, so the import had nothing to add.');
  }

  const second = await call('/favorites/import', { method: 'POST' });
  const after = Array.isArray(second.body?.favorites) ? second.body.favorites : [];
  ok(
    'importing twice does not duplicate rows',
    second.status === 200 && after.length === rows.length,
    `${rows.length} then ${after.length}`
  );

  // One row per (difficulty, source) is the primary key; this proves the read agrees.
  const keys = after.map((f) => `${f.source}:${f.difficultyId}`);
  ok('every favorite is unique on source and difficulty', new Set(keys).size === keys.length, `${keys.length} rows`);

  await call(`/favorites/${planted}`, { method: 'DELETE' });
} else {
  skipped('the osu! favorites import', 'it writes favorites — pass --allow-writes');
}

console.log('\n--- rate limiting ---');
if (allowWrites) {
  // 25 lookups of the same beatmap: the limit is 20 a minute, so the tail must be 429.
  let limited = false;
  for (let i = 0; i < 25; i++) {
    const res = await call('/submissions/lookup', {
      method: 'POST',
      body: JSON.stringify({ url: '131891' }),
    });
    if (res.status === 429) {
      limited = true;
      break;
    }
  }
  ok('POST /submissions/lookup answers 429 past its limit', limited, 'never hit the limit in 25 tries');
  console.log('      note: your lookup allowance is now spent for up to a minute.');
} else {
  skipped('the rate-limit check', 'it makes 25 lookup requests — pass --allow-writes to run it');
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail === 0 ? 0 : 1);
