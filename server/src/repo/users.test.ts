import { describe, expect, it } from 'vitest';
import { isCountryCode, normalise } from './allowedCountries.js';
import { isEligible, type UserRow } from './users.js';

const user = (country: string): UserRow => ({
  id: 1,
  osu_id: '4907876',
  username: 'someone',
  country_code: country,
  avatar_url: null,
  global_rank: null,
  is_admin: false,
});

/** What repo/allowedCountries.ts enabledSet() hands over: normalised, upper case. */
const allowlist = (...codes: string[]) => new Set(codes);

describe('isEligible', () => {
  it('accepts a country that is on the allowlist', () => {
    expect(isEligible(user('DZ'), allowlist('DZ'))).toBe(true);
  });

  // country_code is char(2), which Postgres blank-pads, and osu! is not guaranteed to
  // send it uppercase. Both of those bit this rule once, hence the trim and the fold.
  it('tolerates padding and case, because the column and the API both vary', () => {
    expect(isEligible(user('dz'), allowlist('DZ'))).toBe(true);
    expect(isEligible(user(' DZ '), allowlist('DZ'))).toBe(true);
    expect(isEligible(user('dz  '), allowlist('DZ'))).toBe(true);
  });

  it('refuses a country that is not on it', () => {
    expect(isEligible(user('FR'), allowlist('DZ'))).toBe(false);
    expect(isEligible(user('TN'), allowlist('DZ'))).toBe(false);
    expect(isEligible(user(''), allowlist('DZ'))).toBe(false);
  });

  // The whole point of C4: a second country is a row, not a code change.
  it('accepts any of several enabled countries', () => {
    const enabled = allowlist('DZ', 'TN', 'MA');
    expect(isEligible(user('TN'), enabled)).toBe(true);
    expect(isEligible(user('ma'), enabled)).toBe(true);
    expect(isEligible(user('EG'), enabled)).toBe(false);
  });

  // An administrator disabling everything is a legitimate way to pause participation, so
  // it has to refuse everyone rather than fall back to a hardcoded country.
  it('refuses everyone when nothing is enabled', () => {
    expect(isEligible(user('DZ'), allowlist())).toBe(false);
  });
});

describe('allowedCountries helpers', () => {
  it('normalises the way isEligible does, so the two cannot disagree', () => {
    expect(normalise('dz')).toBe('DZ');
    expect(normalise(' DZ ')).toBe('DZ');
    // char(2) blank-pads, so a value read back out of the column arrives padded.
    expect(normalise('dz  ')).toBe('DZ');
  });

  it('accepts only two ASCII letters as a country code', () => {
    expect(isCountryCode('DZ')).toBe(true);
    expect(isCountryCode('tn')).toBe(true);
    expect(isCountryCode(' MA ')).toBe(true);
    expect(isCountryCode('DZA')).toBe(false);
    expect(isCountryCode('D')).toBe(false);
    expect(isCountryCode('D1')).toBe(false);
    expect(isCountryCode('')).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
    expect(isCountryCode(12)).toBe(false);
  });
});
