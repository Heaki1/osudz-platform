import React, { useEffect, useRef, useState } from 'react';
import { ArchiveEntry } from '../../types';
import { archiveData } from './sampleData';
import {
  Crown, Star, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Trophy, Users, Music2, Play, Pause,
} from 'lucide-react';

// ── STATUS BADGE ─────────────────────────────────────────────────────────────

const statusConfig = {
  ranked:   { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', label: 'Ranked'   },
  loved:    { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/30',    label: 'Loved'    },
  approved: { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30',     label: 'Approved' },
};

// ── LEADERBOARD SNAPSHOT ──────────────────────────────────────────────────────

function LeaderboardSnapshot({ entries }: { entries: ArchiveEntry['leaderboard'] }) {
  return (
    <div className="mt-5 border border-slate-800/60 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Challenge Leaderboard</span>
      </div>
      <div className="divide-y divide-slate-800/40">
        {entries.map((e) => (
          <div
            key={e.rank}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs ${
              e.rank === 1 ? 'bg-amber-400/5' : ''
            }`}
          >
            <span className={`w-5 font-black font-mono flex-shrink-0 ${e.rank === 1 ? 'text-amber-400' : 'text-slate-600'}`}>
              #{e.rank}
            </span>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
              e.qualified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
            }`}>
              {e.username[0].toUpperCase()}
            </div>
            <span className="flex-1 font-bold text-white truncate">{e.username}</span>
            <span className="font-mono text-slate-300 w-24 text-right flex-shrink-0">{e.score.toLocaleString()}</span>
            <span className="font-mono text-slate-500 w-14 text-right flex-shrink-0">{e.accuracy.toFixed(1)}%</span>
            <span className={`font-mono w-10 text-right flex-shrink-0 ${e.misses === 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>
              {e.misses}×
            </span>
            <span className="w-12 text-right flex-shrink-0">
              <span className="text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                {e.mods}
              </span>
            </span>
            <div className="w-24 flex justify-end flex-shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                e.qualified
                  ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/15 text-rose-400'
              }`}>
                {e.qualified
                  ? <><CheckCircle2 className="w-3 h-3" />QUALIFIED</>
                  : <><AlertCircle className="w-3 h-3" />NOT QUAL.</>
                }
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ROUND CARD ────────────────────────────────────────────────────────────────

function RoundCard({ entry }: { entry: ArchiveEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { winner, challengeWinner } = entry;

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!winner.previewUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(winner.previewUrl);
      audio.ontimeupdate = () => {
        const a = audioRef.current;
        if (a && a.duration) setProgress(a.currentTime / a.duration);
      };
      audio.onended = () => { setIsPlaying(false); setProgress(0); };
      audioRef.current = audio;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };
  const status = statusConfig[winner.status];
  const voteShare = Math.round((winner.votes / entry.winner.totalVotes) * 100);

  return (
    <div className="bg-[#0d1526] border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700/80 transition-all">

      {/* Cover hero */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={winner.coverUrl}
          alt={winner.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] via-[#0d1526]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1526]/80 to-transparent" />

        {/* Round badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-slate-950/80 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Round</p>
            <p className="text-lg font-black font-mono text-white leading-none">{entry.round}</p>
          </div>
          <div className="bg-slate-950/80 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Month</p>
            <p className="text-sm font-black text-white leading-none">{entry.month} {entry.year}</p>
          </div>
        </div>

        {/* Crown + preview */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {winner.previewUrl && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all ${
                isPlaying
                  ? 'bg-amber-400/30 border-amber-400/60 text-amber-400'
                  : 'bg-slate-950/70 border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 fill-current ml-0.5" />
              }
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        {/* Winner info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${status.bg} ${status.text} ${status.border}`}>
                  {status.label}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono font-black text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {winner.stars.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{winner.bpm} BPM · {winner.length}</span>
              </div>
              <h3 className="text-xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                {winner.title}
              </h3>
              <p className="text-sm text-slate-300 mt-0.5">{winner.artist}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                mapped by <span className="text-slate-300 font-semibold">{winner.mapper}</span>
                {' · '}submitted by <span className="text-slate-300 font-semibold">{winner.submittedBy}</span>
              </p>
            </div>

            {/* Vote share */}
            <div className="flex-shrink-0 text-right">
              <p className="text-[9px] uppercase tracking-widest text-slate-600 font-mono mb-1">Vote share</p>
              <p className="text-2xl font-black font-mono text-amber-400">{voteShare}%</p>
              <p className="text-[10px] text-slate-600 font-mono">{winner.votes} / {winner.totalVotes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {/* Audio progress strip — only shown while playing */}
        {isPlaying && (
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex-1 h-1 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-amber-400/70 font-mono flex-shrink-0">preview</span>
          </div>
        )}

        {/* Challenge requirements + stats row */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-[10px] font-mono font-bold bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 px-2.5 py-1 rounded-lg">
            {winner.mod}
          </span>
          <span className="text-[10px] font-bold bg-amber-400/8 border border-amber-400/20 text-amber-400/90 px-2.5 py-1 rounded-lg">
            {winner.challengeType}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono ml-auto">
            <Users className="w-3.5 h-3.5" />
            {entry.participants} participants
          </div>
        </div>

        {/* Challenge winner strip */}
        <div className="flex items-center gap-4 bg-amber-400/6 border border-amber-400/15 rounded-xl px-4 py-3 mb-4">
          <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-amber-400/60 font-mono mb-0.5">Challenge Winner</p>
            <p className="text-sm font-black text-white">{challengeWinner.username}</p>
          </div>
          <div className="flex items-center gap-5 text-right flex-shrink-0">
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Score</p>
              <p className="text-sm font-black font-mono text-white">{challengeWinner.score.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Acc</p>
              <p className="text-sm font-black font-mono text-emerald-400">{challengeWinner.accuracy.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Miss</p>
              <p className="text-sm font-black font-mono text-white">{challengeWinner.misses}</p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-slate-300">
              {challengeWinner.mods}
            </span>
          </div>
        </div>

        {/* Expand leaderboard */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-300 text-xs font-bold transition-all"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" />Hide leaderboard</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" />Show full leaderboard ({entry.leaderboard.length} players)</>
          )}
        </button>

        {expanded && <LeaderboardSnapshot entries={entry.leaderboard} />}
      </div>
    </div>
  );
}

// ── ARCHIVE PAGE ──────────────────────────────────────────────────────────────

export function ArchivePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-1">osudz.ppy</p>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Round Archive</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Every past monthly round — winning beatmaps, vote tallies, and challenge leaderboard snapshots.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Rounds completed', value: archiveData.length, icon: <Trophy className="w-4 h-4 text-amber-400" /> },
          { label: 'Total players',    value: archiveData.reduce((s, r) => s + r.participants, 0), icon: <Users className="w-4 h-4 text-blue-400" /> },
          { label: 'Total votes cast', value: archiveData.reduce((s, r) => s + r.winner.totalVotes, 0), icon: <Music2 className="w-4 h-4 text-purple-400" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-[#0d1526] border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-mono">{label}</p>
              <p className="text-xl font-black font-mono text-white">{value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Round cards */}
      <div className="space-y-6">
        {archiveData.map((entry) => (
          <RoundCard key={entry.round} entry={entry} />
        ))}
      </div>

      {/* Current round notice */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-full px-5 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-slate-500">
            Round 4 · August 2026 is currently in progress
          </span>
        </div>
      </div>
    </div>
  );
}
