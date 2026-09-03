import React, { useState } from 'react';
import { BeatmapCard } from '../BeatmapCard';
import { BeatmapBounty } from '../../types';
import { AuthUser } from './NavHeader';
import { Crown, Trophy, ChevronRight, LogIn, X } from 'lucide-react';

// ── LOGIN MODAL ───────────────────────────────────────────────────────────────

function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d1526] border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/25 flex items-center justify-center mx-auto mb-5">
          <LogIn className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-black text-white mb-2">Login to vote</h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Only verified Algerian osu! players can vote. Log in with your osu! account to cast your vote.
        </p>
        <button
          type="button"
          onClick={() => { onLogin?.(); onClose(); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all"
        >
          <LogIn className="w-4 h-4" />
          Login with osu!
        </button>
        <p className="text-[10px] text-slate-600 mt-3">You get one vote per round.</p>
      </div>
    </div>
  );
}

// ── VOTE STANDINGS PANEL ─────────────────────────────────────────────────────

function VoteStandings({ maps, votedId }: { maps: BeatmapBounty[]; votedId: string | null }) {
  const sorted = [...maps].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes ?? 1;

  return (
    <div className="bg-[#0d1526] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Vote Standings</h3>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">
          {maps.reduce((s, m) => s + m.votes, 0).toLocaleString()} total
        </span>
      </div>
      <div className="divide-y divide-slate-800/40">
        {sorted.map((m, i) => {
          const pct = Math.round((m.votes / maxVotes) * 100);
          const isLeader = i === 0;
          const isMyVote = m.id === votedId;
          return (
            <div key={m.id} className={`px-5 py-3 ${isMyVote ? 'bg-amber-400/4' : ''}`}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className={`w-5 text-[11px] font-black font-mono flex-shrink-0 ${isLeader ? 'text-amber-400' : 'text-slate-600'}`}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between mb-0.5">
                    <span className="text-xs font-bold text-white truncate">{m.title}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isMyVote && (
                        <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          You
                        </span>
                      )}
                      <span className="text-[11px] font-black font-mono text-white">{m.votes.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isLeader ? 'bg-amber-400' : isMyVote ? 'bg-blue-400' : 'bg-slate-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="w-8 text-[10px] font-mono text-slate-500 text-right flex-shrink-0">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VOTE PAGE ─────────────────────────────────────────────────────────────────

interface VotePageProps {
  maps: BeatmapBounty[];
  playingId: string | null;
  audioProgress: (id: string) => number;
  onTogglePlay: (id: string) => void;
  onScrub: (id: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onVote: (id: string) => void;
  onFavorite: (id: string) => void;
  user: AuthUser | null;
  onLogin?: () => void;
}

export function VotePage({ maps, playingId, audioProgress, onTogglePlay, onScrub, onVote, onFavorite, user, onLogin }: VotePageProps) {
  const sorted = [...maps].sort((a, b) => b.votes - a.votes);
  const leader = sorted[0];
  const totalVotes = maps.reduce((s, m) => s + m.votes, 0);
  const userVoted = maps.find((m) => m.userVoted);
  const [showAll, setShowAll] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const visibleMaps = showAll ? sorted : sorted.slice(0, 6);

  const handleVoteAttempt = (id: string) => {
    if (!user) { setShowLoginModal(true); return; }
    onVote(id);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => { onLogin?.(); setShowLoginModal(false); }}
        />
      )}
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-black tracking-widest text-blue-400 font-mono uppercase">Voting Phase</span>
          <span className="text-slate-700">·</span>
          <span className="text-[10px] text-slate-500 font-mono">Round 1 · August 2026</span>
          <span className="text-slate-700">·</span>
          <span className="text-[10px] text-slate-500 font-mono">Ends in 18h 04m</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Vote for the Monthly Challenge</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Algerian osu! players get one vote. Flip a card to see challenges. The beatmap with the most votes becomes this month's challenge.
        </p>
      </div>

      {/* Stats + vote status */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4 bg-[#0d1526] border border-slate-800 rounded-xl px-5 py-3 flex-wrap gap-y-2">
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Total votes</div>
            <div className="text-xl font-black font-mono text-white">{totalVotes.toLocaleString()}</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Submissions</div>
            <div className="text-xl font-black font-mono text-white">{maps.length}</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Leading</div>
              <div className="text-sm font-black text-amber-400 truncate max-w-40">{leader?.title}</div>
            </div>
          </div>
        </div>

        {userVoted ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-black text-emerald-400">Vote cast</p>
              <p className="text-[10px] text-emerald-400/60 truncate max-w-[160px]">{userVoted.title}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <p className="text-xs font-bold text-amber-400/80">Flip a card to vote</p>
          </div>
        )}
      </div>

      {/* Main layout — card grid + standings sidebar */}
      <div className="flex gap-7 items-start">

        {/* Card grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">All Submissions</h2>
            <span className="text-[10px] text-slate-600 font-mono">{maps.length} beatmaps</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibleMaps.map((bounty) => {
              const isLeader = bounty.id === leader?.id;
              return (
                <div key={bounty.id} className="relative">
                  {isLeader && (
                    <div className="absolute -top-3 left-4 z-10 flex items-center gap-1.5 bg-amber-400 text-slate-950 text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-amber-400/25">
                      <Crown className="w-3 h-3" />
                      Leading · {bounty.votes.toLocaleString()} votes
                    </div>
                  )}
                  <BeatmapCard
                    bounty={bounty}
                    isPlaying={playingId === bounty.id}
                    audioProgress={audioProgress(bounty.id)}
                    onTogglePlay={() => onTogglePlay(bounty.id)}
                    onScrubAudio={(e) => onScrub(bounty.id, e)}
                    onVote={() => handleVoteAttempt(bounty.id)}
                    onFavorite={() => onFavorite(bounty.id)}
                    onOpenComments={() => {}}
                  />
                </div>
              );
            })}
          </div>

          {sorted.length > 6 && !showAll && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
              >
                Show all {sorted.length} submissions
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Standings sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24">
          <VoteStandings maps={maps} votedId={userVoted?.id ?? null} />
          {!user && (
            <div className="mt-4 bg-[#0d1526] border border-slate-800 rounded-2xl px-4 py-4 text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                Log in with your osu! account to cast your vote.
              </p>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login with osu!
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
