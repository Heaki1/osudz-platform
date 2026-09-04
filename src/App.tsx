import React, { useCallback, useEffect, useState } from 'react';
import { NavHeader, AuthUser } from './components/platform/NavHeader';
import { DashboardPage } from './components/platform/DashboardPage';
import { VotePage } from './components/platform/VotePage';
import { SearchPage } from './components/platform/SearchPage';
import { AdminDashboard } from './components/platform/AdminDashboard';
import { PlatformSubmitPage } from './components/platform/PlatformSubmitPage';
import { ArchivePage } from './components/platform/ArchivePage';
import { api, ApiSubmission, ApiUser } from './api/client';
import { CurrentRound, toCurrentRound } from './lib/round';
import { toBeatmap } from './lib/submission';
import { Beatmap, Phase, PlatformPage } from './types';

type PlayState = { id: string; progress: number; audio?: HTMLAudioElement };

const toAuthUser = (u: ApiUser): AuthUser => ({
  username: u.username,
  rank: u.globalRank,
  country: u.country,
  isAdmin: u.isAdmin,
});

export default function App() {
  const [platformPage, setPlatformPage] = useState<PlatformPage>('dashboard');
  const [platformUser, setPlatformUser] = useState<AuthUser | null>(null);
  const [round, setRound] = useState<CurrentRound | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [maps, setMaps] = useState<Beatmap[]>([]);
  const [mySubmission, setMySubmission] = useState<ApiSubmission | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playState, setPlayState] = useState<PlayState | null>(null);

  // The round is the single source of the phase. With no round open — or with the
  // API down — the app falls back to 'submission' for styling only; the pages key
  // their actual behaviour off `round` being null.
  const phase: Phase = round?.phase ?? 'submission';

  // Round, approved submissions and the caller's own entry travel together:
  // approving an entry or advancing a phase changes all three, so admin actions
  // reload the set. /submissions/mine answers null when signed out, so it is safe
  // to ask for before the session is known.
  const refresh = useCallback(async () => {
    const [current, submissions, mine] = await Promise.all([
      api.rounds.current(),
      api.submissions.list(),
      api.submissions.mine(),
    ]);
    setRound(toCurrentRound(current));
    setMaps((submissions ?? []).map(toBeatmap));
    setMySubmission(mine);
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

  // Local-only until POST /api/votes is implemented server-side.
  const handleVote = (id: string) => {
    setMaps((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, isVoted: !m.isVoted, voteCount: (m.voteCount ?? 0) + (m.isVoted ? -1 : 1) }
          : m
      )
    );
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
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'vote' && (
          <VotePage
            maps={maps}
            round={round}
            playingId={playState?.id ?? null}
            audioProgress={(id) => (playState?.id === id ? playState.progress : 0)}
            onTogglePlay={handleTogglePlay}
            onScrub={handleScrub}
            onVote={handleVote}
            onFavorite={handleFavorite}
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
