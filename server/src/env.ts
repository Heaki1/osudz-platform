// Environment validation.
//
// Anything security-relevant is required at boot rather than defaulted, so a
// blank .env fails loudly instead of quietly signing sessions with undefined.

import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL  ${name} is not set. Copy server/.env.example to server/.env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const env = {
  sessionSecret: required('SESSION_SECRET'),
  osuClientId: required('OSU_CLIENT_ID'),
  osuClientSecret: required('OSU_CLIENT_SECRET'),
  /** Must match the callback URL registered on the osu! OAuth application exactly. */
  osuRedirectUri: required('OSU_REDIRECT_URI'),
  /** Where the SPA lives — the callback redirects back here when login completes. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:8443',
  /** osu! account ids granted admin access. Re-evaluated on every login. */
  adminOsuIds: (process.env.ADMIN_OSU_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0),
  isProduction: process.env.NODE_ENV === 'production',
} as const;
