import { describe, expect, it } from 'vitest';
import { orderFor, qualifies, splitMods } from './challengeScores.js';

describe('splitMods', () => {
  it('reads a no-mod play as no mods, however it was written', () => {
    expect(splitMods('NM')).toEqual([]);
    expect(splitMods('')).toEqual([]);
    expect(splitMods('  nm ')).toEqual([]);
  });

  it('splits joined acronyms, which are always two characters', () => {
    expect(splitMods('HD')).toEqual(['HD']);
    expect(splitMods('HDHR')).toEqual(['HD', 'HR']);
    expect(splitMods('HDDT')).toEqual(['HD', 'DT']);
    expect(splitMods('hrdt')).toEqual(['HR', 'DT']);
  });

  // osu! attaches CL to plays set under the old scoring model. It is a scoring mode
  // rather than a gameplay mod, and counting it would make every classic play fail a
  // no-mod requirement for a reason no player would recognise.
  it('ignores the Classic marker', () => {
    expect(splitMods('CL')).toEqual([]);
    expect(splitMods('HDCL')).toEqual(['HD']);
  });
});

describe('qualifies', () => {
  const play = (mods: string, misses = 0) => ({ mods, misses });

  it('requires an empty mod list when the round asks for no mods', () => {
    expect(qualifies(play('NM'), { modRequirement: 'NM', challengeRequirement: 'Top #1 Score' })).toBe(true);
    expect(qualifies(play('HD'), { modRequirement: 'NM', challengeRequirement: 'Top #1 Score' })).toBe(false);
  });

  it('requires every named mod, and tolerates extras beyond them', () => {
    expect(qualifies(play('HDHR'), { modRequirement: 'HD', challengeRequirement: 'Top #1 Score' })).toBe(true);
    expect(qualifies(play('HD'), { modRequirement: 'HDHR', challengeRequirement: 'Top #1 Score' })).toBe(false);
    expect(qualifies(play('HRHD'), { modRequirement: 'HDHR', challengeRequirement: 'Top #1 Score' })).toBe(true);
  });

  // 'Full Combo' is the only challenge requirement a single play can be judged against.
  it('checks a full combo by misses, the one absolute requirement', () => {
    expect(qualifies(play('NM', 0), { modRequirement: 'NM', challengeRequirement: 'Full Combo' })).toBe(true);
    expect(qualifies(play('NM', 1), { modRequirement: 'NM', challengeRequirement: 'Full Combo' })).toBe(false);
  });

  // The other three are relative — decided by comparing every play in the round — so a
  // play with the right mods counts, and the leaderboard's order settles who won.
  it('lets a play with the right mods count for the relative requirements', () => {
    for (const requirement of ['Top #1 Score', 'Best Accuracy', 'Lowest Miss Count']) {
      expect(
        qualifies(play('HD', 12), { modRequirement: 'HD', challengeRequirement: requirement })
      ).toBe(true);
    }
  });

  it('refuses the wrong mods whatever the challenge requirement', () => {
    expect(
      qualifies(play('EZ', 0), { modRequirement: 'HD', challengeRequirement: 'Full Combo' })
    ).toBe(false);
  });
});

describe('orderFor', () => {
  it('puts the relative requirements in the order rather than in a flag', () => {
    expect(orderFor('Best Accuracy')).toContain('accuracy DESC');
    expect(orderFor('Lowest Miss Count')).toContain('misses ASC');
  });

  it('falls back to score descending, which the existing index covers', () => {
    expect(orderFor('Top #1 Score')).toContain('score DESC');
    expect(orderFor('Full Combo')).toContain('score DESC');
    expect(orderFor('')).toContain('score DESC');
  });
});
