import { describe, expect, it } from 'vitest';
import { parseDifficultyId } from './osu.js';

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
