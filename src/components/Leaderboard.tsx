import React, { useState } from 'react';
import { Trophy, Medal, Star, Flame, TrendingUp, Crown } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  user: string;
  points: number;
  votes: number;
  streak: number;
  badge: string;
  trend: 'up' | 'down' | 'same';
}

const topVoters: LeaderboardEntry[] = [
  { rank: 1, user: 'mrekk',        points: 14820, votes: 312, streak: 47, badge: 'Platinum', trend: 'same' },
  { rank: 2, user: 'whitecat',     points: 11340, votes: 274, streak: 31, badge: 'Gold',     trend: 'up'   },
  { rank: 3, user: 'raikou',       points: 9870,  votes: 251, streak: 28, badge: 'Gold',     trend: 'down' },
  { rank: 4, user: 'helixia',      points: 7640,  votes: 198, streak: 22, badge: 'Silver',   trend: 'up'   },
  { rank: 5, user: 'altari',       points: 6120,  votes: 163, streak: 19, badge: 'Silver',   trend: 'up'   },
  { rank: 6, user: 'void_mapper',  points: 5430,  votes: 147, streak: 14, badge: 'Silver',   trend: 'down' },
  { rank: 7, user: 'noobmaster',   points: 4210,  votes: 118, streak: 9,  badge: 'Bronze',   trend: 'same' },
  { rank: 8, user: 'rinkata',      points: 3880,  votes: 104, streak: 7,  badge: 'Bronze',   trend: 'up'   },
  { rank: 9, user: 'you',          points: 350,   votes: 7,   streak: 3,  badge: 'Bronze',   trend: 'up'   },
];

const topMaps = [
  { rank: 1, title: 'Blue Zenith (Cut Ver.)', artist: 'xi', mapper: 'Sotarks', votes: 3892, rating: 4.48 },
  { rank: 2, title: 'Cybernetics',            artist: 'Jun Kuroda', mapper: 'Altai', votes: 2104, rating: 5.53 },
  { rank: 3, title: 'QSHELL -Kyoshoku no Shell-', artist: 'Se-U-Ra', mapper: 'Azzedd', votes: 1420, rating: 3.54 },
  { rank: 4, title: 'Feelings of Fake',       artist: 'Hellia', mapper: 'Hellia', votes: 883, rating: 3.78 },
  { rank: 5, title: 'Kinetic Flux',           artist: 'MetaHumanai', mapper: 'HintIceCream_', votes: 671, rating: 3.94 },
];

const badgeColors: Record<string, { text: string; bg: string; border: string }> = {
  Platinum: { text: 'text-cyan-300', bg: 'bg-cyan-900/40', border: 'border-cyan-500/50' },
  Gold:     { text: 'text-yellow-300', bg: 'bg-yellow-900/40', border: 'border-yellow-500/50' },
  Silver:   { text: 'text-slate-300', bg: 'bg-slate-700/40', border: 'border-slate-500/50' },
  Bronze:   { text: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-700/50' },
};

const rankIcons = [
  <Crown className="w-4 h-4 text-yellow-300" />,
  <Medal className="w-4 h-4 text-slate-300" />,
  <Medal className="w-4 h-4 text-amber-600" />,
];

export function Leaderboard() {
  const [tab, setTab] = useState<'voters' | 'maps'>('voters');

  return (
    <div className="max-w-2xl mx-auto px-6 pb-16">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['voters', 'maps'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-xs font-bold capitalize tracking-wide transition-all ${
              tab === t ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/60 border border-slate-700/50 text-slate-400 hover:text-white'
            }`}
          >
            Top {t}
          </button>
        ))}
      </div>

      {tab === 'voters' && (
        <div className="space-y-2">
          {/* Podium for top 3 */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[topVoters[1], topVoters[0], topVoters[2]].map((entry, i) => {
              const podiumRank = [2, 1, 3][i];
              const heights = ['h-20', 'h-28', 'h-16'];
              const bc = badgeColors[entry.badge];
              return (
                <div key={entry.user} className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-sm font-black text-white mb-1 uppercase">
                    {entry.user[0]}
                  </div>
                  <p className="text-xs font-bold text-white mb-1 truncate max-w-full px-1 text-center">{entry.user}</p>
                  <p className="text-[10px] text-amber-400 font-mono font-bold mb-1">{entry.points.toLocaleString()} pts</p>
                  <div className={`w-full ${heights[i]} rounded-t-xl flex items-center justify-center ${bc.bg} border-t ${bc.border}`}>
                    <span className={`text-xl font-black ${bc.text}`}>#{podiumRank}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest of the list */}
          {topVoters.slice(3).map((entry) => {
            const bc = badgeColors[entry.badge];
            const isYou = entry.user === 'you';
            return (
              <div
                key={entry.user}
                className={`flex items-center gap-3 rounded-xl p-3 border transition-all ${
                  isYou
                    ? 'bg-amber-400/10 border-amber-400/40'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'
                }`}
              >
                <span className="text-sm font-black text-slate-500 w-5 text-center font-mono">
                  #{entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-300 uppercase flex-shrink-0">
                  {entry.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold truncate ${isYou ? 'text-amber-400' : 'text-white'}`}>
                      {entry.user}{isYou && ' (you)'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${bc.text} ${bc.bg} ${bc.border}`}>
                      {entry.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">{entry.votes} votes</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      <Flame className="w-2.5 h-2.5 inline text-orange-400 mr-0.5" />{entry.streak}d streak
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black font-mono text-white">{entry.points.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">pts</p>
                </div>
                <div className="flex-shrink-0">
                  {entry.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                  {entry.trend === 'down' && <TrendingUp className="w-3.5 h-3.5 text-rose-400 rotate-180" />}
                  {entry.trend === 'same' && <span className="text-[10px] text-slate-600">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'maps' && (
        <div className="space-y-2">
          {topMaps.map((m) => (
            <div key={m.rank} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 hover:border-slate-600 rounded-xl p-3 transition-all">
              <div className="w-7 flex items-center justify-center flex-shrink-0">
                {m.rank <= 3 ? rankIcons[m.rank - 1] : <span className="text-sm font-black text-slate-600 font-mono">#{m.rank}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{m.title}</p>
                <p className="text-[11px] text-slate-400 truncate">{m.artist} · mapped by <span className="text-slate-300">{m.mapper}</span></p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black font-mono text-amber-400">{m.votes.toLocaleString()}</p>
                <div className="flex items-center gap-0.5 justify-end mt-0.5">
                  <Star className="w-2.5 h-2.5 fill-slate-500 text-slate-500" />
                  <span className="text-[10px] text-slate-500 font-mono">{m.rating.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
