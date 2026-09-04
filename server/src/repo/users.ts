// users table access.
//
// Note on osu_id: the column is bigint, and node-postgres returns bigint as a
// string to avoid silent precision loss. Every read therefore converts
// explicitly — do not assume row.osu_id is a number.

import { pool } from '../db.js';
import { env } from '../env.js';
import type { OsuMe } from '../services/osu.js';

export interface UserRow {
  id: number;
  osu_id: string;
  username: string;
  country_code: string;
  avatar_url: string | null;
  global_rank: number | null;
  is_admin: boolean;
}

const COLUMNS = 'id, osu_id, username, country_code, avatar_url, global_rank, is_admin';

/** ISO 3166-1 alpha-2 of the community this platform serves. */
export const ELIGIBLE_COUNTRY = 'DZ';

/**
 * Whether this account may submit and vote. docs/my_plan.txt: Algerian players may
 * submit and vote, everyone else may read and comment.
 *
 * The rule lives here, beside toApiUser, so that middleware/auth.ts's gate and the
 * canVote flag the client reads are the same sentence rather than two copies that
 * drift. country_code is char(2) and Postgres blank-pads it, hence the trim.
 * Administrator-granted exceptions for diaspora players are specified in
 * docs/my_plan.txt too but have no table yet, so today the osu! profile country is
 * the whole rule.
 */
export const isEligible = (row: UserRow): boolean =>
  row.country_code.trim().toUpperCase() === ELIGIBLE_COUNTRY;

/**
 * Creates the user on first login and refreshes the mutable fields on every
 * later login. Admin status is derived from ADMIN_OSU_IDS each time, so granting
 * or revoking admin is an env change plus a re-login, not a manual UPDATE.
 */
export async function upsertFromOsu(me: OsuMe): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (osu_id, username, country_code, avatar_url, global_rank, is_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (osu_id) DO UPDATE SET
       username     = EXCLUDED.username,
       country_code = EXCLUDED.country_code,
       avatar_url   = EXCLUDED.avatar_url,
       global_rank  = EXCLUDED.global_rank,
       is_admin     = EXCLUDED.is_admin,
       updated_at   = now()
     RETURNING ${COLUMNS}`,
    [
      me.id,
      me.username,
      me.country_code,
      me.avatar_url ?? null,
      me.statistics?.global_rank ?? null,
      env.adminOsuIds.includes(me.id),
    ]
  );
  return rows[0];
}

export async function findByOsuId(osuId: number): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${COLUMNS} FROM users WHERE osu_id = $1`,
    [osuId]
  );
  return rows[0] ?? null;
}

/** Maps a row to the ApiUser DTO declared in src/api/client.ts. */
export function toApiUser(row: UserRow) {
  return {
    id: row.id,
    osuId: Number(row.osu_id),
    username: row.username,
    country: row.country_code.trim(),
    avatarUrl: row.avatar_url ?? '',
    globalRank: row.global_rank,
    isAdmin: row.is_admin,
    canVote: isEligible(row),
  };
}
