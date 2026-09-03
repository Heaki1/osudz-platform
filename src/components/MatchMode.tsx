import React, { useState, useEffect } from 'react';
import { BeatmapBounty } from '../types';
import { Star, Swords, Trophy, RotateCcw, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

interface MatchModeProps {
  maps: BeatmapBounty[];
  onAwardPoints: (pts: number) => void;
}

type Phase = 'pick' | 'battle' | 'result';

const OPPONENT_NAME = 'whitecat';

const opponentDeck: Partial<BeatmapBounty>[] = [
  { id: 'opp1', title: 'Sekibaku no Maihime wa Kuraku Shizumu', artist: 'Se-U-Ra', mapper: 'Hinsvor', difficultyRating: 4.02, votes: 1100, genre: 'Anime', bannerUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop&q=80', bpm: 181, length: '01:51', circleSize: 3.2, approachRate: 8.0, accuracy: 6.5, hpDrain: 4.5, bountyRewardPoints: 75 },
  { id: 'opp2', title: 'Luxvinore', artist: 'Nordius Dystancius', mapper: 'Mir', difficultyRating: 3.66, votes: 920, genre: 'Electronic', bannerUrl: 'https://images.unsplash.com/photo-1462965326201-d02e4f455804?w=600&auto=format&fit=crop&q=80', bpm: 2, length: '02:58', circleSize: 3.8, approachRate: 7.5, accuracy: 6.0, hpDrain: 5.0, bountyRewardPoints: 50 },
  { id: 'opp3', title: 'CONFUSION PART ONE', artist: 'onumi', mapper: 'Leader', difficultyRating: 2.59, votes: 640, genre: 'Electronic', bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80', bpm: 165, length: '01:45', circleSize: 3.5, approachRate: 5.5, accuracy: 5.0, hpDrain: 4.0, bountyRewardPoints: 30 },
];

const STATS: { key: keyof BeatmapBounty; label: string; higherWins: boolean }[] = [
  { key: 'difficultyRating', label: 'Difficulty', higherWins: true },
  { key: 'votes',            label: 'Votes',      higherWins: true },
  { key: 'bpm',              label: 'BPM',        higherWins: true },
  { key: 'approachRate',     label: 'AR',         higherWins: true },
  { key: 'hpDrain',          label: 'HP Drain',   higherWins: true },
];

function MiniCard({ map, selected, onClick, disabled }: {
  map: BeatmapBounty;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isHigh = map.difficultyRating >= 4.2;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-xl overflow-hidden border transition-all text-left w-full ${
        selected
          ? 'border-amber-400 shadow-lg shadow-amber-400/20 scale-[1.02]'
          : 'border-slate-700/60 hover:border-slate-500'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <div className="relative h-20 bg-slate-900">
        <img src={map.bannerUrl} alt={map.title} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent" />
        <div className={`absolute top-0 left-0 right-0 py-1 px-2 flex items-center justify-between text-[10px] font-bold ${isHigh ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'}`}>
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(5, Math.ceil(map.difficultyRating)) }).map((_, i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-current" />
            ))}
          </div>
          <span className="font-mono">{map.difficultyRating.toFixed(2)}</span>
        </div>
      </div>
      <div className="bg-[#0f172a] px-2 py-1.5">
        <p className="text-xs font-bold text-white line-clamp-1">{map.title}</p>
        <p className="text-[10px] text-slate-400 line-clamp-1">{map.artist}</p>
        <p className="text-[10px] text-amber-400 font-mono font-bold">{(map.votes as number).toLocaleString()} votes</p>
      </div>
      {selected && (
        <div className="absolute top-7 right-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-slate-950" />
        </div>
      )}
    </button>
  );
}

export function MatchMode({ maps, onAwardPoints }: MatchModeProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opponentCardIdx] = useState(() => Math.floor(Math.random() * opponentDeck.length));
  const [battleStatIdx, setBattleStatIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'draw' | null>(null);

  const playerCard = maps.find((m) => m.id === selectedId);
  const opponentCard = opponentDeck[opponentCardIdx] as BeatmapBounty;
  const battleStat = STATS[battleStatIdx];

  useEffect(() => {
    if (phase !== 'battle' || revealed) return;
    if (countdown <= 0) {
      setRevealed(true);
      const pVal = playerCard ? (playerCard[battleStat.key] as number) : 0;
      const oVal = opponentCard[battleStat.key] as number;
      const w = pVal > oVal ? 'player' : pVal < oVal ? 'opponent' : 'draw';
      setWinner(w);
      if (w === 'player') onAwardPoints(playerCard?.bountyRewardPoints ?? 50);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, countdown, revealed, battleStat, playerCard, opponentCard, onAwardPoints]);

  const startBattle = () => {
    setPhase('battle');
    setRevealed(false);
    setCountdown(3);
    setWinner(null);
  };

  const reset = () => {
    setPhase('pick');
    setSelectedId(null);
    setRevealed(false);
    setCountdown(3);
    setWinner(null);
    setBattleStatIdx((i) => (i + 1) % STATS.length);
  };

  const pVal = playerCard ? (playerCard[battleStat.key] as number) : null;
  const oVal = opponentCard[battleStat.key] as number;

  return (
    <div className="max-w-2xl mx-auto px-6 pb-16">

      {/* ── PHASE: PICK ── */}
      {phase === 'pick' && (
        <>
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center">
              <Swords className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-base font-black text-white">Head-to-Head vs <span className="text-amber-400">{OPPONENT_NAME}</span></p>
              <p className="text-xs text-slate-400">Pick one card to battle. Highest <span className="text-amber-400 font-bold">{battleStat.label}</span> wins this round.</p>
            </div>
          </div>

          {/* Stat being tested */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 mb-5 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">This round's stat</p>
              <p className="text-lg font-black text-amber-400">{battleStat.label}</p>
              <p className="text-[11px] text-slate-400">Higher value wins</p>
            </div>
            <Clock className="w-8 h-8 text-slate-700" />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Your hand — choose wisely</p>
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
            {maps.map((m) => (
              <MiniCard
                key={m.id}
                map={m}
                selected={selectedId === m.id}
                onClick={() => setSelectedId(m.id)}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={!selectedId}
            onClick={startBattle}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Swords className="w-4 h-4" />
            Play Card
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* ── PHASE: BATTLE ── */}
      {phase === 'battle' && playerCard && (
        <div className="flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Round stat</p>
          <p className="text-2xl font-black text-amber-400 mb-6">{battleStat.label}</p>

          <div className="w-full grid grid-cols-2 gap-4 mb-6">
            {/* Player card */}
            <div className={`rounded-2xl overflow-hidden border transition-all duration-500 ${
              revealed
                ? winner === 'player' ? 'border-emerald-400 shadow-lg shadow-emerald-400/20' : winner === 'draw' ? 'border-amber-400' : 'border-rose-500 opacity-70'
                : 'border-slate-700'
            }`}>
              <div className="relative h-28 bg-slate-900">
                <img src={playerCard.bannerUrl} alt={playerCard.title} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 to-transparent" />
                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-slate-950/70 px-1.5 py-0.5 rounded">YOU</span>
              </div>
              <div className="bg-[#0f172a] p-3">
                <p className="text-xs font-bold text-white line-clamp-1 mb-1">{playerCard.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{battleStat.label}</span>
                  <span className={`text-lg font-black font-mono ${revealed && winner === 'player' ? 'text-emerald-400' : revealed && winner === 'opponent' ? 'text-rose-400' : 'text-white'}`}>
                    {revealed ? (pVal as number).toFixed(pVal === Math.floor(pVal as number) ? 0 : 2) : '?'}
                  </span>
                </div>
              </div>
            </div>

            {/* Opponent card */}
            <div className={`rounded-2xl overflow-hidden border transition-all duration-500 ${
              revealed
                ? winner === 'opponent' ? 'border-emerald-400 shadow-lg shadow-emerald-400/20' : winner === 'draw' ? 'border-amber-400' : 'border-rose-500 opacity-70'
                : 'border-slate-700'
            }`}>
              <div className="relative h-28 bg-slate-900">
                <img src={opponentCard.bannerUrl} alt={opponentCard.title} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 to-transparent" />
                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-slate-950/70 px-1.5 py-0.5 rounded">{OPPONENT_NAME.toUpperCase()}</span>
              </div>
              <div className="bg-[#0f172a] p-3">
                <p className="text-xs font-bold text-white line-clamp-1 mb-1">{opponentCard.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{battleStat.label}</span>
                  <span className={`text-lg font-black font-mono ${revealed && winner === 'opponent' ? 'text-emerald-400' : revealed && winner === 'player' ? 'text-rose-400' : 'text-white'}`}>
                    {revealed ? (oVal as number).toFixed(oVal === Math.floor(oVal) ? 0 : 2) : '?'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown / result */}
          {!revealed ? (
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-full border-4 border-amber-400 flex items-center justify-center mb-3 transition-all"
                style={{ transform: `scale(${1 + (3 - countdown) * 0.08})` }}
              >
                <span className="text-4xl font-black text-amber-400 font-mono">{countdown || '!'}</span>
              </div>
              <p className="text-sm text-slate-400">Revealing in…</p>
            </div>
          ) : (
            <div className="text-center">
              {winner === 'player' && (
                <div className="flex flex-col items-center gap-2">
                  <Trophy className="w-10 h-10 text-yellow-400" />
                  <p className="text-2xl font-black text-emerald-400">You Win!</p>
                  <p className="text-sm text-slate-400">+{playerCard.bountyRewardPoints} pts awarded</p>
                </div>
              )}
              {winner === 'opponent' && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-2xl font-black text-rose-400">Opponent Wins</p>
                  <p className="text-sm text-slate-400">Better luck next round</p>
                </div>
              )}
              {winner === 'draw' && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-2xl font-black text-amber-400">Draw!</p>
                  <p className="text-sm text-slate-400">Evenly matched</p>
                </div>
              )}
              <button
                type="button"
                onClick={reset}
                className="mt-5 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm transition-all flex items-center gap-2 mx-auto active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
