// votes table access.
//
// One row per user per round. votes_one_per_user_per_round is the natural key, so
// changing a vote is an UPDATE of the row that is already there rather than a
// second insert — migrations/001_core.sql:98 states that outright.
//
// Nothing here writes a counter. Tallies are derived with COUNT(*) in
// repo/submissions.ts so the two can never drift apart, which means casting a vote
// touches this table and nothing else.

import { pool } from '../db.js';

export interface VoteRow {
  id: number;
  round_id: number;
  user_id: number;
  submission_id: number;
  created_at: Date;
}

const COLUMNS = 'id, round_id, user_id, submission_id, created_at';

export async function findByUserAndRound(
  userId: number,
  roundId: number
): Promise<VoteRow | null> {
  const { rows } = await pool.query<VoteRow>(
    `SELECT ${COLUMNS} FROM votes WHERE user_id = $1 AND round_id = $2`,
    [userId, roundId]
  );
  return rows[0] ?? null;
}

/**
 * Casts a vote, or moves an existing one onto another submission.
 *
 * The upsert *is* the one-vote rule: the unique constraint makes a second row
 * impossible, and DO UPDATE turns "change my vote" into one statement with no
 * read-modify-write race between two tabs.
 *
 * A change keeps the original created_at — votes has no updated_at column, so when
 * someone last moved their vote is not recorded anywhere.
 */
export async function cast(
  roundId: number,
  userId: number,
  submissionId: number
): Promise<VoteRow> {
  const { rows } = await pool.query<VoteRow>(
    `INSERT INTO votes (round_id, user_id, submission_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (round_id, user_id) DO UPDATE SET
       submission_id = EXCLUDED.submission_id
     RETURNING ${COLUMNS}`,
    [roundId, userId, submissionId]
  );
  return rows[0];
}

/** True when a vote was removed, false when there was nothing to remove. */
export async function retract(userId: number, roundId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM votes WHERE user_id = $1 AND round_id = $2`,
    [userId, roundId]
  );
  return (rowCount ?? 0) > 0;
}
