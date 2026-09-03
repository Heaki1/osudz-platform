import React, { useState } from 'react';
import { BeatmapCardPlatform } from './BeatmapCardPlatform';
import { searchBeatmaps } from './sampleData';
import { Search, SlidersHorizontal } from 'lucide-react';
import { BeatmapStatus } from './types';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BeatmapStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'stars' | 'bpm'>('stars');

  const results = searchBeatmaps
    .filter((b) => statusFilter === 'all' || b.status === statusFilter)
    .filter((b) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.artist.toLowerCase().includes(q) ||
        b.mapper.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (sortBy === 'stars' ? b.stars - a.stars : b.bpm - a.bpm));

  const statusButtons: { key: BeatmapStatus; label: string; activeClass: string }[] = [
    { key: 'ranked',   label: 'Ranked',   activeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400' },
    { key: 'loved',    label: 'Loved',    activeClass: 'bg-rose-500/15 border-rose-500/35 text-rose-400'          },
    { key: 'approved', label: 'Approved', activeClass: 'bg-blue-500/15 border-blue-500/35 text-blue-400'          },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-1">Beatmap Search</p>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Find Beatmaps</h1>
        <p className="text-sm text-slate-400">
          Search Ranked, Loved, and Approved beatmaps. Save favorites or submit them for the monthly challenge.
        </p>
      </div>

      {/* Search bar + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title, artist, or mapper…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#0d1526] border border-slate-800 focus:border-amber-400/50 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-slate-600 flex-shrink-0" />
          {statusButtons.map(({ key, label, activeClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all ${
                statusFilter === key
                  ? activeClass
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-800 flex-shrink-0" />
          {(['stars', 'bpm'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                sortBy === s
                  ? 'bg-amber-400/15 border-amber-400/30 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {s === 'stars' ? '★ Stars' : 'BPM'}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-slate-600 font-mono mb-6">
        {results.length} result{results.length !== 1 ? 's' : ''}
        {query && <span className="text-slate-500"> for "{query}"</span>}
      </p>

      {/* Results */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 border border-dashed border-slate-800 rounded-2xl">
          <Search className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500 font-medium">No beatmaps found.</p>
          <p className="text-xs text-slate-600">Try a different search or remove filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((b) => (
            <BeatmapCardPlatform
              key={b.id}
              beatmap={b}
              onFavorite={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
