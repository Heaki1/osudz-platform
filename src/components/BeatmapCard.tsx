import React, { useRef, useState } from 'react';
import { Beatmap, BeatmapComment } from '../types';
import {
  Star, Play, Pause, MessageSquare, Heart,
  CheckCircle2, Trophy,
  CornerDownRight, Send, X,
} from 'lucide-react';

interface BeatmapCardProps {
  beatmap: Beatmap;
  isPlaying: boolean;
  audioProgress: number;
  onTogglePlay: () => void;
  onScrubAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVote: () => void;
  onFavorite: () => void;
  onOpenComments: () => void;
}

const ratingColors = [
  'text-rose-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400', 'text-cyan-400',
];

export const BeatmapCard: React.FC<BeatmapCardProps> = ({
  beatmap, isPlaying, audioProgress,
  onTogglePlay, onScrubAudio, onVote, onFavorite, onOpenComments,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [spinClass, setSpinClass] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState<BeatmapComment[]>(beatmap.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const spinRef = useRef<(() => void) | null>(null);

  const isHighDifficulty = beatmap.stars >= 4.2;
  const headerBgClass = isHighDifficulty ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950';
  const barFillColor = isHighDifficulty ? 'bg-rose-400' : 'bg-amber-400';

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
    const comment: BeatmapComment = {
      id: Date.now().toString(),
      user: 'you',
      avatar: '',
      time: 'just now',
      text,
      rating: undefined,
    };
    setLocalComments((prev) => [comment, ...prev]);
    setNewComment('');
  };

  const handleSubmitReply = (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    const reply: BeatmapComment = {
      id: Date.now().toString(),
      user: 'you',
      avatar: '',
      time: 'just now',
      text: `@${localComments.find((c) => c.id === parentId)?.user ?? 'user'} ${text}`,
    };
    setLocalComments((prev) => {
      const idx = prev.findIndex((c) => c.id === parentId);
      const next = [...prev];
      next.splice(idx + 1, 0, reply);
      return next;
    });
    setReplyText('');
    setReplyingTo(null);
  };

  const innerClass = `card-inner ${isFlipped ? 'flipped' : ''} ${spinClass}`;

  return (
    <div className="card-scene w-full" style={{ height: '540px' }}>
      <div
        className={innerClass}
        onAnimationEnd={handleAnimationEnd}
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        {/* ── FRONT FACE ── */}
        <div className="card-face bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-500/90 transition-shadow duration-300 flex flex-col text-slate-100 group">

          {/* Star Rating Banner */}
          <div className={`w-full py-1.5 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.ceil(beatmap.stars)) }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current stroke-current" />
              ))}
            </div>
            <span className="font-mono font-black text-sm tracking-tight">{beatmap.stars.toFixed(2)}</span>
          </div>

          {/* Cover Artwork */}
          <div className="relative h-28 w-full bg-slate-900 overflow-hidden flex-shrink-0">
            <img
              src={beatmap.coverUrl}
              alt={beatmap.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }}
              aria-label="Favorite"
              className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                beatmap.isFavorited
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${beatmap.isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <div className="absolute bottom-2 right-2.5 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-700/80 flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-white font-mono">{(beatmap.voteCount ?? 0).toLocaleString()}</span>
              <span className="text-slate-400 text-[10px]">votes</span>
            </div>
          </div>

          {/* Info */}
          <div className="px-4 pt-3 flex-shrink-0">
            <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors">
              {beatmap.title}
            </h3>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">{beatmap.artist}
              <span className="text-slate-500 font-normal"> · mapped by </span>
              <span className="text-slate-200 font-semibold">{beatmap.mapper}</span>
            </p>
            <div className="mt-1.5 mb-2">
              <span className="inline-block bg-slate-800/90 text-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                {beatmap.difficultyName}
              </span>
            </div>
          </div>

          {/* ── ANIMATED PANEL SWITCHER ── */}
          <div className="flex-1 overflow-hidden relative px-4">
            {/* Specs panel */}
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Length</span>
                    <span className="text-slate-100 font-bold font-mono">{beatmap.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">BPM</span>
                    <span className="text-slate-100 font-bold font-mono">{beatmap.bpm}</span>
                  </div>
                </div>
                {[
                  { label: 'Circle Size', value: beatmap.cs ?? 0, max: 7 },
                  { label: 'Approach Rate', value: beatmap.ar ?? 0, max: 10 },
                  { label: 'Accuracy', value: beatmap.od ?? 0, max: 10 },
                  { label: 'HP Drain', value: beatmap.hp ?? 0, max: 10 },
                ].map(({ label, value, max }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-200 font-bold font-mono">{value.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barFillColor}`}
                        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Audio Player */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isPlaying ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <div
                  data-scrub="true"
                  onClick={(e) => { e.stopPropagation(); onScrubAudio(e); }}
                  className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden cursor-pointer"
                >
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${isPlaying ? 'bg-amber-400' : 'bg-slate-400'}`}
                    style={{ width: `${Math.round(audioProgress * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums font-mono w-12 text-right">
                  {formatTime(audioProgress, beatmap.previewSeconds || 60)}
                </span>
              </div>
            </div>

            {/* Comments panel */}
            <div
              className="absolute inset-x-0 top-0 flex flex-col h-full"
              style={{
                opacity: showComments ? 1 : 0,
                transform: showComments ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.28s ease, transform 0.28s ease',
                pointerEvents: showComments ? 'auto' : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-2 px-0">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  {localComments.length} comment{localComments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Comment list */}
              <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                {localComments.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">No comments yet. Be the first!</p>
                )}
                {localComments.map((c) => (
                  <div key={c.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-300 uppercase flex-shrink-0">
                          {c.user[0]}
                        </div>
                        <span className="text-[11px] font-bold text-slate-200">{c.user}</span>
                        <span className="text-[10px] text-slate-600">{c.time}</span>
                      </div>
                      {c.rating != null && (
                        <span className={`text-[10px] font-mono font-bold ${ratingColors[(c.rating - 1) % ratingColors.length]}`}>
                          ★{c.rating}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{c.text}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(replyingTo === c.id ? null : c.id);
                        setReplyText('');
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      Reply
                    </button>

                    {/* Inline reply input */}
                    {replyingTo === c.id && (
                      <div
                        className="mt-2 flex gap-1.5 pl-3 border-l-2 border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitReply(c.id); }}
                          placeholder={`Reply to ${localComments.find((x) => x.id === c.id)?.user ?? 'user'}…`}
                          className="flex-1 bg-slate-950/60 border border-slate-800 rounded-md px-2 py-1 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(c.id)}
                          className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                          <Send className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* New comment input */}
              <div
                className="mt-2 flex gap-1.5 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                  placeholder="Add a comment…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  className="px-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-3 px-4 pb-4 border-t border-slate-800 flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                beatmap.isVoted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
              }`}
            >
              {beatmap.isVoted
                ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Voted</span></>
                : <span>Vote</span>}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowComments((v) => !v);
                onOpenComments();
              }}
              className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showComments
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Toggle comments"
            >
              {showComments
                ? <X className="w-3.5 h-3.5" />
                : <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
              {!showComments && localComments.length > 0 && (
                <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded-full font-bold">{localComments.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div className="card-face card-face-back bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg flex flex-col text-slate-100">
          <div className={`w-full py-2 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <span className="font-mono font-black">SUBMISSION DETAILS</span>
            <Trophy className="w-4 h-4" />
          </div>

          <div className="relative h-16 overflow-hidden flex-shrink-0">
            <img src={beatmap.coverUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/60 to-[#0f172a]" />
            <div className="absolute inset-0 p-3 flex flex-col justify-center">
              <p className="text-sm font-black text-white line-clamp-1">{beatmap.title}</p>
              <p className="text-[11px] text-slate-400">{beatmap.artist} · mapped by {beatmap.mapper}</p>
              <p className="text-[10px] text-amber-400 font-mono mt-0.5 font-bold">
                ★ {beatmap.stars.toFixed(2)} · {beatmap.difficultyName}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Challenge requirements
            </p>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
              {[
                { label: 'Mod requirement', value: beatmap.modRequirement, mono: true },
                { label: 'Challenge type', value: beatmap.challengeType, mono: false },
                { label: 'Submitted by', value: beatmap.submittedByName, mono: false },
                { label: 'Map status', value: beatmap.status, mono: false },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-[11px] text-slate-500">{label}</span>
                  <span
                    className={`text-[11px] font-bold text-slate-100 text-right ${mono ? 'font-mono' : ''} ${
                      value ? '' : 'text-slate-600'
                    }`}
                  >
                    {value || '—'}
                  </span>
                </div>
              ))}
            </div>

            {beatmap.description && (
              <p className="text-[11px] text-slate-400 leading-snug px-1">{beatmap.description}</p>
            )}
          </div>

          <div className="p-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                beatmap.isVoted ? 'bg-emerald-600 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {beatmap.isVoted ? <><CheckCircle2 className="w-3.5 h-3.5" /> Voted</> : 'Vote'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }}
              className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                beatmap.isFavorited
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${beatmap.isFavorited ? 'fill-rose-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
