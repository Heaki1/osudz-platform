import React, { useState, useEffect } from 'react';
import { BeatmapCard } from './components/BeatmapCard';
import { Leaderboard } from './components/Leaderboard';
import { MatchMode } from './components/MatchMode';
import SubmitPage from './components/SubmitPage';
import { NavHeader, AuthUser } from './components/platform/NavHeader';
import { DashboardPage } from './components/platform/DashboardPage';
import { VotePage } from './components/platform/VotePage';
import { SearchPage } from './components/platform/SearchPage';
import { AdminDashboard } from './components/platform/AdminDashboard';
import { PlatformSubmitPage } from './components/platform/PlatformSubmitPage';
import { ArchivePage } from './components/platform/ArchivePage';
import { BeatmapBounty, SubmittedBeatmap } from './types';
import { Phase, PlatformPage } from './components/platform/types';
import { Music2, Trophy, Flame, Search, SlidersHorizontal, Swords, LayoutGrid } from 'lucide-react';

const initialBeatmaps: BeatmapBounty[] = [
  {
    id: 'qshell',
    title: 'QSHELL -Kyoshoku no Shell-',
    artist: 'Se-U-Ra',
    mapper: 'Azzedd',
    genre: 'Electronic',
    difficultyRating: 3.54,
    difficultyCategory: 'Normal',
    difficultyName: "Dored's Hard",
    votes: 1420,
    userVoted: false,
    userFavorited: false,
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/1669349.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 199,
    length: '02:00',
    circleSize: 3.8,
    approachRate: 8.0,
    accuracy: 6.0,
    hpDrain: 5.0,
    bountyRewardPoints: 50,
    description: 'Polyrhythmic synth map with clean stream flow.',
    comments: [
      { id: 'q1', user: 'rinka', avatar: '', time: '3h ago', text: 'The streams at 1:20 are genuinely perfect. Best burst section in any Normal diff.', rating: 5 },
      { id: 'q2', user: 'noobmaster', avatar: '', time: '1h ago', text: "Couldn't FC but the flow is so satisfying. Will grind this.", rating: 4 },
    ],
    challenges: [
      { id: 'c1', title: '#1 HD Score', description: 'Set the top score on this map with Hidden mod active.', reward: 200, icon: 'crown', difficulty: 'Platinum', completedBy: 3 },
      { id: 'c2', title: 'Full Combo', description: 'Complete the map without missing a single note.', reward: 100, icon: 'zap', difficulty: 'Gold', completedBy: 47 },
      { id: 'c3', title: 'S Rank', description: 'Finish with 95% accuracy or higher.', reward: 50, icon: 'medal', difficulty: 'Silver', completedBy: 312 },
      { id: 'c4', title: 'First Pass', description: 'Pass the map for the first time. Welcome to the grind!', reward: 10, icon: 'target', difficulty: 'Bronze', completedBy: 1082 },
    ],
  },
  {
    id: 'feelings-of-fake',
    title: 'Feelings of Fake (feat. Tsuyuri Karin)',
    artist: 'Hellia',
    mapper: 'Hellia',
    genre: 'Pop',
    difficultyRating: 3.78,
    difficultyCategory: 'Hard',
    difficultyName: "C O I N's Hard",
    votes: 883,
    userVoted: false,
    userFavorited: false,
    bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/1619353.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 202,
    length: '01:51',
    circleSize: 3.2,
    approachRate: 8.2,
    accuracy: 7.0,
    hpDrain: 5.0,
    bountyRewardPoints: 50,
    description: 'Emotional pop vocal with flowing slider patterns.',
    comments: [
      { id: 'f1', user: 'helixia', avatar: '', time: '6h ago', text: 'The vocal hitsounds sync perfectly. Felt emotional ngl.', rating: 5 },
    ],
    challenges: [
      { id: 'c1', title: '#1 HDDT Score', description: 'Claim the top score with Hidden + Double Time. Prepare your fingers.', reward: 250, icon: 'crown', difficulty: 'Platinum', completedBy: 1 },
      { id: 'c2', title: 'FC No Mod', description: 'Full combo on any difficulty without mods.', reward: 80, icon: 'flame', difficulty: 'Gold', completedBy: 89 },
      { id: 'c3', title: 'A Rank', description: 'Achieve an A rank or better on your first attempt today.', reward: 30, icon: 'trophy', difficulty: 'Silver', completedBy: 441 },
      { id: 'c4', title: 'First Play', description: 'Submit your first score on this beatmap.', reward: 10, icon: 'target', difficulty: 'Bronze', completedBy: 721 },
    ],
  },
  {
    id: 'cybernetics',
    title: 'Cybernetics',
    artist: 'Jun Kuroda',
    mapper: 'Altai',
    genre: 'Electronic',
    difficultyRating: 5.53,
    difficultyCategory: 'Insane',
    difficultyName: 'Hard',
    votes: 2104,
    userVoted: true,
    userFavorited: true,
    bannerUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/1373681.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 203,
    length: '02:04',
    circleSize: 3.8,
    approachRate: 7.8,
    accuracy: 6.5,
    hpDrain: 5.0,
    bountyRewardPoints: 75,
    description: 'Dense technical streams with punishing jump sections.',
    comments: [
      { id: 'cy1', user: 'raikou', avatar: '', time: '2h ago', text: 'Insane diff, love the slider art. The burst at 0:48 catches everyone first time.', rating: 5 },
      { id: 'cy2', user: 'altari', avatar: '', time: '45m ago', text: "HR players stay winning. FC'd with HR and my hands are dead.", rating: 4 },
      { id: 'cy3', user: 'void_mapper', avatar: '', time: '10m ago', text: 'Altai really outdid himself on the patterning here.', rating: 5 },
    ],
    challenges: [
      { id: 'c1', title: '#1 HR Score', description: 'Top the leaderboard with Hard Rock. The circles are tiny. Good luck.', reward: 300, icon: 'crown', difficulty: 'Platinum', completedBy: 0 },
      { id: 'c2', title: 'FC Insane Diff', description: 'Full combo the Insane difficulty. No misses, no excuses.', reward: 150, icon: 'zap', difficulty: 'Platinum', completedBy: 12 },
      { id: 'c3', title: 'S Rank HD', description: 'Hidden S rank — 95% acc or better on Insane.', reward: 100, icon: 'medal', difficulty: 'Gold', completedBy: 63 },
      { id: 'c4', title: 'Survive It', description: 'Pass the Insane difficulty without failing. HP is brutal.', reward: 25, icon: 'flame', difficulty: 'Silver', completedBy: 389 },
    ],
  },
  {
    id: 'kinetic-flux',
    title: 'Kinetic Flux',
    artist: 'MetaHumanai',
    mapper: 'HintIceCream_',
    genre: 'Electronic',
    difficultyRating: 3.94,
    difficultyCategory: 'Hard',
    difficultyName: 'Hard',
    votes: 671,
    userVoted: false,
    userFavorited: false,
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/1839516.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 170,
    length: '02:56',
    circleSize: 3.5,
    approachRate: 8.2,
    accuracy: 6.5,
    hpDrain: 5.0,
    bountyRewardPoints: 50,
    description: 'Mid-tempo electronic with satisfying burst patterns.',
    comments: [],
    challenges: [
      { id: 'c1', title: '#1 Score Any Mod', description: 'Sit at the top of the leaderboard — any mod allowed.', reward: 150, icon: 'crown', difficulty: 'Gold', completedBy: 5 },
      { id: 'c2', title: 'Full Combo', description: 'FC the map with no break in your combo.', reward: 75, icon: 'zap', difficulty: 'Gold', completedBy: 102 },
      { id: 'c3', title: 'Beat Your PB', description: 'Submit a score higher than your current personal best.', reward: 20, icon: 'trophy', difficulty: 'Silver', completedBy: 540 },
      { id: 'c4', title: 'Pass No Fail', description: 'Pass with No Fail mod — for when you need that practice run.', reward: 5, icon: 'target', difficulty: 'Bronze', completedBy: 893 },
    ],
  },
  {
    id: 'blue-zenith',
    title: 'Blue Zenith (Cut Ver.)',
    artist: 'xi',
    mapper: 'Sotarks',
    genre: 'Electronic',
    difficultyRating: 4.48,
    difficultyCategory: 'Insane',
    difficultyName: "sanatint's Insane",
    votes: 3892,
    userVoted: false,
    userFavorited: true,
    bannerUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/292301.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 200,
    length: '01:03',
    circleSize: 4.0,
    approachRate: 9.0,
    accuracy: 8.0,
    hpDrain: 6.5,
    bountyRewardPoints: 100,
    description: 'Iconic xi track with fast-paced jump sections.',
    comments: [
      { id: 'bz1', user: 'mrekk', avatar: '', time: '5h ago', text: 'Classic for a reason. Still the benchmark for jump maps.', rating: 5 },
      { id: 'bz2', user: 'whitecat', avatar: '', time: '3h ago', text: 'HDHR SS is the only real challenge left on this. Working on it.', rating: 5 },
    ],
    challenges: [
      { id: 'c1', title: '#1 HDHR Score', description: 'Claim the global #1 with Hidden + Hard Rock. Only for the elite.', reward: 500, icon: 'crown', difficulty: 'Platinum', completedBy: 2 },
      { id: 'c2', title: 'SS Rank', description: '100% accuracy. Every circle perfect. Every slider tracked.', reward: 300, icon: 'zap', difficulty: 'Platinum', completedBy: 8 },
      { id: 'c3', title: 'FC DT', description: 'Full combo with Double Time. 240 BPM jumps await.', reward: 200, icon: 'flame', difficulty: 'Platinum', completedBy: 21 },
      { id: 'c4', title: 'First Blood', description: 'Be the first in your friend group to FC this map.', reward: 50, icon: 'trophy', difficulty: 'Gold', completedBy: 614 },
    ],
  },
  {
    id: 'heart-of-marionette',
    title: 'Hear+ of Marionette',
    artist: 'seatrus',
    mapper: 'Saki',
    genre: 'Anime',
    difficultyRating: 3.80,
    difficultyCategory: 'Hard',
    difficultyName: "Ag's Hard",
    votes: 544,
    userVoted: false,
    userFavorited: false,
    bannerUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&auto=format&fit=crop&q=80',
    previewUrl: 'https://b.ppy.sh/preview/1591280.mp3',
    previewDuration: '1:00',
    previewSeconds: 60,
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: 172,
    length: '01:56',
    circleSize: 4.0,
    approachRate: 8.0,
    accuracy: 6.0,
    hpDrain: 5.0,
    bountyRewardPoints: 50,
    description: 'Emotional anime track with expressive slider movement.',
    comments: [],
    challenges: [
      { id: 'c1', title: '#1 HD Score', description: 'Top the Hidden leaderboard. Aesthetic map deserves an aesthetic run.', reward: 180, icon: 'crown', difficulty: 'Platinum', completedBy: 4 },
      { id: 'c2', title: 'Slider Perfectionist', description: 'FC with all slider ends — no lazy tails allowed.', reward: 90, icon: 'medal', difficulty: 'Gold', completedBy: 77 },
      { id: 'c3', title: 'B Rank or Better', description: 'Score a B or higher on your first attempt with no mods.', reward: 15, icon: 'target', difficulty: 'Silver', completedBy: 602 },
      { id: 'c4', title: 'Just Listen', description: 'Play through and let the music hit. Sometimes that is enough.', reward: 5, icon: 'flame', difficulty: 'Bronze', completedBy: 1240 },
    ],
  },
];

