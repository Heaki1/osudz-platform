// Session and OAuth-state cookies, signed with SESSION_SECRET.
//
// No session table and no session library: the cookie carries the osu! id and an
// expiry, HMAC-signed so it cannot be forged. That is enough for a site where a
// session grants one vote per month, and it is reversible — swapping in
// server-side sessions later only changes this file.
//
// The state cookie implements the OAuth CSRF check: the same nonce goes out as
// the `state` parameter and comes back in the cookie, and the callback refuses
// to proceed unless they match.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from './env.js';

const SESSION_COOKIE = 'osudz_session';
const STATE_COOKIE = 'osudz_oauth_state';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** base64url — deliberately contains no '.', so it is safe as a field separator. */
function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

function equal(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function seal(payload: string): string {
  return `${payload}.${sign(payload)}`;
}

function unseal(token: string | undefined): string | null {
  if (!token) return null;
  const cut = token.lastIndexOf('.');
  if (cut <= 0) return null;
  const payload = token.slice(0, cut);
  return equal(token.slice(cut + 1), sign(payload)) ? payload : null;
}

/** Reads one cookie off the raw header — avoids a cookie-parser dependency. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/** sameSite 'lax' so the cookie survives the top-level redirect back from osu!. */
function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env.isProduction, path: '/' };
}

export function setSession(res: Response, osuId: number): void {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.cookie(SESSION_COOKIE, seal(`${osuId}.${expiresAt}`), {
    ...cookieOptions(),
    maxAge: SESSION_TTL_MS,
  });
}

/** The signed-in osu! id, or null when there is no valid unexpired session. */
export function readSession(req: Request): number | null {
  const payload = unseal(readCookie(req, SESSION_COOKIE));
  if (!payload) return null;
  const [rawId, rawExpiry] = payload.split('.');
  const osuId = Number(rawId);
  const expiresAt = Number(rawExpiry);
  if (!Number.isInteger(osuId) || osuId <= 0) return null;
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return osuId;
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function issueState(res: Response): string {
  const nonce = randomBytes(16).toString('base64url');
  res.cookie(STATE_COOKIE, seal(nonce), { ...cookieOptions(), maxAge: STATE_TTL_MS });
  return nonce;
}

/** Single-use: clears the cookie whether or not it matched. */
export function consumeState(req: Request, res: Response, provided: unknown): boolean {
  const expected = unseal(readCookie(req, STATE_COOKIE));
  res.clearCookie(STATE_COOKIE, cookieOptions());
  return typeof provided === 'string' && expected !== null && equal(provided, expected);
}
