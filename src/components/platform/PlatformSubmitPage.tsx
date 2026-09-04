import React, { useState } from 'react';
import { PlatformPage } from '../../types';
import { api, ApiBeatmapPreview, ApiSubmission } from '../../api/client';
import { CurrentRound, pageAccess, roundLabel } from '../../lib/round';
import { beatmapUrl, previewToBeatmap, REVIEW_PRESENTATION, toBeatmap } from '../../lib/submission';
import { BeatmapCardPlatform } from './BeatmapCardPlatform';
import { favoriteBeatmaps } from './sampleData';
import { AuthUser } from './NavHeader';
import { PhaseGate } from './PhaseGate';
import {
  Upload, Star, Clock, CheckCircle2,
  Link, Heart, ChevronRight, X, AlertCircle, LogIn,
} from 'lucide-react';

// ── ELIGIBILITY RULES PANEL ───────────────────────────────────────────────────

function EligibilityPanel() {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#0d1526] border border-slate-800 rounded-2xl mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Submission Eligibility Rules</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-800/60">
          <p className="text-xs text-slate-500 mt-3 mb-4">
            Your beatmap must satisfy all of the following before it can be submitted.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, label: 'Beatmap status', value: 'Ranked, Loved, or Approved' },
              { icon: <Star className="w-4 h-4 text-amber-400" />,           label: 'Star rating',    value: '3.00★ — 9.00★' },
              { icon: <Clock className="w-4 h-4 text-blue-400" />,           label: 'Length',         value: '0:30 — 5:00' },
              { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, label: 'Per player',     value: '1 submission per round' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5">
                {icon}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MOD + CHALLENGE REQUIREMENT SELECTORS ────────────────────────────────────

// Must stay in step with ALLOWED_MODS / ALLOWED_CHALLENGE_TYPES in
// server/src/repo/submissions.ts, which validates what is sent. Making these
// administrator-defined is specified in docs/my_plan.txt but not built yet.
const MODS = ['NM', 'HD', 'HR', 'DT', 'EZ', 'FL', 'HDHR', 'HDDT', 'HRDT'];
const CHALLENGE_TYPES = ['Full Combo', 'Top #1 Score', 'Best Accuracy', 'Lowest Miss Count'];

interface RequirementsProps {
  mod: string | null;
  challengeType: string | null;
  onModChange: (m: string | null) => void;
  onTypeChange: (t: string | null) => void;
}

function RequirementsSelector({ mod, challengeType, onModChange, onTypeChange }: RequirementsProps) {
  return (
    <div className="space-y-5">
      {/* Mod */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono text-slate-600 mb-2">Required Mod</p>
        <div className="flex flex-wrap gap-2">
          {MODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModChange(mod === m ? null : m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                mod === m
                  ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-500 hover:text-slate-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Challenge type */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono text-slate-600 mb-2">Challenge Type</p>
        <div className="grid grid-cols-2 gap-2">
          {CHALLENGE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(challengeType === t ? null : t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left ${
                challengeType === t
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-500 hover:text-slate-300'
              }`}
            >
              {challengeType === t && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── URL TAB ───────────────────────────────────────────────────────────────────

function UrlTab({ onSubmitted }: { onSubmitted: (submission: ApiSubmission) => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApiBeatmapPreview | null>(null);
  const [mod, setMod] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<string | null>(null);

  const handleLoad = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    const result = await api.submissions.lookup(url);
    if (result.ok) setPreview(result.data);
    else setError(result.error);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!preview || !mod || !challengeType) return;
    setSubmitting(true);
    setError(null);
    const result = await api.submissions.submit({
      difficultyId: preview.difficultyId,
      modRequirement: mod,
      challengeRequirement: challengeType,
    });
    setSubmitting(false);
    if (result.ok) onSubmitted(result.data);
    else setError(result.error);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-px" />
          <p className="text-xs text-rose-300 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-rose-400/60 hover:text-rose-300 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* URL input */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono text-slate-600 mb-2">Beatmap URL</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setPreview(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleLoad(); }}
              placeholder="https://osu.ppy.sh/beatmapsets/41823#osu/131891"
              className="w-full bg-[#0d1526] border border-slate-800 focus:border-amber-400/50 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => { void handleLoad(); }}
            disabled={!url.trim() || loading}
            className="flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-xl transition-all flex-shrink-0"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
        <p className="text-[11px] text-slate-600 mt-2">
          Link a specific difficulty — the URL osu! shows once you have picked one.
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Beatmap found — verify the details below</span>
          </div>
          <div className="max-w-sm">
            <BeatmapCardPlatform beatmap={previewToBeatmap(preview)} />
          </div>

          <div className="h-px bg-slate-800" />

          <RequirementsSelector
            mod={mod}
            challengeType={challengeType}
            onModChange={setMod}
            onTypeChange={setChallengeType}
          />

          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={!mod || !challengeType || submitting}
            className="flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl transition-all"
          >
            <Upload className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Submit to Community Vote'}
          </button>
          {(!mod || !challengeType) && (
            <p className="text-[11px] text-slate-600">Select a mod and challenge type to continue.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── FAVORITES TAB ─────────────────────────────────────────────────────────────

function FavoritesTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const [mod, setMod] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [favs, setFavs] = useState(favoriteBeatmaps.filter((b) => b.isFavorited));

  const selectedBeatmap = favoriteBeatmaps.find((b) => b.id === selected);

  if (submitted) {
    const s = favoriteBeatmaps.find((b) => b.id === submitted);
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-black text-white">Submitted!</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          <span className="text-white font-bold">{s?.title}</span> has been submitted for community voting.
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(null); setSelected(null); setMod(null); setChallengeType(null); }}
          className="mt-2 px-6 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm font-bold rounded-xl transition-all"
        >
          Back to favorites
        </button>
      </div>
    );
  }

  if (selected && selectedBeatmap) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSelected(null); setMod(null); setChallengeType(null); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Back to favorites
          </button>
        </div>
        <div className="max-w-sm">
          <BeatmapCardPlatform beatmap={selectedBeatmap} />
        </div>
        <div className="h-px bg-slate-800" />
        <RequirementsSelector
          mod={mod}
          challengeType={challengeType}
          onModChange={setMod}
          onTypeChange={setChallengeType}
        />
        <button
          type="button"
          onClick={() => setSubmitted(selected)}
          disabled={!mod || !challengeType}
          className="flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl transition-all"
        >
          <Upload className="w-4 h-4" />
          Submit to Community Vote
        </button>
        {(!mod || !challengeType) && (
          <p className="text-[11px] text-slate-600">Select a mod and challenge type to continue.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-400">
          Select a favorited beatmap to submit it for the community vote.
        </p>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all"
        >
          <Heart className="w-3.5 h-3.5" />
          Load my osu! favorites
        </button>
      </div>

      {favs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 border border-dashed border-slate-800 rounded-2xl">
          <Heart className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500">No favorited beatmaps yet.</p>
          <p className="text-xs text-slate-600">Load your osu! favorites or switch to the URL tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favs.map((b) => (
            <BeatmapCardPlatform
              key={b.id}
              beatmap={b}
              showSubmitButton
              onSubmit={() => setSelected(b.id)}
              onFavorite={() => setFavs((prev) => prev.filter((x) => x.id !== b.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── LOGIN GATE ────────────────────────────────────────────────────────────────

function LoginGate({ onLogin }: { onLogin?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <LogIn className="w-9 h-9 text-slate-500" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-white mb-2">Login required</h2>
        <p className="text-slate-400 max-w-sm text-sm leading-relaxed">
          You need to be logged in with your osu! account to submit a beatmap for the community vote.
        </p>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="flex items-center gap-2 px-8 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black rounded-xl transition-all"
      >
        <LogIn className="w-4 h-4" />
        Login with osu!
      </button>
      <p className="text-xs text-slate-600">
        Only Algerian osu! players can submit beatmaps.
      </p>
    </div>
  );
}

// ── PLATFORM SUBMIT PAGE ──────────────────────────────────────────────────────

type SubmitTab = 'url' | 'favorites';

/** One submission per user per round, so once there is one there is nothing to add. */
function MySubmission({ submission }: { submission: ApiSubmission }) {
  const copy = REVIEW_PRESENTATION[submission.reviewStatus];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${copy.tone}`}>
          {copy.label}
        </span>
        <p className="text-xs text-slate-500">{copy.blurb}</p>
      </div>

      <div className="max-w-sm">
        <BeatmapCardPlatform beatmap={toBeatmap(submission)} />
      </div>

      <div className="bg-[#0d1526] border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono">Your challenge requirements</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-black font-mono bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg text-white">
            {submission.modRequirement}
          </span>
          <span className="text-sm font-bold bg-amber-400/10 border border-amber-400/25 px-3 py-1 rounded-lg text-amber-400">
            {submission.challengeRequirement}
          </span>
        </div>
        <a
          href={beatmapUrl(submission)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors"
        >
          <Link className="w-3.5 h-3.5" />
          Open on osu!
        </a>
      </div>
    </div>
  );
}

interface PlatformSubmitPageProps {
  round: CurrentRound | null;
  /** The caller's entry in the open round, fetched once in App. */
  mySubmission: ApiSubmission | null;
  loading: boolean;
  onSubmitted: (submission: ApiSubmission) => void;
  onNavigate: (page: PlatformPage) => void;
  user: AuthUser | null;
  onLogin?: () => void;
}

export function PlatformSubmitPage({
  round,
  mySubmission,
  loading,
  onSubmitted,
  onNavigate,
  user,
  onLogin,
}: PlatformSubmitPageProps) {
  const [tab, setTab] = useState<SubmitTab>('url');
  // Same table the nav and the vote page read, so "closed" means one thing.
  const access = pageAccess('submit', round);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-16">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-mono mb-1">{roundLabel(round)}</p>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Submit a Beatmap</h1>
        <p className="text-sm text-slate-400">
          Propose a beatmap for this month's community vote. The winner becomes the monthly challenge.
        </p>
      </div>

      {!user ? (
        <LoginGate onLogin={onLogin} />
      ) : access.state !== 'open' ? (
        <PhaseGate access={access} round={round} onNavigate={onNavigate} />
      ) : loading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-slate-600">
          <span className="w-4 h-4 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          <span className="text-sm">Checking your submission…</span>
        </div>
      ) : mySubmission ? (
        <MySubmission submission={mySubmission} />
      ) : (
        <>
          <EligibilityPanel />

          {/* Tabs */}
          <div className="flex gap-1 mb-8 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setTab('url')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === 'url'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              Beatmap URL
            </button>
            <button
              type="button"
              onClick={() => setTab('favorites')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === 'favorites'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              My Favorites
            </button>
          </div>

          {tab === 'url'       && <UrlTab onSubmitted={onSubmitted} />}
          {tab === 'favorites' && <FavoritesTab />}
        </>
      )}
    </div>
  );
}
