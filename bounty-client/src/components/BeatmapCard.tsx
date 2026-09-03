import React, { useRef, useState } from 'react';
import { BeatmapBounty, BeatmapComment } from '../types';
import {
  Star, Play, Pause, MessageSquare, Heart,
  CheckCircle2, Sliders, Trophy, Medal, Zap, Target, Flame, Crown,
  CornerDownRight, Send, X,
} from 'lucide-react';

interface BeatmapCardProps {
  bounty: BeatmapBounty;
  isPlaying: boolean;
  audioProgress: number;
  onTogglePlay: () => void;
  onScrubAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVote: () => void;
  onFavorite: () => void;
  onOpenComments: () => void;
  onPostComment?: (text: string, parentId?: string) => void;
  onInspectCard?: () => void;
}

const difficultyColors = {
  Bronze:   { bg: 'bg-amber-900/40', border: 'border-amber-700/60', text: 'text-amber-400',  badge: 'bg-amber-800/60' },
  Silver:   { bg: 'bg-slate-700/40', border: 'border-slate-500/60', text: 'text-slate-300',  badge: 'bg-slate-700/60' },
  Gold:     { bg: 'bg-yellow-900/40', border: 'border-yellow-500/60', text: 'text-yellow-400', badge: 'bg-yellow-800/60' },
  Platinum: { bg: 'bg-cyan-900/40', border: 'border-cyan-500/60',   text: 'text-cyan-400',   badge: 'bg-cyan-800/60' },
};

const challengeIcons: Record<string, React.ReactNode> = {
  trophy: <Trophy className="w-4 h-4" />,
  medal:  <Medal  className="w-4 h-4" />,
  zap:    <Zap    className="w-4 h-4" />,
  target: <Target className="w-4 h-4" />,
  flame:  <Flame  className="w-4 h-4" />,
  crown:  <Crown  className="w-4 h-4" />,
};

const ratingColors = [
  'text-rose-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400', 'text-cyan-400',
];

