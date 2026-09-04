import { describe, expect, it } from 'vitest';
import { canTransition, isRoundPhase } from './rounds.js';

describe('isRoundPhase', () => {
  it('accepts the four phases and nothing else', () => {
    for (const phase of ['submission', 'voting', 'challenge', 'ended']) {
      expect(isRoundPhase(phase)).toBe(true);
    }
    expect(isRoundPhase('archived')).toBe(false);
    expect(isRoundPhase('')).toBe(false);
    expect(isRoundPhase(undefined)).toBe(false);
    expect(isRoundPhase(2)).toBe(false);
  });
});

describe('canTransition', () => {
  it('moves a round forward one step', () => {
    expect(canTransition('submission', 'voting')).toBe(true);
  });

  // The rule the winner-approval gate depends on. voting -> challenge is deliberately
  // absent, because approving a winner is what performs that move: leaving it here
  // would let PATCH /round/phase walk straight past the approval it must require.
  it('refuses voting to challenge, which only approving a winner may do', () => {
    expect(canTransition('voting', 'challenge')).toBe(false);
  });

  it('lets a round be ended from anywhere', () => {
    expect(canTransition('submission', 'ended')).toBe(true);
    expect(canTransition('voting', 'ended')).toBe(true);
    expect(canTransition('challenge', 'ended')).toBe(true);
  });

  it('refuses every backwards move', () => {
    expect(canTransition('voting', 'submission')).toBe(false);
    expect(canTransition('challenge', 'voting')).toBe(false);
    expect(canTransition('challenge', 'submission')).toBe(false);
    expect(canTransition('ended', 'submission')).toBe(false);
    expect(canTransition('ended', 'challenge')).toBe(false);
  });

  it('allows staying put, which is how a deadline gets rewritten', () => {
    expect(canTransition('voting', 'voting')).toBe(true);
    expect(canTransition('ended', 'ended')).toBe(true);
  });
});
