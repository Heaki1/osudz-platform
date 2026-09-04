// rounds table access.
//
// Exactly one round is "open" at a time: 001_core.sql enforces that with a
// partial unique index on (phase <> 'ended'), so findCurrent() can only ever
// match a single row. Ending a round and opening the next are therefore two
// separate steps — PATCH the phase to 'ended', then POST a new round — because
// a single row cannot be both.

import { pool } from '../db.js';

export type RoundPhase = 'submission' | 'voting' | 'challenge' | 'ended';

/**
 * How far the round's winner has got. 'none' while voting runs; 'pending' once
 * voting closed with one clear leader; 'tiebreak' once it closed level; 'official'
 * once an administrator approved it, after which it never moves again.
 *
 * The phase stays 'voting' through pending and tiebreak, so this — not the phase —
 * is what closes the ballot. See migrations/004_round_winner.sql.
 */
export type WinnerStatus = 'none' | 'pending' | 'tiebreak' | 'official';

/** Phases a round can be in while still open. Mirrors Phase in src/types.ts. */
export const LIVE_PHASES = ['submission', 'voting', 'challenge'] as const;
export type LivePhase = (typeof LIVE_PHASES)[number];

const ALL_PHASES: readonly string[] = [...LIVE_PHASES, 'ended'];

export function isRoundPhase(value: unknown): value is RoundPhase {
  return typeof value === 'string' && ALL_PHASES.includes(value);
}

/**
 * Where a round may go from each phase. A round only ever moves forward, and
 * ending it is legal from anywhere — a round nobody submitted to should not have
 * to be walked through voting and challenge before it can be closed.
 *
 * Staying in the same phase counts as legal because PATCH /round/phase is also
 * how a deadline gets rewritten.
 *
 * isRoundPhase only ever checked that a phase name exists, so 'challenge' back to
 * 'submission' was accepted. Votes cast in the meantime keep counting, so a round
 * could be reopened, voted in again, and advanced with a tally nobody expected —
 * and once a winner is recorded, a backwards move would contradict it outright.
 *
 * voting -> challenge is deliberately absent. That move is what approving a winner
 * does (approveWinner below), and leaving it here would let the phase endpoint walk
 * straight past the approval it is supposed to require.
 */
const NEXT_PHASES: Record<RoundPhase, readonly RoundPhase[]> = {
  submission: ['voting', 'ended'],
  voting: ['ended'],
  challenge: ['ended'],
  ended: [],
};

export const canTransition = (from: RoundPhase, to: RoundPhase): boolean =>
  from === to || NEXT_PHASES[from].includes(to);

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
  winner_status: WinnerStatus;
  winning_submission_id: number | null;
  winner_vote_count: number | null;
  total_votes: number | null;
  winner_approved_by: number | null;
  winner_approved_at: Date | null;
}

const COLUMNS = `id, round_number, phase, month, year, reward,
                 submission_ends_at, voting_ends_at, challenge_ends_at,
                 winner_status, winning_submission_id, winner_vote_count,
                 total_votes, winner_approved_by, winner_approved_at`;

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

// ── Closing the ballot and approving a winner ────────────────────────────────

export type CloseVotingOutcome =
  | { ok: true; round: RoundRow; tied: number[] }
  | { ok: false; reason: 'not-voting' | 'already-closed' | 'no-entries' };

/**
 * Closes the ballot and records the outcome, in one transaction.
 *
 * Counting, freezing and setting the status have to land together. routes/votes.ts
 * refuses to cast or retract once winner_status leaves 'none', so any gap between
 * reading the tally and writing it is a window in which a vote could slip in behind
 * the count that was just taken. The row is locked FOR UPDATE for the same reason:
 * two administrators closing at the same moment must not both compute a winner.
 *
 * Only approved entries of this round are counted. Nothing in the schema ties a
 * vote's submission to its round, and a submission rejected after votes were cast
 * for it keeps them — docs/todo.txt: a validly cast vote is counted permanently, so
 * the tally is not re-filtered by who is still eligible or what is still approved.
 * It counts what was cast, against the entries that were in the ballot.
 */
