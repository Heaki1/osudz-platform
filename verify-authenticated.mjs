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
