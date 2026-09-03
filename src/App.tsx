import React, { useState } from 'react';
import { NavHeader, AuthUser } from './components/platform/NavHeader';
import { DashboardPage } from './components/platform/DashboardPage';
import { VotePage } from './components/platform/VotePage';
import { SearchPage } from './components/platform/SearchPage';
import { AdminDashboard } from './components/platform/AdminDashboard';
import { PlatformSubmitPage } from './components/platform/PlatformSubmitPage';
import { ArchivePage } from './components/platform/ArchivePage';
import { votingBeatmaps } from './components/platform/sampleData';
import { Beatmap, Phase, PlatformPage } from './types';

type PlayState = { id: string; progress: number; audio?: HTMLAudioElement };

// DEV ONLY — stands in for a real session until osu! OAuth lands.
// Replace with `api.auth.me()` (src/api/client.ts) and a redirect to
// `api.auth.loginUrl()`; nothing else in the app depends on this constant.
const DEV_USER: AuthUser = { username: 'helixia_dz', rank: 12043, country: 'DZ' };

export default function App() {
  const [platformPage, setPlatformPage] = useState<PlatformPage>('dashboard');
  const [platformPhase, setPlatformPhase] = useState<Phase>('submission');
  const [platformUser, setPlatformUser] = useState<AuthUser | null>(null);
  const [maps, setMaps] = useState<Beatmap[]>(votingBeatmaps);
  const [playState, setPlayState] = useState<PlayState | null>(null);

  const handleLogin = () => setPlatformUser(DEV_USER);
  const handleLogout = () => setPlatformUser(null);

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
        phase={platformPhase}
        onNavigate={setPlatformPage}
        user={platformUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <main>
        {platformPage === 'dashboard' && (
          <DashboardPage
            phase={platformPhase}
            onPhaseChange={setPlatformPhase}
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'vote' && (
          <VotePage
            maps={maps}
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
            phase={platformPhase}
            onNavigate={setPlatformPage}
            user={platformUser}
            onLogin={handleLogin}
          />
        )}
        {platformPage === 'admin'   && <AdminDashboard phase={platformPhase} onPhaseChange={setPlatformPhase} />}
        {platformPage === 'archive' && <ArchivePage />}
      </main>
    </div>
  );
}