export async function closeVoting(roundId: number): Promise<CloseVotingOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: locked } = await client.query<{ phase: RoundPhase; winner_status: WinnerStatus }>(
      `SELECT phase, winner_status FROM rounds WHERE id = $1 FOR UPDATE`,
      [roundId]
    );
    const current = locked[0];
    if (!current || current.phase !== 'voting') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not-voting' };
    }
    if (current.winner_status !== 'none') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already-closed' };
    }

    const { rows: tally } = await client.query<{ submission_id: number; votes: number }>(
      `SELECT s.id AS submission_id, count(v.id)::int AS votes
         FROM submissions s
         LEFT JOIN votes v ON v.submission_id = s.id
        WHERE s.round_id = $1 AND s.status = 'approved'
        GROUP BY s.id
        ORDER BY votes DESC, s.id ASC`,
      [roundId]
    );

    if (tally.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'no-entries' };
    }

    const total = tally.reduce((sum, row) => sum + row.votes, 0);
    const top = tally[0].votes;
    // Entries level at the top. With no votes at all every entry is level on zero,
    // which is a tie like any other and goes to an administrator rather than to
    // whichever row the database happened to return first.
    const leaders = tally.filter((row) => row.votes === top);
    const tied = leaders.length > 1;

    const { rows: updated } = await client.query<RoundRow>(
      `UPDATE rounds
          SET winner_status = $2,
              winning_submission_id = $3,
              winner_vote_count = $4,
              total_votes = $5
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [roundId, tied ? 'tiebreak' : 'pending', tied ? null : leaders[0].submission_id, top, total]
    );

    if (tied) {
      for (const leader of leaders) {
        await client.query(
          `INSERT INTO round_tiebreak_entries (round_id, submission_id) VALUES ($1, $2)`,
          [roundId, leader.submission_id]
        );
      }
    }

    await client.query('COMMIT');
    return {
      ok: true,
      round: updated[0],
      tied: tied ? leaders.map((leader) => leader.submission_id) : [],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** The entries an administrator may choose between while the round is tied. */
export async function listTiebreakEntries(roundId: number): Promise<number[]> {
  const { rows } = await pool.query<{ submission_id: number }>(
    `SELECT submission_id FROM round_tiebreak_entries WHERE round_id = $1 ORDER BY submission_id`,
    [roundId]
  );
  return rows.map((row) => row.submission_id);
}

export type ApproveWinnerOutcome =
  | { ok: true; round: RoundRow }
  | { ok: false; reason: 'not-closed' | 'already-official' | 'needs-selection' | 'not-tied' };

/**
 * Makes the winner official and moves the round to its challenge phase, in one
 * transaction. This is the only path from voting to challenge — NEXT_PHASES does not
 * offer that move, so the generic phase endpoint cannot approve a winner by accident.
 *
 * On a tiebreak the caller must name which tied entry won. On a pending winner the
 * entry is already recorded, and naming a different one is refused rather than
 * quietly honoured.
 */
export async function approveWinner(
  roundId: number,
  adminUserId: number,
  submissionId?: number
): Promise<ApproveWinnerOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: locked } = await client.query<{
      winner_status: WinnerStatus;
      winning_submission_id: number | null;
    }>(`SELECT winner_status, winning_submission_id FROM rounds WHERE id = $1 FOR UPDATE`, [
      roundId,
    ]);
    const current = locked[0];
    if (!current || current.winner_status === 'none') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not-closed' };
    }
    if (current.winner_status === 'official') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already-official' };
    }

    let winner = current.winning_submission_id;

    if (current.winner_status === 'tiebreak') {
      if (submissionId === undefined) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'needs-selection' };
      }
      const { rows: candidate } = await client.query(
        `SELECT 1 FROM round_tiebreak_entries WHERE round_id = $1 AND submission_id = $2`,
        [roundId, submissionId]
      );
      if (candidate.length === 0) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'not-tied' };
      }
      winner = submissionId;
    } else if (submissionId !== undefined && submissionId !== winner) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not-tied' };
    }

    const { rows: updated } = await client.query<RoundRow>(
      `UPDATE rounds
          SET winner_status = 'official',
              winning_submission_id = $2,
              winner_approved_by = $3,
              winner_approved_at = now(),
              phase = 'challenge'
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [roundId, winner, adminUserId]
    );

    // The candidates existed only to be chosen between.
    await client.query(`DELETE FROM round_tiebreak_entries WHERE round_id = $1`, [roundId]);

    await client.query('COMMIT');
    return { ok: true, round: updated[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
    winnerStatus: row.winner_status,
    winningSubmissionId: row.winning_submission_id,
    winnerVoteCount: row.winner_vote_count,
    totalVotes: row.total_votes,
    winnerApprovedAt: row.winner_approved_at?.toISOString() ?? null,
  };
}
