import React, { useEffect, useState } from 'react';
import { BeatmapCard } from './components/BeatmapCard';
import { Leaderboard } from './components/Leaderboard';
import { MatchMode } from './components/MatchMode';
import { BeatmapBounty, Session } from './types';
import { mapCandidate } from './utils';
import { getMe, getCurrentChallenge, castVote, getComments, postComment } from './api';
import {
  Music2, Trophy, Flame, Search, SlidersHorizontal,
  Swords, LayoutGrid, LogIn, LogOut, Loader2,
} from 'lucide-react';

type Page = 'browse' | 'match' | 'leaderboard';
type PlayState = { id: string; progress: number };
type FilterMode = 'all' | 'Electronic' | 'Rock' | 'Pop' | 'Classical' | 'Anime';

export default function App() {
  const [page, setPage] = useState<Page>('browse');
  const [session, setSession] = useState<Session | null>(null);
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [maps, setMaps] = useState<BeatmapBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'votes' | 'difficulty' | 'bpm'>('votes');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const [sess, challenge] = await Promise.all([getMe(), getCurrentChallenge()]);
      setSession(sess);
      if (!challenge) {
        setError('No active challenge found.');
        setLoading(false);
        return;
      }
      setChallengeId(challenge.id);
      setChallengeTitle(challenge.title ?? `${challenge.month} Bounty`);
      const userVotedId = challenge.user_vote?.beatmap_id ?? null;
      setMaps((challenge.candidates ?? []).map((c) => mapCandidate(c, userVotedId)));
      setLoading(false);
    }
    load();
  }, []);

  const handleTogglePlay = (id: string) => {
    setPlayState((prev) => (prev?.id === id ? null : { id, progress: 0 }));
  };

  const handleScrub = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlayState({ id, progress });
  };

  const handleVote = async (id: string) => {
    if (!session) {
      window.location.href = '/api/auth/osu/login';
      return;
    }
    if (!challengeId) return;
    const ok = await castVote(challengeId, Number(id));
    if (!ok) return;
    setMaps((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const wasVoted = m.userVoted;
          return { ...m, userVoted: !wasVoted, votes: wasVoted ? m.votes - 1 : m.votes + 1 };
        }
        // one vote per challenge — unvote others when casting a new vote
        if (!prev.find((x) => x.id === id)?.userVoted && m.userVoted) {
          return { ...m, userVoted: false, votes: m.votes - 1 };
        }
        return m;
      })
    );
  };

  const handleFavorite = (id: string) => {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, userFavorited: !m.userFavorited } : m)));
  };

  const handleOpenComments = async (id: string) => {
    if (!challengeId) return;
    const raw = await getComments(challengeId, Number(id));
    const comments = (raw ?? []).map((c: any) => ({
      id: String(c.id),
      user: c.username ?? c.display_name ?? 'user',
      avatar: c.avatar_url ?? '',
      time: new Date(c.created_at).toLocaleString(),
      text: c.body ?? '',
    }));
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, comments } : m)));
  };

  const handlePostComment = async (mapId: string, text: string, parentId?: string) => {
    if (!challengeId) return;
    if (!session) { window.location.href = '/api/auth/osu/login'; return; }
    await postComment(challengeId, Number(mapId), text, parentId ? Number(parentId) : undefined);
    await handleOpenComments(mapId);
  };

  const genres: FilterMode[] = ['all', 'Electronic', 'Rock', 'Pop', 'Classical', 'Anime'];

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
    { key: 'match',       label: 'Match',       icon: <Swords className="w-4 h-4" /> },
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-full bg-[#1a2a6c] text-slate-100 relative overflow-x-hidden">
      {/* Background triangles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-8 w-72 h-72 opacity-20" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', outline: '1.5px solid white' }} />
        <div className="absolute top-0 right-8 w-56 h-56 opacity-10" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', outline: '1px solid white', transform: 'translate(10%, 10%)' }} />
        <div className="absolute bottom-16 left-4 w-56 h-56 opacity-15" style={{ clipPath: 'polygon(50% 5%, 95% 93%, 5% 93%)', outline: '1.5px solid white' }} />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 opacity-10" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', background: 'white' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pt-8 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Music2 className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-blue-200/70 font-mono">Beatmap Bounty</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-lg">
                {loading ? 'Loading…' : (challengeTitle || 'Vote for your')}
                {!loading && <> <span className="text-amber-400">favourite maps!</span></>}
              </h1>
            </div>

            <div className="flex items-start gap-3">
              {session ? (
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2">
                  {session.avatar && (
                    <img src={session.avatar} alt={session.username} className="w-7 h-7 rounded-full" />
                  )}
                  <span className="text-sm font-bold text-white">{session.username}</span>
                  <a href="/api/auth/logout" className="ml-1 text-slate-400 hover:text-white transition-colors">
                    <LogOut className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <a
                  href="/api/auth/osu/login"
                  className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with osu!
                </a>
              )}

              {!loading && topMap && (
                <div className="hidden sm:block bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                  <div className="flex items-center gap-1 justify-center mb-0.5">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Top Map</span>
                  </div>
                  <div className="text-xs font-bold text-white max-w-28 truncate">{topMap.title}</div>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">{topMap.votes.toLocaleString()} votes</div>
                </div>
              )}
              {!loading && (
                <div className="hidden sm:block bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
                  <div className="flex items-center gap-1 justify-center mb-0.5">
                    <Flame className="w-3 h-3 text-rose-400" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Votes</span>
                  </div>
                  <div className="text-xl font-black font-mono text-white">{totalVotes.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

          {/* Nav tabs */}
          <div className="flex items-center gap-1 border-b border-slate-700/40 pb-0">
            {navItems.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPage(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wide border-b-2 transition-all -mb-px ${
                  page === key ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {icon}
                {label}
                {key === 'match' && (
                  <span className="ml-0.5 text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Live</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading challenge…</p>
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md mx-auto text-center py-24 px-6">
            <Music2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-300 font-semibold">{error}</p>
            <p className="text-sm text-slate-500 mt-2">Check back when the next challenge opens.</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {page === 'browse' && (
              <div className="px-6 pb-16">
                <div className="max-w-6xl mx-auto">
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

                  <div className="flex items-center gap-2 flex-wrap mb-6">
                    {genres.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFilter(g)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide capitalize transition-all ${
                          filter === g ? 'bg-white text-slate-950' : 'bg-slate-900/50 border border-slate-700/50 text-slate-300 hover:text-white'
                        }`}
                      >
                        {g === 'all' ? 'All' : g}
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
                          onOpenComments={() => handleOpenComments(bounty.id)}
                          onPostComment={(text, parentId) => handlePostComment(bounty.id, text, parentId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {page === 'match' && (
              <>
                <div className="px-6 mb-6">
                  <div className="max-w-2xl mx-auto">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Head-to-Head</p>
                    <h2 className="text-2xl font-black text-white">Match Mode</h2>
                    <p className="text-sm text-slate-400 mt-1">Pick one card from your hand and battle for the highest stat.</p>
                  </div>
                </div>
                <MatchMode maps={maps} onAwardPoints={() => {}} />
              </>
            )}

            {page === 'leaderboard' && (
              <>
                <div className="px-6 mb-6">
                  <div className="max-w-2xl mx-auto">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Rankings</p>
                    <h2 className="text-2xl font-black text-white">Leaderboard</h2>
                    <p className="text-sm text-slate-400 mt-1">Top voters and most-voted maps this season.</p>
                  </div>
                </div>
                <Leaderboard maps={maps} />
              </>
            )}
          </>
        )}
      </main>

      <div className="relative z-10 text-center pb-8">
        <p className="text-[10px] text-blue-200/20 uppercase tracking-widest font-mono">
          These are your cards for this match!
        </p>
      </div>
    </div>
  );
}
