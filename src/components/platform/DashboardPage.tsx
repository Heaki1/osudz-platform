import React, { useState } from 'react';
import { Beatmap, Phase, PlatformPage } from '../../types';
import { CurrentRound, roundLabel, useCountdown } from '../../lib/round';
import { BeatmapCardPlatform } from './BeatmapCardPlatform';
import { favoriteBeatmaps, challengeScores } from './sampleData';
import { AuthUser } from './NavHeader';
import {
  Trophy, Crown, Upload, ChevronRight, RefreshCw,
  CheckCircle2, AlertCircle, Clock, LogIn, X,
} from 'lucide-react';

// ── INLINE LOGIN NUDGE ────────────────────────────────────────────────────────

function LoginNudge({ message, onLogin }: { message: string; onLogin?: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-3 bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-3 mb-6">
      <LogIn className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-400/80 flex-1">{message}</p>
      <button
        type="button"
        onClick={onLogin}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black rounded-lg transition-all flex-shrink-0"
      >
        Login with osu!
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── ROUND HEADER ─────────────────────────────────────────────────────────────

const roundMeta: Record<Phase, { label: string; color: string; bar: string; desc: string }> = {
  submission: {
    label: 'SUBMISSION PHASE',
    color: 'text-amber-400',
    bar: 'bg-amber-400',
    desc: 'Submit the beatmap you want as this month\'s community challenge. The community votes to decide the winner.',
  },
  voting: {
    label: 'VOTING PHASE',
    color: 'text-blue-400',
    bar: 'bg-blue-500',
    desc: 'Cast your vote for the beatmap you want as the monthly challenge. Algerian players get one vote each.',
  },
  challenge: {
    label: 'CHALLENGE PHASE',
    color: 'text-purple-400',
    bar: 'bg-purple-500',
    desc: 'The winning beatmap has been chosen. Submit your best score to qualify and compete for the monthly bounty.',
  },
};

function RoundHeader({ round, countdown }: { round: CurrentRound; countdown: string }) {
  const cfg = roundMeta[round.phase];

  return (
    <div className="mb-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className={`text-[10px] font-black tracking-widest uppercase font-mono ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-[10px] text-slate-500 font-mono">{roundLabel(round)}</span>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">{cfg.desc}</p>
        </div>
        <div className="flex-shrink-0">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 text-right">Ends in</div>
          <div className={`text-2xl font-black font-mono ${cfg.color}`}>{countdown}</div>
        </div>
      </div>
      <div className={`mt-5 h-px w-full ${cfg.bar} opacity-20 rounded-full`} />
    </div>
  );
}

// ── CHALLENGE LEADERBOARD ────────────────────────────────────────────────────

function ChallengeLeaderboard({ roundNumber }: { roundNumber: number }) {
  return (
    <div className="bg-[#0d1526] border border-slate-800/80 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Challenge Leaderboard</h3>
        <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">Algeria · Round {roundNumber}</span>
      </div>

      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-2 bg-slate-900/30 border-b border-slate-800/40">
        <span className="w-6 text-[10px] text-slate-600 font-mono">#</span>
        <span className="w-8 flex-shrink-0" />
        <span className="flex-1 text-[10px] text-slate-600 uppercase tracking-wider">Player</span>
        <span className="w-24 text-[10px] text-slate-600 uppercase tracking-wider text-right">Score</span>
        <span className="w-14 text-[10px] text-slate-600 uppercase tracking-wider text-right">Acc</span>
        <span className="w-14 text-[10px] text-slate-600 uppercase tracking-wider text-right">Miss</span>
        <span className="w-10 text-[10px] text-slate-600 uppercase tracking-wider text-center">Mod</span>
        <span className="w-28 text-[10px] text-slate-600 uppercase tracking-wider text-center">Status</span>
      </div>

      <div className="divide-y divide-slate-800/40">
        {challengeScores.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-4 px-5 py-3 transition-colors ${
              entry.isMe
                ? 'bg-amber-400/5 border-l-2 border-l-amber-400'
                : entry.qualified
                ? 'hover:bg-emerald-500/5'
                : 'hover:bg-slate-800/20'
            }`}
          >
            {/* Rank */}
            <span className="w-6 text-sm font-black font-mono text-slate-600 text-center flex-shrink-0">
              {entry.rank}
            </span>

            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                entry.qualified
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {entry.username[0].toUpperCase()}
            </div>

            {/* Username */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${entry.isMe ? 'text-amber-400' : 'text-white'}`}>
                {entry.username}
                {entry.isMe && <span className="text-amber-400/60 font-normal ml-1 text-xs">(you)</span>}
              </p>
            </div>

            {/* Score */}
            <span className="w-24 text-sm font-black font-mono text-white text-right flex-shrink-0">
              {entry.score.toLocaleString()}
            </span>

            {/* Accuracy */}
            <span className="w-14 text-xs font-mono text-slate-400 text-right flex-shrink-0">
              {entry.accuracy.toFixed(1)}%
            </span>

            {/* Misses */}
            <span className={`w-14 text-xs font-mono text-right flex-shrink-0 ${entry.misses === 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              {entry.misses}×
            </span>

            {/* Mods */}
            <div className="w-10 flex justify-center flex-shrink-0">
              <span className="text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                {entry.mods}
              </span>
            </div>

            {/* Qualification */}
            <div className="w-28 flex justify-center flex-shrink-0">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                entry.qualified
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {entry.qualified
                  ? <><CheckCircle2 className="w-3 h-3" /> QUALIFIED</>
                  : <><AlertCircle className="w-3 h-3" /> NOT QUALIFIED</>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DASHBOARD PAGE ───────────────────────────────────────────────────────────

interface DashboardPageProps {
  round: CurrentRound | null;
  /** Approved submissions in the open round. Empty until an admin approves one. */
  maps: Beatmap[];
  onNavigate: (page: PlatformPage) => void;
  user: AuthUser | null;
  onLogin?: () => void;
}

function NoActiveRound() {
  return (
    <div className="bg-[#0d1526] border border-slate-800 rounded-2xl px-8 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-5">
        <Clock className="w-7 h-7 text-slate-700" />
      </div>
      <p className="text-white font-bold mb-1">No round is running</p>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        The next monthly round has not been opened yet. Submissions, voting, and the challenge
        leaderboard all appear here once it starts.
      </p>
    </div>
  );
}

export function DashboardPage({ round, maps, onNavigate, user, onLogin }: DashboardPageProps) {
  const [userVote, setUserVote] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(favoriteBeatmaps);
  // One ticking countdown for the page, called before the early return below so
  // the hook order never changes. Both the header and the challenge hero use it.
  const countdown = useCountdown(round?.endsAt);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => prev.map((b) => (b.id === id ? { ...b, isFavorited: !b.isFavorited } : b)));
  };

  // Null whenever nothing is approved yet, so every use below is guarded.
  const leadingMap: Beatmap | null = maps.length
    ? maps.reduce((best, m) => ((m.voteCount ?? 0) > (best.voteCount ?? 0) ? m : best))
    : null;

  if (!round) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
        <NoActiveRound />
      </div>
    );
  }

  const phase = round.phase;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
      <RoundHeader round={round} countdown={countdown} />

      {/* ── SUBMISSION PHASE ──────────────────────────────────────────── */}
      {phase === 'submission' && (
        <div className="space-y-10">
          {!user && (
            <LoginNudge
              message="Login with your osu! account to submit a beatmap for this round."
              onLogin={onLogin}
            />
          )}

          {/* Submit CTA */}
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-400/10 via-amber-400/5 to-transparent border border-amber-400/20 rounded-2xl p-6 flex items-center justify-between gap-6">
            <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5">
              <Trophy className="w-full h-full text-amber-400" />
            </div>
            <div className="relative">
              <p className="text-[10px] uppercase tracking-widest font-mono text-amber-400/70 mb-1">This month's challenge</p>
              <h2 className="text-lg font-black text-white mb-1">Have a beatmap to propose?</h2>
              <p className="text-sm text-slate-400 max-w-lg">
                Submit a Ranked, Loved, or Approved beatmap. Players vote for their favourite — the winner becomes the monthly challenge.
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('submit')}
                className="flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all flex-shrink-0 active:scale-[0.98]"
              >
                <Upload className="w-4 h-4" />
                Submit a Beatmap
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 hover:border-amber-400/40 text-slate-300 hover:text-white font-black text-sm rounded-xl transition-all flex-shrink-0"
              >
                <LogIn className="w-4 h-4" />
                Login to Submit
              </button>
            )}
          </div>

          {/* Favorites */}
          <section>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-1">My Collection</p>
                <h2 className="text-xl font-black text-white">Favorite Beatmaps</h2>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Load my osu! favorites
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((b) => (
                <BeatmapCardPlatform
                  key={b.id}
                  beatmap={b}
                  showSubmitButton
                  onFavorite={() => toggleFavorite(b.id)}
                  onSubmit={() => onNavigate('submit')}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── VOTING PHASE ──────────────────────────────────────────────── */}
      {phase === 'voting' && (
        <div className="space-y-10">
          {!user && (
            <LoginNudge
              message="Login with your osu! account to cast your vote for this round."
              onLogin={onLogin}
            />
          )}

          {/* My vote + leading */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* My vote */}
            <div className="bg-[#0d1526] border border-slate-800/80 rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-4">My Vote</p>
              {!user ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
                    <LogIn className="w-7 h-7 text-slate-700" />
                  </div>
                  <p className="text-white font-bold mb-1">Login to vote</p>
                  <p className="text-sm text-slate-500 mb-5">
                    Verified Algerian osu! players get one vote per round.
                  </p>
                  <button
                    type="button"
                    onClick={onLogin}
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all"
                  >
                    Login with osu!
                  </button>
                </div>
              ) : userVote ? (
                <>
                  <p className="text-xs text-emerald-400 font-bold mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    You have voted
                  </p>
                  {(() => {
                    const v = maps.find((b) => b.id === userVote);
                    return v ? <BeatmapCardPlatform beatmap={v} voted onVote={() => setUserVote(null)} showVoteButton /> : null;
                  })()}
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-7 h-7 text-slate-700" />
                  </div>
                  <p className="text-white font-bold mb-1">Your vote is waiting</p>
                  <p className="text-sm text-slate-500 mb-5">
                    Pick the beatmap you want as this month's challenge.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('vote')}
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all"
                  >
                    Vote Now
                  </button>
                </div>
              )}
            </div>

            {/* Currently leading */}
            <div className="bg-[#0d1526] border border-amber-400/25 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-3 right-3 opacity-5">
                <Crown className="w-20 h-20 text-amber-400" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-mono font-bold">Currently Leading</p>
                {leadingMap && (
                  <span className="ml-auto text-[10px] font-mono text-slate-600">{leadingMap.voteCount ?? 0} votes</span>
                )}
              </div>
              {leadingMap ? (
                <BeatmapCardPlatform
                  beatmap={leadingMap}
                  showVoteButton
                  voted={userVote === leadingMap.id}
                  onVote={() => setUserVote(userVote === leadingMap.id ? null : leadingMap.id)}
                />
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">Nothing has been approved for voting yet.</p>
              )}
            </div>
          </div>

          {/* All submissions */}
          <section>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-1">{roundLabel(round)}</p>
                <h2 className="text-xl font-black text-white">All Submitted Beatmaps</h2>
              </div>
              <span className="text-xs text-slate-600 font-mono">{maps.length} beatmaps</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {maps.map((b) => (
                <BeatmapCardPlatform
                  key={b.id}
                  beatmap={b}
                  showVoteButton
                  voted={userVote === b.id}
                  onVote={() => setUserVote(userVote === b.id ? null : b.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── CHALLENGE PHASE ───────────────────────────────────────────── */}
      {phase === 'challenge' && (
        <div className="space-y-8">
          {/* Winning beatmap hero. Reaching the challenge phase with nothing
              approved is degenerate, but a phase can be advanced by hand, so the
              map-dependent half is guarded. */}
          {leadingMap ? (
          <div className="relative rounded-2xl overflow-hidden border border-purple-500/20 min-h-[220px]">
            <div className="absolute inset-0">
              <img
                src={leadingMap.coverUrl}
                alt={leadingMap.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-25"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060c18] via-[#060c18]/85 to-[#060c18]/40" />
            </div>
            <div className="relative px-8 py-10 flex items-center justify-between gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase font-mono">
                    Monthly Challenge · {roundLabel(round)}
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white mb-1 tracking-tight">{leadingMap.title}</h2>
                <p className="text-slate-300 mb-1">{leadingMap.artist}</p>
                <p className="text-slate-500 text-sm mb-5">
                  mapped by <span className="text-slate-300 font-medium">{leadingMap.mapper}</span>
                  <span className="mx-2 text-slate-700">·</span>
                  <span className="font-mono text-amber-400">★ {leadingMap.stars.toFixed(2)}</span>
                  <span className="mx-2 text-slate-700">·</span>
                  <span className="font-mono text-slate-400">{leadingMap.bpm} BPM</span>
                  <span className="mx-2 text-slate-700">·</span>
                  <span className="font-mono text-slate-400">{leadingMap.length}</span>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/70 border border-slate-700 rounded-full">
                    <span className="text-[10px] text-slate-500">Required mod</span>
                    <span className="text-sm font-black font-mono text-white">{leadingMap.modRequirement}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 border border-amber-400/25 rounded-full">
                    <span className="text-[10px] text-slate-500">Challenge</span>
                    <span className="text-sm font-bold text-amber-400">{leadingMap.challengeType}</span>
                  </div>
                </div>
              </div>

              {/* Countdown + Bounty */}
              <div className="flex flex-col gap-3 flex-shrink-0">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-right">
                  <div className="flex items-center gap-2 justify-end mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Challenge ends in</span>
                  </div>
                  <div className="text-3xl font-black font-mono text-purple-400">{countdown}</div>
                </div>
                <div className="bg-amber-400/10 border border-amber-400/25 rounded-2xl px-6 py-4 text-right">
                  <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-bold mb-1">Monthly Bounty</p>
                  <p className="text-sm font-black text-amber-400">{round.reward || 'To be announced'}</p>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-[#0d1526] border border-slate-800 rounded-2xl px-8 py-10 flex items-center justify-between gap-6 flex-wrap">
              <div>
                <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase font-mono">
                  Monthly Challenge · {roundLabel(round)}
                </span>
                <p className="text-sm text-slate-400 mt-2 max-w-md">
                  No approved beatmap is on record for this round, so there is no challenge map to show.
                </p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-right flex-shrink-0">
                <div className="flex items-center gap-2 justify-end mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Challenge ends in</span>
                </div>
                <div className="text-3xl font-black font-mono text-purple-400">{countdown}</div>
              </div>
            </div>
          )}

          {/* My rank + leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* My rank card */}
            <div className="bg-[#0d1526] border border-amber-400/20 rounded-2xl p-6">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-5">My Challenge Rank</p>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-amber-400/10 border-2 border-amber-400/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 font-black text-xl">#5</span>
                </div>
                <div>
                  <p className="text-white font-bold">helixia_dz</p>
                  <div className="mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                      NOT QUALIFIED
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Score',    value: '4,201,880' },
                  { label: 'Accuracy', value: '95.3%'     },
                  { label: 'Misses',   value: '7'         },
                  { label: 'Mods',     value: 'NM'        },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-sm font-black font-mono text-white">{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
                You need <span className="text-amber-400 font-bold">0 misses</span> to qualify for the FC challenge. Keep grinding!
              </p>
            </div>

            {/* Leaderboard */}
            <div className="lg:col-span-2">
              <ChallengeLeaderboard roundNumber={round.roundNumber} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
