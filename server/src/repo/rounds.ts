// rounds table access.
//
// Exactly one round is "open" at a time: 001_core.sql enforces that with a
// partial unique index on (phase <> 'ended'), so findCurrent() can only ever
// match a single row. Ending a round and opening the next are therefore two
// separate steps — PATCH the phase to 'ended', then POST a new round — because
// a single row cannot be both.

import { pool } from '../db.js';

export type RoundPhase = 'submission' | 'voting' | 'challenge' | 'ended';

/** Phases a round can be in while still open. Mirrors Phase in src/types.ts. */
export const LIVE_PHASES = ['submission', 'voting', 'challenge'] as const;
export type LivePhase = (typeof LIVE_PHASES)[number];

const ALL_PHASES: readonly string[] = [...LIVE_PHASES, 'ended'];

export function isRoundPhase(value: unknown): value is RoundPhase {
  return typeof value === 'string' && ALL_PHASES.includes(value);
}

/** The column holding each live phase's scheduled end. */
const END_COLUMN: Record<LivePhase, string> = {
  submission: 'submission_ends_at',
  voting: 'voting_ends_at',
  challenge: 'challenge_ends_at',
};

export interface RoundRow {
  id: number;
  round_number: number;
  phase: RoundPhase;
  month: string;
  year: number;
  reward: string | null;
  submission_ends_at: Date | null;
  voting_ends_at: Date | null;
  challenge_ends_at: Date | null;
}

const COLUMNS = `id, round_number, phase, month, year, reward,
                 submission_ends_at, voting_ends_at, challenge_ends_at`;

export async function findCurrent(): Promise<RoundRow | null> {
  const { rows } = await pool.query<RoundRow>(
    `SELECT ${COLUMNS} FROM rounds WHERE phase <> 'ended' ORDER BY round_number DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function listAll(): Promise<RoundRow[]> {
  const { rows } = await pool.query<RoundRow>(
    `SELECT ${COLUMNS} FROM rounds ORDER BY round_number DESC`
  );
  return rows;
}

export async function findById(id: number): Promise<RoundRow | null> {
  const { rows } = await pool.query<RoundRow>(`SELECT ${COLUMNS} FROM rounds WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export interface NewRound {
  month: string;
  year: number;
  reward: string | null;
  submissionEndsAt: Date | null;
  votingEndsAt: Date | null;
  challengeEndsAt: Date | null;
}

/**
 * round_number is allocated inside the INSERT rather than by a preceding SELECT,
 * so two concurrent creates cannot read the same maximum. If they collide anyway
 * the UNIQUE constraint rejects the loser, which the route maps to 409.
 */
export async function create(round: NewRound): Promise<RoundRow> {
  const { rows } = await pool.query<RoundRow>(
    `INSERT INTO rounds
       (round_number, phase, month, year, reward,
        submission_ends_at, voting_ends_at, challenge_ends_at)
     SELECT COALESCE(MAX(round_number), 0) + 1, 'submission', $1, $2, $3, $4, $5, $6
       FROM rounds
     RETURNING ${COLUMNS}`,
    [
      round.month,
      round.year,
      round.reward,
      round.submissionEndsAt,
      round.votingEndsAt,
      round.challengeEndsAt,
    ]
  );
  return rows[0];
}

/**
 * Moves one round to another phase. `endsAt` is optional: pass it to also rewrite
 * the new phase's scheduled end (an admin advancing early or late), omit it to
 * keep the schedule laid down when the round was created. Omitting it after a
 * late advance leaves a countdown that has already run out — visible, but stale.
 */
export async function setPhase(
  id: number,
  phase: RoundPhase,
  endsAt?: Date | null
): Promise<RoundRow | null> {
  if (endsAt === undefined || phase === 'ended') {
    const { rows } = await pool.query<RoundRow>(
      `UPDATE rounds SET phase = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, phase]
    );
    return rows[0] ?? null;
  }

  // The column name comes from a fixed lookup on an already-validated phase,
  // never from request text.
  const { rows } = await pool.query<RoundRow>(
    `UPDATE rounds SET phase = $2, ${END_COLUMN[phase]} = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, phase, endsAt]
  );
  return rows[0] ?? null;
}

/** Maps a row to the ApiRound DTO declared in src/api/client.ts. */
export function toApiRound(row: RoundRow) {
  return {
    id: row.id,
    roundNumber: row.round_number,
    phase: row.phase,
    month: row.month,
    year: row.year,
    reward: row.reward ?? '',
    submissionEndsAt: row.submission_ends_at?.toISOString() ?? null,
    votingEndsAt: row.voting_ends_at?.toISOString() ?? null,
    challengeEndsAt: row.challenge_ends_at?.toISOString() ?? null,
  };
}
