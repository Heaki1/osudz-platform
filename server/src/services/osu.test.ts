import { describe, expect, it } from 'vitest';
import {
  isSearchStatus,
  orderHits,
  parseDifficultyId,
  pickDifficulty,
  type OsuSearchHit,
} from './osu.js';

describe('parseDifficultyId', () => {
  it('accepts every osu! link shape a player might paste', () => {
    expect(parseDifficultyId('https://osu.ppy.sh/beatmapsets/41823#osu/131891')).toBe(131891);
    expect(parseDifficultyId('https://osu.ppy.sh/beatmapsets/41823/131891')).toBe(131891);
    expect(parseDifficultyId('https://osu.ppy.sh/beatmaps/131891')).toBe(131891);
    expect(parseDifficultyId('https://osu.ppy.sh/b/131891')).toBe(131891);
    expect(parseDifficultyId('131891')).toBe(131891);
    expect(parseDifficultyId('  131891  ')).toBe(131891);
  });

  it('reads the difficulty, not the set, when a link carries both', () => {
    expect(parseDifficultyId('https://osu.ppy.sh/beatmapsets/41823#taiko/131891')).toBe(131891);
  });

  // A submission is one difficulty. A set-only link does not name which, and guessing
  // would enter a beatmap the player did not choose.
  it('refuses a link that names only a beatmapset', () => {
    expect(parseDifficultyId('https://osu.ppy.sh/beatmapsets/41823')).toBeNull();
  });

  it('refuses anything that is not a link or an id', () => {
    expect(parseDifficultyId('')).toBeNull();
    expect(parseDifficultyId('Souzou Forest')).toBeNull();
    expect(parseDifficultyId('https://example.com/nope')).toBeNull();
  });
});

describe('pickDifficulty', () => {
  // A search card represents its set by the hardest difficulty. With a dozen
  // difficulties per set, one card each would bury every other result on the page.
  it('picks the highest star rating in the set', () => {
    const picked = pickDifficulty([
      { id: 1, difficulty_rating: 4.2 },
      { id: 2, difficulty_rating: 6.8 },
      { id: 3, difficulty_rating: 5.1 },
    ]);
    expect(picked?.id).toBe(2);
  });

  it('skips an entry with no usable id rather than picking it', () => {
    const picked = pickDifficulty([
      { difficulty_rating: 9.9 },
      { id: 5, difficulty_rating: 2 },
    ]);
    expect(picked?.id).toBe(5);
  });

  // A set that resolves to nothing is what makes the whole hit skippable, so this
  // returning null is load-bearing rather than defensive.
  it('is null when nothing in the set is usable', () => {
    expect(pickDifficulty([])).toBeNull();
    expect(pickDifficulty([{ difficulty_rating: 5 }])).toBeNull();
    expect(pickDifficulty(undefined)).toBeNull();
    expect(pickDifficulty('not an array')).toBeNull();
  });

  // A difficulty with no star rating cannot fill a card — OsuSearchHit requires one —
  // so it is not a candidate for representing the set. Tolerating it here would only
  // move the rejection into toSearchHit.
  it('skips a difficulty that reports no star rating', () => {
    expect(pickDifficulty([{ id: 11 }, { id: 12 }])).toBeNull();
    expect(pickDifficulty([{ id: 11 }, { id: 12, difficulty_rating: 3.3 }])?.id).toBe(12);
  });
});

describe('isSearchStatus', () => {
  it('accepts any, and the three statuses a submission may use', () => {
    expect(isSearchStatus('any')).toBe(true);
    expect(isSearchStatus('ranked')).toBe(true);
    expect(isSearchStatus('loved')).toBe(true);
    expect(isSearchStatus('approved')).toBe(true);
  });

  // The route answers 400 on these. Search offers what can be entered, so a status
  // the submit path refuses is not a narrower search but a misleading one.
  it('refuses statuses the submit path would refuse', () => {
    expect(isSearchStatus('qualified')).toBe(false);
    expect(isSearchStatus('graveyard')).toBe(false);
    expect(isSearchStatus('pending')).toBe(false);
    expect(isSearchStatus('')).toBe(false);
    expect(isSearchStatus(undefined)).toBe(false);
  });
});

describe('orderHits', () => {
  const hit = (stars: number, bpm: number): OsuSearchHit => ({
    difficultyId: Math.round(stars * 100),
    beatmapsetId: 1,
    title: 'title',
    artist: 'artist',
    mapper: 'mapper',
    difficultyName: 'Expert',
    mapStatus: 'ranked',
    coverUrl: '',
    previewUrl: '',
    stars,
    bpm,
    lengthSeconds: 120,
    difficultyCount: 1,
  });

  it('orders by stars, hardest first', () => {
    const ordered = orderHits([hit(4, 200), hit(7, 150), hit(5.5, 180)], 'stars');
    expect(ordered.map((h) => h.stars)).toEqual([7, 5.5, 4]);
  });

  // osu! search cannot sort by BPM at all, so this ordering is the only one there is
  // and it covers the page that came back rather than every match.
  it('orders by bpm, fastest first', () => {
    const ordered = orderHits([hit(4, 200), hit(7, 150), hit(5.5, 180)], 'bpm');
    expect(ordered.map((h) => h.bpm)).toEqual([200, 180, 150]);
  });

  it('leaves the array it was given alone', () => {
    const hits = [hit(4, 200), hit(7, 150)];
    orderHits(hits, 'stars');
    expect(hits.map((h) => h.stars)).toEqual([4, 7]);
  });
});
