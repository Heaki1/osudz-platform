// Discord announcements.
//
// DISCORD_WEBHOOK was declared in .env.example for "phase / winner announcements" and
// read by nothing, which is a trap for the next person: a configured-looking variable
// that does nothing looks like a broken integration rather than an absent one.
//
// Everything here is fire-and-forget and swallows its own failures. An announcement is
// a courtesy, and Discord being slow or down must never fail the write that triggered
// it — an administrator approving a winner cannot be told the approval failed because a
// webhook timed out. Unset webhook means silence, which is the supported configuration.

const WEBHOOK = process.env.DISCORD_WEBHOOK?.trim() ?? '';

/** Whether announcements are configured at all. Exported so callers can skip the work. */
export const announcementsEnabled = (): boolean => WEBHOOK !== '';

/**
 * Posts one line to the configured channel. Never throws and never resolves to an
 * error: the caller does not wait on it and has nothing to do about a failure.
 */
export function announce(content: string): void {
  if (WEBHOOK === '') return;

  // Not awaited on purpose. The catch is what keeps an unhandled rejection out of the
  // process when the webhook is unreachable.
  void fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // allowed_mentions none: a round announcement should never ping a whole server.
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  }).catch((err: unknown) => {
    console.error('[discord] announcement failed:', err instanceof Error ? err.message : err);
  });
}

/** "Round 4 · September 2026" — the same label the client shows. */
const label = (round: { round_number: number; month: string; year: number }): string =>
  `Round ${round.round_number} · ${round.month} ${round.year}`;

export function announcePhase(
  round: { round_number: number; month: string; year: number },
  phase: string,
  automatic: boolean
): void {
  const how = automatic ? 'on schedule' : 'by an administrator';
  const line =
    phase === 'voting'
      ? `🗳️ **${label(round)}** — submissions are closed and voting is open (${how}).`
      : phase === 'challenge'
        ? `🎮 **${label(round)}** — the winner is official and the challenge has begun.`
        : phase === 'ended'
          ? `📦 **${label(round)}** — the round is over and has been archived (${how}).`
          : `**${label(round)}** — now in the ${phase} phase (${how}).`;
  announce(line);
}

export function announceBallotClosed(
  round: { round_number: number; month: string; year: number },
  outcome: { tied: number[]; votes: number | null; total: number | null }
): void {
  const tally =
    outcome.votes === null
      ? ''
      : ` on ${outcome.votes}${outcome.total === null ? '' : ` of ${outcome.total}`} votes`;

  announce(
    outcome.tied.length > 1
      ? `⚖️ **${label(round)}** — voting has closed and ${outcome.tied.length} entries are level${tally}. An administrator will pick the winner.`
      : `🔒 **${label(round)}** — voting has closed${tally}. The winner is awaiting approval.`
  );
}

export function announceWinner(
  round: { round_number: number; month: string; year: number },
  winner: { title: string; artist: string; difficulty_name: string; submitted_by_name: string } | null
): void {
  announce(
    winner
      ? `👑 **${label(round)}** — the winner is **${winner.artist} - ${winner.title} [${winner.difficulty_name}]**, submitted by ${winner.submitted_by_name}. The challenge starts now.`
      : `👑 **${label(round)}** — a winner has been approved and the challenge starts now.`
  );
}
