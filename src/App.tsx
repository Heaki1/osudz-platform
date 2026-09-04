import React, { useCallback, useEffect, useState } from 'react';
import { NavHeader, AuthUser } from './components/platform/NavHeader';
import { DashboardPage } from './components/platform/DashboardPage';
import { VotePage } from './components/platform/VotePage';
import { SearchPage } from './components/platform/SearchPage';
import { AdminDashboard } from './components/platform/AdminDashboard';
import { PlatformSubmitPage } from './components/platform/PlatformSubmitPage';
import { ArchivePage } from './components/platform/ArchivePage';
import { api, ApiChallengeScore, ApiSubmission, ApiUser } from './api/client';
import { CurrentRound, toCurrentRound } from './lib/round';
import { toBeatmap } from './lib/submission';
import { Beatmap, Phase, PlatformPage } from './types';

type PlayState = { id: string; progress: number; audio?: HTMLAudioElement };

const toAuthUser = (u: ApiUser): AuthUser => ({
  id: u.id,
  username: u.username,
  rank: u.globalRank,
  country: u.country,
  isAdmin: u.isAdmin,
  canVote: u.canVote,
});

export default function App() {
  const [platformPage, setPlatformPage] = useState<PlatformPage>('dashboard');
  const [platformUser, setPlatformUser] = useState<AuthUser | null>(null);
  const [round, setRound] = useState<CurrentRound | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [maps, setMaps] = useState<Beatmap[]>([]);
  const [mySubmission, setMySubmission] = useState<ApiSubmission | null>(null);
  /** Submission id the caller voted for in the open round, or null. */
  const [myVote, setMyVote] = useState<number | null>(null);
  /** Beatmap id whose cast or retract is in flight, so one click at a time. */
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  /** The open round's challenge scores, in the order the server ordered them. */
  const [challengeScores, setChallengeScores] = useState<ApiChallengeScore[]>([]);
  const [challengeLoaded, setChallengeLoaded] = useState(false);
  /** The caller's own recorded score for the open round, or null. */
  const [myScore, setMyScore] = useState<ApiChallengeScore | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playState, setPlayState] = useState<PlayState | null>(null);

  // The round is the single source of the phase. With no round open — or with the
  // API down — the app falls back to 'submission' for styling only; the pages key
  // their actual behaviour off `round` being null.
  const phase: Phase = round?.phase ?? 'submission';

  // Round, approved submissions, the caller's own entry, their vote and the challenge
  // leaderboard travel together: approving an entry, casting a vote, importing a score
  // or advancing a phase changes several of them at once, so everything reloads as a
  // set. The per-caller reads answer 401 when signed out and client.ts maps a failed
  // read to null, so asking for them before the session is known is safe.
  const refresh = useCallback(async () => {
    const [current, submissions, mine, vote, scores, score] = await Promise.all([
      api.rounds.current(),
      api.submissions.list(),
      api.submissions.mine(),
      api.votes.my(),
      api.challenge.scores(),
      api.challenge.my(),
    ]);
    // isVoted is per-caller, so it is applied here rather than in toBeatmap.
    const votedId = vote?.submissionId ?? null;
    setRound(toCurrentRound(current));
    setMaps((submissions ?? []).map((s) => ({ ...toBeatmap(s), isVoted: s.id === votedId })));
    setMySubmission(mine);
    setMyVote(votedId);
    // The server already ordered these by the round's challenge requirement, so they
    // are stored as they arrived and never re-sorted on the client.
    setChallengeScores(scores ?? []);
    setChallengeLoaded(true);
    setMyScore(score);
    setLoaded(true);
  }, []);

  // Restore the session on load. api.auth.me() resolves to null both when signed
  // out and when the API is unreachable, so a backend that is down reads as
  // "logged out" rather than breaking the page.
  useEffect(() => {
    api.auth.me().then((user) => {
      if (user) setPlatformUser(toAuthUser(user));
    });

    void refresh();

    // The OAuth callback redirects here with ?auth=failed&reason=… on failure.
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'failed') {
      setAuthError(params.get('reason') ?? 'unknown');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refresh]);

  const handleLogin = () => {
    window.location.href = api.auth.loginUrl();
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setPlatformUser(null);
    // Leaving the admin page on logout, so a stale admin view cannot linger.
    setPlatformPage((page) => (page === 'admin' ? 'dashboard' : page));
    // Drops the previous account's own submission along with the session.
    void refresh();
  };

  const handleTogglePlay = (id: string) => {
    setPlayState((prev) => {
      if (prev?.audio) {
        prev.audio.pause();
        prev.audio.currentTime = 0;
      }
      if (prev?.id === id) return null;
      const map = maps.find((m) => m.id === id);
      const audio = map?.previewUrl ? new Audio(map.previewUrl) : null;
      if (audio) {
        audio.volume = 0.6;
        audio.play().catch(() => {});
        audio.addEventListener('timeupdate', () => {
          setPlayState((s) => s?.id === id ? { ...s, progress: audio.duration ? audio.currentTime / audio.duration : 0 } : s);
        });
        audio.addEventListener('ended', () => setPlayState(null));
      }
      return { id, progress: 0, audio: audio ?? undefined };
    });
  };

  const handleScrub = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlayState((prev) => {
      if (prev?.audio && prev.id === id) {
        prev.audio.currentTime = progress * prev.audio.duration;
      }
      return prev?.id === id ? { ...prev, progress } : prev;
    });
  };

  /**
   * One vote per round, enforced by the server and by votes_one_per_user_per_round.
   * Clicking the entry you already voted for withdraws it; clicking another moves the
   * vote, which POST /api/votes does as one upsert rather than a retract-then-cast
   * that could leave someone with no vote at all if the second call failed.
   *
   * The whole set is reloaded on success instead of patching one row, because a move
   * changes two counts and the standings order along with them.
   */
  const handleVote = async (id: string) => {
    const submissionId = Number(id);
    // Sample-data ids are slugs; only real submissions can be voted for.
    if (!Number.isInteger(submissionId)) return;
    if (voteBusy) return;

    setVoteBusy(id);
    setVoteError(null);

    const result =
      myVote === submissionId ? await api.votes.retract() : await api.votes.cast(submissionId);

    // Every refusal from routes/votes.ts is already a human sentence, so it is shown
    // as-is — the same way the submit page surfaces its own.
    if (result.ok) await refresh();
    else setVoteError(result.error);

    setVoteBusy(null);
  };

  /**
   * Withdrawing is submission-phase only and the server enforces it. The panels own
   * their own confirm and busy state, so this performs the write and reports the
   * outcome rather than holding UI state for them.
   */
  const handleWithdraw = async (): Promise<string | null> => {
    const result = await api.submissions.withdraw();
    if (!result.ok) return result.error;
    setMySubmission(null);
    await refresh();
    return null;
  };

  /**
   * Imports the caller's osu! score for the round's winning beatmap. The request has
   * no body — the map comes from the recorded winner and the player from the session —
   * so there is nothing here to assemble, only the outcome to report.
   */
  const handleImportScore = async (): Promise<string | null> => {
    const result = await api.challenge.importMine();
    if (!result.ok) return result.error;
    // The whole set reloads: one new score changes the order and every rank in it.
    await refresh();
    return null;
  };

  const handleFavorite = (id: string) => {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, isFavorited: !m.isFavorited } : m)));
  };

  return (
    <div className="min-h-full bg-[#060c18] text-slate-100">
      <NavHeader
        page={platformPage}
        phase={phase}
        round={round}
        onNavigate={setPlatformPage}
        user={platformUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {authError && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2.5 flex items-center justify-between gap-4">
          <p className="text-xs text-rose-300">
            osu! login failed (<span className="font-mono">{authError}</span>). Most often the
            callback URL registered on the osu! application does not match{' '}
            <span className="font-mono">OSU_REDIRECT_URI</span>.
          </p>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <main>
        {platformPage === 'dashboard' && (
          <DashboardPage
            round={round}
            maps={maps}
            mySubmission={mySubmission}
            onWithdraw={handleWithdraw}
            myVote={myVote}
            voteBusy={voteBusy}
            voteError={voteError}
            onVote={handleVote}
            onDismissVoteError={() => setVoteError(null)}
            challengeScores={challengeScores}
            challengeLoaded={challengeLoaded}
            myScore={myScore}
            onImportScore={handleImportScore}
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'vote' && (
          <VotePage
            maps={maps}
            round={round}
            mySubmissionId={mySubmission?.id ?? null}
            voteBusy={voteBusy}
            voteError={voteError}
            onDismissVoteError={() => setVoteError(null)}
            playingId={playState?.id ?? null}
            audioProgress={(id) => (playState?.id === id ? playState.progress : 0)}
            onTogglePlay={handleTogglePlay}
            onScrub={handleScrub}
            onVote={handleVote}
            onFavorite={handleFavorite}
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'search' && <SearchPage />}
        {platformPage === 'submit' && (
          <PlatformSubmitPage
            round={round}
            mySubmission={mySubmission}
            loading={!loaded}
            onSubmitted={setMySubmission}
            onWithdraw={handleWithdraw}
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'admin' && (
          <AdminDashboard
            round={round}
            user={platformUser}
            onRoundChange={refresh}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'archive' && <ArchivePage />}
      </main>
    </div>
  );
}
