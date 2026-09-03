// The open round, as the UI sees it.
//
// One narrowing point for the whole app: the server's ApiRound carries four
// phases and three scheduled end timestamps, while every component wants a live
// Phase and a single "ends in" value. toCurrentRound collapses that, so no
// component has to remember which of the three timestamps applies.

import { useEffect, useState } from 'react';
import { ApiRound } from '../api/client';
import { Phase } from '../types';

export interface CurrentRound {
  id: number;
  roundNumber: number;
  /** Never 'ended' — an ended round is not current, so it reads as null. */
  phase: Phase;
  month: string;
  year: number;
  /** '' when the round has no reward set. */
  reward: string;
  /** Scheduled end of the phase the round is in, ISO 8601, or null if unscheduled. */
  endsAt: string | null;
  /** All three scheduled ends, for the admin schedule view. */
  schedule: Record<Phase, string | null>;
}

const LIVE_PHASES: readonly Phase[] = ['submission', 'voting', 'challenge'];

const isLivePhase = (phase: ApiRound['phase']): phase is Phase =>
  (LIVE_PHASES as readonly string[]).includes(phase);

/**
 * GET /api/rounds/current only ever returns a non-ended round, so the 'ended'
 * branch is unreachable in practice — but the DTO allows it, and treating it as
 * "no current round" is the honest reading rather than a cast.
 */
export function toCurrentRound(round: ApiRound | null): CurrentRound | null {
  if (!round || !isLivePhase(round.phase)) return null;

  const schedule: Record<Phase, string | null> = {
    submission: round.submissionEndsAt,
    voting: round.votingEndsAt,
    challenge: round.challengeEndsAt,
  };

  return {
    id: round.id,
    roundNumber: round.roundNumber,
    phase: round.phase,
    month: round.month,
    year: round.year,
    reward: round.reward,
    endsAt: schedule[round.phase],
    schedule,
  };
}

/** "Round 3 · August 2026", or a placeholder when nothing is running. */
export const roundLabel = (round: CurrentRound | null): string =>
  round ? `Round ${round.roundNumber} · ${round.month} ${round.year}` : 'No active round';

/** An absolute deadline, for the admin schedule view. */
export const formatDeadline = (endsAt: string | null): string =>
  endsAt
    ? new Date(endsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'not scheduled';

/**
 * "2d 14h", "18h 04m", "12m", "ended" once the deadline passes, or "—" when the
 * phase has no scheduled end.
 */
export function formatCountdown(endsAt: string | null | undefined, now = Date.now()): string {
  if (!endsAt) return '—';

  const remaining = new Date(endsAt).getTime() - now;
  if (Number.isNaN(remaining)) return '—';
  if (remaining <= 0) return 'ended';

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

/** formatCountdown that re-renders as the deadline approaches. */
export function useCountdown(endsAt: string | null | undefined): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return formatCountdown(endsAt, now);
}