export const BeatmapCard: React.FC<BeatmapCardProps> = ({
  bounty, isPlaying, audioProgress,
  onTogglePlay, onScrubAudio, onVote, onFavorite, onOpenComments, onPostComment, onInspectCard,
}) => {
  const [isFlipped, setIsFlipped]     = useState(false);
  const [spinClass, setSpinClass]     = useState('');
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment]   = useState('');
  const [replyingTo, setReplyingTo]   = useState<string | null>(null);
  const [replyText, setReplyText]     = useState('');
  const spinRef = useRef<(() => void) | null>(null);

  const comments: BeatmapComment[] = bounty.comments;

  const isHighDifficulty = bounty.difficultyRating >= 4.2;
  const headerBgClass   = isHighDifficulty ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950';
  const barFillColor    = isHighDifficulty ? 'bg-rose-400' : 'bg-amber-400';

  const formatTime = (ratio: number, total: number) => {
    const s = Math.floor(ratio * total);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const triggerSpin = (callback: () => void) => {
    spinRef.current = callback;
    setSpinClass('spinning');
  };

  const handleAnimationEnd = () => {
    spinRef.current?.();
    spinRef.current = null;
    setSpinClass('');
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-scrub]') || target.closest('input') || target.closest('textarea')) return;
    setIsFlipped((f) => !f);
  };

  const handleSubmitComment = () => {
    const text = newComment.trim();
    if (!text) return;
    onPostComment?.(text);
    setNewComment('');
  };

  const handleSubmitReply = (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    onPostComment?.(text, parentId);
    setReplyText('');
    setReplyingTo(null);
  };

  const innerClass = `card-inner ${isFlipped ? 'flipped' : ''} ${spinClass}`;

  return (
    <div className="card-scene w-full" style={{ height: '640px' }}>
      <div
        className={innerClass}
        onAnimationEnd={handleAnimationEnd}
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        {/* ── FRONT FACE ── */}
        <div className="card-face bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-500/90 transition-shadow duration-300 flex flex-col text-slate-100 group">

          <div className={`w-full py-1.5 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.ceil(bounty.difficultyRating)) }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current stroke-current" />
              ))}
            </div>
            <span className="font-mono font-black text-sm tracking-tight">{bounty.difficultyRating.toFixed(2)}</span>
          </div>

          <div className="relative h-36 w-full bg-slate-900 overflow-hidden flex-shrink-0">
            {bounty.bannerUrl ? (
              <img src={bounty.bannerUrl} alt={bounty.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />
            <span className="absolute top-2.5 left-2.5 bg-slate-950/80 backdrop-blur-md text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-slate-700/80 text-slate-200">
              {bounty.genre}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }}
              aria-label="Favorite"
              className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                bounty.userFavorited
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${bounty.userFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <div className="absolute bottom-2 right-2.5 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-700/80 flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-white font-mono">{bounty.votes.toLocaleString()}</span>
              <span className="text-slate-400 text-[10px]">votes</span>
            </div>
          </div>

          <div className="px-4 pt-4 flex-shrink-0">
            <h3 className="text-base font-bold text-white tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors">{bounty.title}</h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">{bounty.artist}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">mapped by <span className="text-slate-200 font-semibold">{bounty.mapper}</span></p>
            <div className="mt-2 mb-3">
              <span className="inline-block bg-slate-800/90 text-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">{bounty.difficultyName}</span>
            </div>
          </div>

          {/* Animated panel switcher */}
          <div className="flex-1 overflow-hidden relative px-4">
            {/* Specs */}
            <div
              className="absolute inset-x-4 top-0"
              style={{
                opacity: showComments ? 0 : 1,
                transform: showComments ? 'translateY(-12px)' : 'translateY(0)',
                transition: 'opacity 0.28s ease, transform 0.28s ease',
                pointerEvents: showComments ? 'none' : 'auto',
              }}
            >
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 mb-3 space-y-2">
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5"><span className="text-slate-400">Length</span><span className="text-slate-100 font-bold font-mono">{bounty.length}</span></div>
                  <div className="flex items-center gap-1.5"><span className="text-slate-400">BPM</span><span className="text-slate-100 font-bold font-mono">{bounty.bpm}</span></div>
                </div>
                {[
                  { label: 'Circle Size',   value: bounty.circleSize,   max: 7  },
                  { label: 'Approach Rate', value: bounty.approachRate, max: 10 },
                  { label: 'Accuracy',      value: bounty.accuracy,     max: 10 },
                  { label: 'HP Drain',      value: bounty.hpDrain,      max: 10 },
                ].map(({ label, value, max }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-200 font-bold font-mono">{value.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${barFillColor}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isPlaying ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <div data-scrub="true" onClick={(e) => { e.stopPropagation(); onScrubAudio(e); }} className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden cursor-pointer">
                  <div className={`absolute inset-y-0 left-0 rounded-full ${isPlaying ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${Math.round(audioProgress * 100)}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums font-mono w-12 text-right">{formatTime(audioProgress, bounty.previewSeconds || 60)}</span>
              </div>
            </div>

            {/* Comments */}
            <div
              className="absolute inset-x-0 top-0 flex flex-col h-full"
              style={{
                opacity: showComments ? 1 : 0,
                transform: showComments ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.28s ease, transform 0.28s ease',
                pointerEvents: showComments ? 'auto' : 'none',
              }}
            >
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-0.5">
                {comments.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No comments yet. Be the first!</p>}
                {comments.map((c) => (
                  <div key={c.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-300 uppercase flex-shrink-0">{c.user[0]}</div>
                        <span className="text-[11px] font-bold text-slate-200">{c.user}</span>
                        <span className="text-[10px] text-slate-600">{c.time}</span>
                      </div>
                      {c.rating != null && <span className={`text-[10px] font-mono font-bold ${ratingColors[(c.rating - 1) % ratingColors.length]}`}>★{c.rating}</span>}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{c.text}</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(''); }} className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                      <CornerDownRight className="w-3 h-3" /> Reply
                    </button>
                    {replyingTo === c.id && (
                      <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input autoFocus type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitReply(c.id); }} placeholder="Write a reply…" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400/60" />
                        <button type="button" onClick={() => handleSubmitReply(c.id)} className="p-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors"><Send className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }} placeholder="Add a comment…" className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-colors" />
                <button type="button" onClick={handleSubmitComment} className="px-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex-shrink-0"><Send className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-3 px-4 pb-4 border-t border-slate-800 flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                bounty.userVoted ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
              }`}
            >
              {bounty.userVoted ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Voted (+{bounty.bountyRewardPoints} pts)</span></> : <span>Vote (+{bounty.bountyRewardPoints} pts)</span>}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowComments((v) => !v); if (!showComments) onOpenComments(); }}
              className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showComments ? 'bg-amber-400/20 border-amber-400/60 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              {showComments ? <X className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
              {!showComments && comments.length > 0 && <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded-full font-bold">{comments.length}</span>}
            </button>
            {onInspectCard && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onInspectCard(); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"><Sliders className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div className="card-face card-face-back bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg flex flex-col text-slate-100">
          <div className={`w-full py-2 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <span className="font-mono font-black">BOUNTY CHALLENGES</span>
            <Trophy className="w-4 h-4" />
          </div>
          <div className="relative h-20 overflow-hidden flex-shrink-0">
            {bounty.bannerUrl ? (
              <img src={bounty.bannerUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-30" />
            ) : (
              <div className="w-full h-full bg-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/60 to-[#0f172a]" />
            <div className="absolute inset-0 p-3 flex flex-col justify-center">
              <p className="text-sm font-black text-white line-clamp-1">{bounty.title}</p>
              <p className="text-[11px] text-slate-400">{bounty.artist} · mapped by {bounty.mapper}</p>
              <p className="text-[10px] text-amber-400 font-mono mt-0.5 font-bold">★ {bounty.difficultyRating.toFixed(2)} · {bounty.difficultyName}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Complete challenges · Earn points</p>
            {bounty.challenges.map((ch) => {
              const colors = difficultyColors[ch.difficulty];
              return (
                <div key={ch.id} className={`rounded-xl border p-3 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.badge} ${colors.text}`}>{challengeIcons[ch.icon] ?? <Trophy className="w-4 h-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${colors.text} leading-tight`}>{ch.title}</p>
                        <span className={`text-[10px] font-mono font-black ${colors.text} flex-shrink-0`}>+{ch.reward} pts</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{ch.description}</p>
                      <p className="text-[10px] text-slate-600 mt-1 font-mono">{ch.completedBy.toLocaleString()} players completed</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${bounty.userVoted ? 'bg-emerald-600 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'}`}>
              {bounty.userVoted ? <><CheckCircle2 className="w-3.5 h-3.5" /> Voted</> : `Vote · +${bounty.bountyRewardPoints} pts`}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${bounty.userFavorited ? 'bg-rose-500/20 border-rose-500/60 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
              <Heart className={`w-3.5 h-3.5 ${bounty.userFavorited ? 'fill-rose-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
