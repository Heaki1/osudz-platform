// Beatmap search, over the real osu! API.
//
// The page fetches for itself rather than through App's refresh, the same way
// ArchivePage does: a search is a per-keystroke read that only this page wants, and
// putting it in the shared refresh would run it on every page load.
//
// Ordering is the server's, not this page's. GET /api/search/beatmaps takes the sort
// and returns the results already ordered, so there is one implementation of it rather
// than a second one here that could drift from it.

import React, { useEffect, useState } from 'react';
import { BeatmapCardPlatform } from './BeatmapCardPlatform';
import { Search, SlidersHorizontal, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { BeatmapStatus } from '../../types';
import { api, ApiSearchHit } from '../../api/client';
import { searchHitToBeatmap, beatmapUrl } from '../../lib/submission';

type StatusFilter = BeatmapStatus | 'all';
type Sort = 'stars' | 'bpm';

/** Long enough that typing a title is one request, short enough to feel immediate. */
const DEBOUNCE_MS = 400;

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<Sort>('stars');

  const [results, setResults] = useState<ApiSearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    // `stale` rather than an AbortController: send() takes no signal, and what actually
    // matters is that a slow earlier response cannot overwrite a newer one.
    let stale = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      const res = await api.search.beatmaps({
        q: query,
        status: statusFilter === 'all' ? 'any' : statusFilter,
        sort: sortBy,
      });
      if (stale) return;
      setLoading(false);

      if (res.ok) {
        setResults(res.data.results);
        setError(null);
        setSignedOut(false);
        return;
      }

      // 401 gets the page's own copy. The server answers "Not authenticated", which is
      // true and tells a player nothing about what to do about it.
      setResults([]);
      setSignedOut(res.status === 401);
      setError(res.status === 401 ? null : res.error);
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [query, statusFilter, sortBy]);

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
          Search Ranked, Loved, and Approved beatmaps on osu!. Open one to pick a difficulty, then submit
          its link for the monthly challenge.
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

      {/* Result count, and the one caveat worth stating */}
      <div className="mb-6 space-y-1">
        <p className="text-xs text-slate-600 font-mono">
          {loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          {query && !loading && <span className="text-slate-500"> for "{query}"</span>}
        </p>
        {sortBy === 'bpm' && !loading && results.length > 0 && (
          <p className="text-[11px] text-slate-600">
            osu! search cannot sort by BPM, so this orders the results above rather than every match.
          </p>
        )}
      </div>

      {/* Results, and the four states that are not results */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 border border-dashed border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
          <p className="text-slate-500 font-medium">Searching osu!…</p>
        </div>
      ) : signedOut ? (
        <div className="flex flex-col items-center gap-3 py-24 border border-dashed border-slate-800 rounded-2xl">
          <LogIn className="w-10 h-10 text-slate-700" />
          <p className="text-slate-400 font-medium">Sign in with osu! to search beatmaps.</p>
          <p className="text-xs text-slate-600 max-w-md text-center">
            Search runs against the osu! API on this server's quota, so it is limited per account.
          </p>
        </div>
      ) : error !== null ? (
        <div className="flex flex-col items-center gap-3 py-24 border border-dashed border-rose-500/25 rounded-2xl">
          <AlertCircle className="w-10 h-10 text-rose-500/60" />
          <p className="text-slate-300 font-medium">Search failed.</p>
          <p className="text-xs text-slate-500 max-w-md text-center">{error}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 border border-dashed border-slate-800 rounded-2xl">
          <Search className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500 font-medium">No beatmaps found.</p>
          <p className="text-xs text-slate-600">Try a different search or remove filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((hit) => (
            <div key={`${hit.beatmapsetId}-${hit.difficultyId}`} className="flex flex-col gap-1.5">
              {/* onFavorite stays a no-op here. A4 replaces the card's local favorite
                  state everywhere at once, and wiring one page early would leave two
                  different behaviours on screen at the same time. */}
              <BeatmapCardPlatform beatmap={searchHitToBeatmap(hit)} onFavorite={() => {}} />
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-slate-600 font-mono">
                  {hit.difficultyCount > 1
                    ? `Hardest of ${hit.difficultyCount} difficulties`
                    : 'Single difficulty'}
                </p>
                <a
                  href={beatmapUrl(hit)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-slate-500 hover:text-amber-400 transition-colors"
                >
                  Open on osu! →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
