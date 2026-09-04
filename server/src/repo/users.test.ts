import { describe, expect, it } from 'vitest';
import { ELIGIBLE_COUNTRY, isEligible, type UserRow } from './users.js';

const user = (country: string): UserRow => ({
  id: 1,
  osu_id: '4907876',
  username: 'someone',
  country_code: country,
  avatar_url: null,
  global_rank: null,
  is_admin: false,
});

describe('isEligible', () => {
  it('accepts the eligible country', () => {
    expect(isEligible(user(ELIGIBLE_COUNTRY))).toBe(true);
  });

  // country_code is char(2), which Postgres blank-pads, and osu! is not guaranteed to
  // send it uppercase. Both of those bit this rule once, hence the trim and the fold.
  it('tolerates padding and case, because the column and the API both vary', () => {
    expect(isEligible(user('dz'))).toBe(true);
    expect(isEligible(user(' DZ '))).toBe(true);
    expect(isEligible(user('dz  '))).toBe(true);
  });

  it('refuses every other country', () => {
    expect(isEligible(user('FR'))).toBe(false);
    expect(isEligible(user('TN'))).toBe(false);
    expect(isEligible(user(''))).toBe(false);
  });
});