type Page = 'browse' | 'match' | 'leaderboard' | 'submit';
type PlayState = { id: string; progress: number; audio?: HTMLAudioElement };
type FilterMode = 'all' | 'Electronic' | 'Pop' | 'Anime' | 'Rock' | 'Classical';
type AppMode = 'platform' | 'game';

const MOCK_USER: AuthUser = { username: 'helixia_dz', rank: 12043, country: 'DZ' };

export default function App() {
  const [mode, setMode] = useState<AppMode>('platform');
  const [platformPage, setPlatformPage] = useState<PlatformPage>('dashboard');
  const [platformPhase, setPlatformPhase] = useState<Phase>('submission');
  const [platformUser, setPlatformUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<Page>('browse');
  const [maps, setMaps] = useState<BeatmapBounty[]>(initialBeatmaps);
  const [submittedMaps, setSubmittedMaps] = useState<SubmittedBeatmap[]>([]);
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'votes' | 'difficulty' | 'bpm'>('votes');
  const [userPoints, setUserPoints] = useState(350);

  async function loadSubmittedMaps() {
    try {
      const res = await fetch('/api/beatmaps/list');
      const data = await res.json();
      setSubmittedMaps((Array.isArray(data) ? data : []).filter((x: SubmittedBeatmap) => x.type === 'bounty'));
    } catch {
      // offline — no-op
    }
  }

  useEffect(() => { loadSubmittedMaps(); }, []);

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

  const handleVote = (id: string) => {
    setMaps((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, userVoted: !m.userVoted, votes: m.userVoted ? m.votes - 1 : m.votes + 1 }
          : m
      )
    );
    const m = maps.find((x) => x.id === id);
    if (m && !m.userVoted) setUserPoints((p) => p + m.bountyRewardPoints);
    if (m && m.userVoted) setUserPoints((p) => p - m.bountyRewardPoints);
  };

  const handleFavorite = (id: string) => {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, userFavorited: !m.userFavorited } : m)));
  };

  const genres: FilterMode[] = ['all', 'Electronic', 'Pop', 'Anime', 'Rock', 'Classical'];

  const filtered = maps
    .filter((m) => filter === 'all' || m.genre === filter)
    .filter(
      (m) =>
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.artist.toLowerCase().includes(search.toLowerCase()) ||
        m.mapper.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      sortBy === 'votes' ? b.votes - a.votes
        : sortBy === 'difficulty' ? b.difficultyRating - a.difficultyRating
        : b.bpm - a.bpm
    );

  const totalVotes = maps.reduce((s, m) => s + m.votes, 0);
  const topMap = [...maps].sort((a, b) => b.votes - a.votes)[0];

  const navItems: { key: Page; label: string; icon: React.ReactNode }[] = [
    { key: 'browse',      label: 'Browse',      icon: <LayoutGrid className="w-4 h-4" /> },
    { key: 'match',       label: 'Match',        icon: <Swords className="w-4 h-4" /> },
    { key: 'leaderboard', label: 'Leaderboard',  icon: <Trophy className="w-4 h-4" /> },
    { key: 'submit',      label: 'Submit',       icon: <span className="text-sm leading-none">↑</span> },
  ];

  // ── PLATFORM MODE ──────────────────────────────────────────────────────────
  if (mode === 'platform') {
    return (
      <div className="min-h-full bg-[#060c18] text-slate-100">
        <NavHeader
          page={platformPage}
          phase={platformPhase}
          onNavigate={setPlatformPage}
          onSwitchToGame={() => setMode('game')}
          user={platformUser}
          onLogin={() => setPlatformUser(MOCK_USER)}
          onLogout={() => setPlatformUser(null)}
        />
        <main>
          {platformPage === 'dashboard' && (
            <DashboardPage
              phase={platformPhase}
              onPhaseChange={setPlatformPhase}
              onNavigate={setPlatformPage}
              user={platformUser}
              onLogin={() => setPlatformUser(MOCK_USER)}
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
              onLogin={() => setPlatformUser(MOCK_USER)}
            />
          )}
          {platformPage === 'search' && <SearchPage />}
          {platformPage === 'submit' && (
            <PlatformSubmitPage
              phase={platformPhase}
              onNavigate={setPlatformPage}
              user={platformUser}
              onLogin={() => setPlatformUser(MOCK_USER)}
            />
          )}
          {platformPage === 'admin'   && <AdminDashboard phase={platformPhase} onPhaseChange={setPlatformPhase} />}
          {platformPage === 'archive' && <ArchivePage />}
        </main>
      </div>
    );
  }

  // ── GAME MODE (card battle prototype — work in progress) ───────────────────
  return (
    <div className="min-h-full bg-[#1a2a6c] text-slate-100 relative overflow-x-hidden">
      {/* Background triangles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-8 w-72 h-72 opacity-20" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', background: 'transparent', outline: '1.5px solid white' }} />
        <div className="absolute top-0 right-8 w-56 h-56 opacity-10" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', background: 'transparent', outline: '1px solid white', transform: 'translate(10%, 10%)' }} />
        <div className="absolute bottom-16 left-4 w-56 h-56 opacity-15" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', background: 'transparent', outline: '1.5px solid white' }} />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 opacity-10" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', background: 'white' }} />
        <div className="absolute top-1/3 left-1/4 w-16 h-16 opacity-10" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', background: 'transparent', outline: '2px solid white' }} />
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-10 px-6 pt-8 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Music2 className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-blue-200/70 font-mono">Beatmap Bounty</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-lg">
                Vote for your <span className="text-amber-400">favourite maps!</span>
              </h1>
            </div>

            {/* Points badge + stats */}
            <div className="flex items-start gap-3">
              <div className="bg-amber-400/10 border border-amber-400/40 rounded-xl px-4 py-3 text-center">
                <div className="text-[10px] text-amber-400/70 uppercase tracking-wider font-bold mb-0.5">Your Points</div>
                <div className="text-xl font-black font-mono text-amber-400">{userPoints.toLocaleString()}</div>
              </div>
              <div className="hidden sm:block bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Top Map</span>
                </div>
                <div className="text-xs font-bold text-white max-w-24 truncate">{topMap.title}</div>
                <div className="text-[10px] text-amber-400 font-mono font-bold">{topMap.votes.toLocaleString()} votes</div>
              </div>
              <div className="hidden sm:block bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <Flame className="w-3 h-3 text-rose-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Votes</span>
                </div>
                <div className="text-xl font-black font-mono text-white">{totalVotes.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* ── NAV TABS ── */}
          <div className="flex items-center gap-1 border-b border-slate-700/40 pb-0 flex-wrap">
            {navItems.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPage(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wide border-b-2 transition-all -mb-px ${
                  page === key
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {icon}
                {label}
                {key === 'match' && (
                  <span className="ml-0.5 text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Live</span>
                )}
              </button>
            ))}
            <div className="ml-auto mb-1">
              <button
                type="button"
                onClick={() => setMode('platform')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 text-[10px] font-bold transition-all"
              >
                ← Platform
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <main className="relative z-10 pt-6">

        {/* BROWSE */}
        {page === 'browse' && (
          <div className="px-6 pb-16">
            <div className="max-w-6xl mx-auto">
              {/* Search + Sort */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title, artist, or mapper…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60 backdrop-blur-sm transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {(['votes', 'difficulty', 'bpm'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSortBy(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                        sortBy === s ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/60 border border-slate-700/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre filters */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {genres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFilter(g)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide capitalize transition-all ${
                      filter === g ? 'bg-white text-slate-950' : 'bg-slate-900/50 border border-slate-700/50 text-slate-300 hover:text-white backdrop-blur-sm'
                    }`}
                  >
                    {g === 'all' ? 'All Genres' : g}
                  </button>
                ))}
                <span className="ml-auto text-xs text-blue-200/40 font-mono">{filtered.length} maps</span>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                  <Music2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p>No beatmaps match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((bounty) => (
                    <BeatmapCard
                      key={bounty.id}
                      bounty={bounty}
                      isPlaying={playState?.id === bounty.id}
                      audioProgress={playState?.id === bounty.id ? playState.progress : 0}
                      onTogglePlay={() => handleTogglePlay(bounty.id)}
                      onScrubAudio={(e) => handleScrub(bounty.id, e)}
                      onVote={() => handleVote(bounty.id)}
                      onFavorite={() => handleFavorite(bounty.id)}
                      onOpenComments={() => {}}
                    />
                  ))}
                </div>
              )}

              {/* Community Submissions */}
              {submittedMaps.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-slate-700/40" />
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold font-mono">Community</p>
                      <h3 className="text-lg font-black text-white">Submitted Maps</h3>
                    </div>
                    <div className="h-px flex-1 bg-slate-700/40" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submittedMaps.map((b) => {
                      const cover = b.cover_url && (() => { try { const p = new URL(b.cover_url!); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; } catch { return ''; } })();
                      const mapUrl = b.url && (() => { try { const p = new URL(b.url); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; } catch { return ''; } })();
                      return (
                        <div key={b.id} className="bg-slate-900/60 border border-slate-700/40 rounded-2xl overflow-hidden hover:border-slate-600/60 transition-colors">
                          {cover && (
                            <div className="h-24 bg-slate-800 overflow-hidden">
                              <img src={cover} alt="" className="w-full h-full object-cover opacity-80" />
                            </div>
                          )}
                          <div className="p-4">
                            {mapUrl ? (
                              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-white text-sm hover:text-amber-400 transition-colors line-clamp-1 block mb-1">
                                {b.title || 'Unknown title'}
                              </a>
                            ) : (
                              <p className="font-bold text-white text-sm line-clamp-1 mb-1">{b.title || 'Unknown title'}</p>
                            )}
                            {b.artist && <p className="text-xs text-slate-400 mb-2">{b.artist}</p>}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {b.slot && <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{b.slot}</span>}
                              {b.mod && <span className="text-[10px] bg-slate-700/60 border border-slate-600/40 text-slate-300 px-2 py-0.5 rounded-full font-mono">{b.mod}</span>}
                              {b.skill && <span className="text-[10px] bg-amber-400/15 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full font-bold">🎯 {b.skill}</span>}
                            </div>
                            <div className="grid grid-cols-3 gap-1 mb-3">
                              {[['★', b.stars], ['BPM', b.bpm], ['CS', b.cs], ['AR', b.ar], ['OD', b.od], ['Len', b.length]].map(([label, value]) =>
                                value != null && String(value) !== '' ? (
                                  <div key={String(label)} className="bg-slate-800/60 rounded-lg px-2 py-1 text-center">
                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
                                    <div className="text-xs font-bold font-mono text-slate-200">{String(value)}</div>
                                  </div>
                                ) : null
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-blue-300/70">👤 {b.submitted_by_name || 'Unknown'}</span>
                              <button
                                type="button"
                                onClick={() => setPage('submit')}
                                className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors font-mono"
                              >
                                Submit yours →
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MATCH */}
        {page === 'match' && (
          <>
            <div className="px-6 mb-6">
              <div className="max-w-2xl mx-auto">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Head-to-Head</p>
                <h2 className="text-2xl font-black text-white">Match Mode</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Pick one card from your hand and battle for the highest stat. Win to earn bounty points.
                </p>
              </div>
            </div>
            <MatchMode maps={maps} onAwardPoints={(pts) => setUserPoints((p) => p + pts)} />
          </>
        )}

        {/* LEADERBOARD */}
        {page === 'leaderboard' && (
          <>
            <div className="px-6 mb-6">
              <div className="max-w-2xl mx-auto">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Rankings</p>
                <h2 className="text-2xl font-black text-white">Leaderboard</h2>
                <p className="text-sm text-slate-400 mt-1">Top voters and most-voted maps this season.</p>
              </div>
            </div>
            <Leaderboard />
          </>
        )}

        {/* SUBMIT */}
        {page === 'submit' && (
          <SubmitPage onSubmitSuccess={loadSubmittedMaps} />
        )}
      </main>

      <div className="relative z-10 text-center pb-8">
        <p className="text-[10px] text-blue-200/30 uppercase tracking-widest font-mono">
          These are your cards for this match!
        </p>
        <p className="text-[10px] text-blue-200/20 font-mono mt-0.5">
          When it's your turn, you can play a card to go head-to-head against your opponent!
        </p>
      </div>
    </div>
  );
}
