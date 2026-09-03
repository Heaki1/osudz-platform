// osu! OAuth2 + API v2 client.
//
// Scopes: `identify` reads the signed-in account (GET /api/v2/me), `public` is
// needed later to look up beatmaps when submissions are wired. Nothing here
// touches the database or Express — it is just the outbound half.

import { env } from '../env.js';

const AUTHORIZE_URL = 'https://osu.ppy.sh/oauth/authorize';
const TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const API_BASE = 'https://osu.ppy.sh/api/v2';
const SCOPES = 'identify public';

/** The subset of the osu! User object this project reads. */
export interface OsuMe {
  id: number;
  username: string;
  country_code: string;
  avatar_url?: string | null;
  /** Present on /me because the token is the user's own. Restricted accounts are refused. */
  is_restricted?: boolean | null;
  statistics?: { global_rank?: number | null } | null;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.osuClientId,
    redirect_uri: env.osuRedirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges the callback code for an access token. Throws on any non-2xx. */
export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.osuClientId,
      client_secret: env.osuClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.osuRedirectUri,
    }),
  });

  if (!res.ok) {
    // Body is logged server-side only; it can name the misconfigured field
    // (usually a redirect_uri that does not match the registered one).
    throw new Error(`osu! token exchange failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('osu! token exchange returned no access_token');
  return body.access_token;
}

export async function fetchMe(accessToken: string): Promise<OsuMe> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`osu! GET /me failed: ${res.status}`);

  const me = (await res.json()) as OsuMe;
  if (!Number.isInteger(me.id) || !me.username) {
    throw new Error('osu! GET /me returned an unexpected shape');
  }
  return me;
}
