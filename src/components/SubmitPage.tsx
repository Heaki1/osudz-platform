import React, { useState, useEffect, useRef } from 'react';

interface Session {
  authenticated: boolean;
  login_configured: boolean;
  username?: string;
  avatar_url?: string;
  osu_id?: string;
  user_id?: string;
}

interface BeatmapMeta {
  title?: string;
  stars?: string | number;
  cs?: string | number;
  ar?: string | number;
  od?: string | number;
  bpm?: string | number;
  length?: string;
  preview_url?: string;
  cover_url?: string;
  artist?: string;
  mapper?: string;
  difficulty_name?: string;
  hp?: string | number;
}

interface SubmittedBounty {
  id: string;
  url: string;
  title?: string;
  artist?: string;
  mapper?: string;
  stars?: string | number;
  cs?: string | number;
  ar?: string | number;
  od?: string | number;
  bpm?: string | number;
  length?: string;
  mod?: string;
  slot?: string;
  skill?: string;
  cover_url?: string;
  preview_url?: string;
  submitted_by?: string;
  submitted_by_name?: string;
  type?: string;
}

interface Props {
  onSubmitSuccess: () => void;
}

const LOGIN_URL = '/api/auth/osu/login?next=/';

const LOGIN_ERRORS: Record<string, string> = {
  bad_state: 'That sign-in attempt expired. Please try again.',
  exchange_failed: "osu! wouldn't confirm that sign-in.",
  not_configured: "osu! sign-in isn't set up on this server yet.",
  access_denied: "Sign-in cancelled — you're still browsing as a guest.",
};

function extractBeatmapId(url: string): string | null {
  const m = url.match(/#osu\/(\d+)/) || url.match(/osu\/(\d+)/);
  return m ? m[1] : null;
}

function extractSetId(url: string): string | null {
  const m = url.match(/beatmapsets\/(\d+)/);
  return m ? m[1] : null;
}

function safeUrl(x?: string): string {
  if (!x) return '';
  try {
    const parsed = new URL(x);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

const inputClass =
  'w-full bg-slate-900/70 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60 transition-colors';
const readonlyInputClass =
  'w-full bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2.5 text-sm text-slate-400 font-mono cursor-not-allowed';
const labelClass = 'block text-[11px] uppercase tracking-widest font-bold text-blue-200/60 mb-1.5';

export default function SubmitPage({ onSubmitSuccess }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [bounties, setBounties] = useState<SubmittedBounty[]>([]);
  const [loginError, setLoginError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [loginUnavailable, setLoginUnavailable] = useState(false);

  // Form state
  const [url, setUrl] = useState('');
  const [challenge, setChallenge] = useState('');
  const [mods, setMods] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [meta, setMeta] = useState<BeatmapMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Legacy name modal
  const [legacyName, setLegacyName] = useState('');
  const [registering, setRegistering] = useState(false);

  const currentAudio = useRef<HTMLAudioElement | null>(null);

  function myIds(): string[] {
    const legacy = localStorage.getItem('act_user_id');
    return [session?.user_id, legacy].filter((x): x is string => Boolean(x));
  }

  function myName(): string {
    return session?.username || localStorage.getItem('act_username') || 'Unknown';
  }

  function haveIdentity(): boolean {
    return myIds().length > 0;
  }

  function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const legacy = localStorage.getItem('act_user_id');
    return legacy ? { ...extra, 'x-user-id': legacy } : { ...extra };
  }

  async function loadSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error(String(res.status));
      const data: Session = await res.json();
      setSession(data);
      if (!data.login_configured) {
        setLoginUnavailable(true);
        setLegacyOpen(true);
      }
    } catch {
      setSession({ authenticated: false, login_configured: false });
      setLoginUnavailable(true);
    }
  }

  async function loadBounties() {
    try {
      const res = await fetch('/api/beatmaps/list');
      const data = await res.json();
      setBounties((Array.isArray(data) ? data : []).filter((x: SubmittedBounty) => x.type === 'bounty'));
    } catch {
      // offline — no-op
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('login_error');
    if (code) {
      setLoginError(LOGIN_ERRORS[code] || `Sign-in failed (${code}).`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    loadSession();
    loadBounties();
  }, []);

  async function fetchBeatmapInfo() {
    const id = extractBeatmapId(url);
    const setId = extractSetId(url);
    if (!id) return;

    setMetaLoading(true);
    setMetaError('');
    setMeta(null);

    try {
      const res = await fetch('/api/beatmap/' + id);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Lookup failed (${res.status})`);

      const fallbackPreview = setId ? `https://b.ppy.sh/preview/${setId}.mp3` : '';
      const fallbackCover = setId ? `https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg` : '';

      setMeta({
        title: body.title || '',
        stars: body.stars ?? '',
        cs: body.cs ?? '',
        ar: body.ar ?? '',
        od: body.od ?? '',
        bpm: body.bpm ?? '',
        length: body.length ?? '',
        preview_url: body.preview_url || fallbackPreview,
        cover_url: body.cover_url || fallbackCover,
        artist: body.artist || '',
        mapper: body.mapper || '',
        difficulty_name: body.difficulty_name || '',
        hp: body.hp ?? '',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Beatmap lookup failed.';
      setMetaError(msg);
    } finally {
      setMetaLoading(false);
    }
  }

  async function handleSubmit() {
    if (!haveIdentity()) {
      setShowModal(true);
      return;
    }

    if (!url || !challenge) {
      alert('Please fill in the Beatmap URL and Challenge.');
      return;
    }

    setSubmitting(true);

    const entry = {
      url,
      skill: challenge,
      mod: mods,
      slot: difficulty,
      title: meta?.title || '',
      stars: meta?.stars || '',
      cs: meta?.cs || '',
      ar: meta?.ar || '',
      od: meta?.od || '',
      bpm: meta?.bpm || '',
      length: meta?.length || '',
      preview_url: meta?.preview_url || '',
      cover_url: meta?.cover_url || '',
      artist: meta?.artist || '',
      mapper: meta?.mapper || '',
      difficulty_name: meta?.difficulty_name || '',
      hp: meta?.hp || '',
      type: 'bounty',
      submitted_by: myIds()[0],
      submitted_by_name: myName(),
    };

    try {
      const endpoint = editingId ? `/api/beatmaps/${editingId}` : '/api/beatmaps/submit';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(entry),
      });

      const result = await res.json();

      if (res.ok) {
        if (!editingId) {
          try {
            await fetch('/api/send-discord', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry),
            });
          } catch { /* non-fatal */ }
          alert('Bounty submitted!');
        } else {
          alert('Changes saved!');
        }

        setUrl('');
        setChallenge('');
        setMods('');
        setDifficulty('');
        setMeta(null);
        setEditingId(null);
        await loadBounties();
        onSubmitSuccess();
      } else {
        alert('Error: ' + (result.error || 'Unknown error'));
      }
    } catch {
      alert('Failed to connect to server.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(b: SubmittedBounty) {
    setEditingId(b.id);
    setUrl(b.url || '');
    setChallenge(b.skill || '');
    setMods(b.mod || '');
    setDifficulty(b.slot || '');
    setMeta({
      title: b.title || '',
      stars: b.stars,
      cs: b.cs,
      ar: b.ar,
      od: b.od,
      bpm: b.bpm,
      length: b.length || '',
      cover_url: b.cover_url || '',
      preview_url: b.preview_url || '',
      artist: b.artist || '',
      mapper: b.mapper || '',
      difficulty_name: b.slot || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: string) {
    if (!haveIdentity()) return alert('Sign in with osu! first.');
    if (!confirm('Delete this beatmap?')) return;

    try {
      const res = await fetch(`/api/beatmaps/${id}`, {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert('Delete failed: ' + (data.error || 'Not allowed')); return; }
      if (editingId === id) { setEditingId(null); setUrl(''); setChallenge(''); setMods(''); setDifficulty(''); setMeta(null); }
      await loadBounties();
      onSubmitSuccess();
    } catch {
      alert('Delete failed: network error');
    }
  }

  function playPreview(previewUrl: string) {
    if (currentAudio.current) currentAudio.current.pause();
    const audio = new Audio(previewUrl);
    audio.volume = 0.5;
    audio.play().catch(() => alert('Could not play preview.'));
    setTimeout(() => { audio.pause(); }, 30000);
    currentAudio.current = audio;
  }

  async function signOut() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* no-op */ }
    setSession({ authenticated: false, login_configured: true });
  }

  async function registerName(e: React.FormEvent) {
    e.preventDefault();
    if (legacyName.trim().length < 3) return alert('Name too short!');
    setRegistering(true);
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: legacyName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('act_user_id', data.id);
        localStorage.setItem('act_username', data.display_name);
        setShowModal(false);
        await loadBounties();
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch {
      alert('Failed to connect to server.');
    } finally {
      setRegistering(false);
    }
  }

  const mine = myIds();

  return (
    <div className="px-6 pb-16">
      <div className="max-w-4xl mx-auto">

        {/* Page heading */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 font-mono">Community</p>
          <h2 className="text-2xl font-black text-white">Submit a Beatmap</h2>
          <p className="text-sm text-slate-400 mt-1">Propose a map for the next challenge pool.</p>
        </div>

        {/* Login error banner */}
        {loginError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-sm text-rose-300">
            {loginError}
          </div>
        )}

        {/* Auth bar */}
        {session && (
          <div className="mb-6 flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 backdrop-blur-sm">
            {session.authenticated ? (
              <>
                <div className="flex items-center gap-3">
                  {session.avatar_url && (
                    <img src={safeUrl(session.avatar_url)} alt="" className="w-8 h-8 rounded-full ring-1 ring-amber-400/40" />
                  )}
                  <div>
                    <div className="text-sm font-bold text-white">{session.username}</div>
                    <div className="text-[11px] text-slate-400 font-mono">osu! #{session.osu_id}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : loginUnavailable ? (
              <span className="text-xs text-slate-400">
                osu! sign-in isn't available right now — submit with a display name.
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-400">
                  {localStorage.getItem('act_username')
                    ? <>Submitting as <strong className="text-white">{localStorage.getItem('act_username')}</strong> — display name only.</>
                    : "You're browsing as a guest."}
                </span>
                <a
                  href={LOGIN_URL}
                  className="text-xs font-bold bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
                >
                  Sign in with osu!
                </a>
              </>
            )}
          </div>
        )}

        {/* Submission form */}
        <div className="bg-slate-900/50 border border-slate-700/40 rounded-2xl p-6 mb-8 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-white mb-5 uppercase tracking-wider">
            {editingId ? '✏️ Edit Submission' : '➕ New Submission'}
          </h3>

          {/* Main fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Beatmap URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={fetchBeatmapInfo}
                placeholder="https://osu.ppy.sh/beatmapsets/...#osu/..."
                maxLength={500}
                className={inputClass}
              />
              {metaError && <p className="text-[11px] text-rose-400 mt-1">{metaError}</p>}
            </div>

            <div>
              <label className={labelClass}>Challenge</label>
              <input
                type="text"
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                placeholder="Pass, FC, #1 Algeria, Best Acc"
                maxLength={80}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Mods</label>
              <input
                type="text"
                value={mods}
                onChange={(e) => setMods(e.target.value)}
                placeholder="e.g. NM, HD, HR, DT"
                maxLength={40}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Map Difficulty</label>
              <input
                type="text"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                placeholder="e.g. Insane, Expert"
                maxLength={40}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Song Title</label>
              <input
                readOnly
                value={metaLoading ? 'Loading…' : (meta?.title ?? '')}
                placeholder="Auto-filled from URL"
                className={readonlyInputClass}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {(['stars', 'cs', 'ar', 'od', 'bpm', 'length'] as const).map((key) => (
              <div key={key}>
                <label className={labelClass}>{key.toUpperCase()}</label>
                <input
                  readOnly
                  value={metaLoading ? '…' : (meta?.[key] != null ? String(meta[key]) : '')}
                  placeholder="—"
                  className={readonlyInputClass}
                />
              </div>
            ))}
          </div>

          {/* Cover preview (when available) */}
          {meta?.cover_url && (
            <div className="mb-5">
              <img
                src={safeUrl(meta.cover_url)}
                alt="Beatmap cover"
                className="h-20 rounded-xl object-cover border border-slate-700/40"
              />
            </div>
          )}

          {/* Action */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-amber-400 text-slate-950 font-bold text-sm rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : editingId ? '💾 Save Changes' : '➕ Submit Bounty'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setUrl(''); setChallenge(''); setMods(''); setDifficulty(''); setMeta(null); }}
                className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Current submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              🗂️ Current Beatmaps
              <span className="ml-2 text-amber-400 font-mono">{bounties.length}</span>
            </h3>
          </div>

          {bounties.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No submissions yet. Be the first!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bounties.map((b) => {
                const isOwner = Boolean(b.submitted_by) && mine.some((id) => String(b.submitted_by) === String(id));
                const cover = safeUrl(b.cover_url);
                const mapUrl = safeUrl(b.url);
                const previewUrl = safeUrl(b.preview_url || '');
                const bmId = extractBeatmapId(b.url || '');

                return (
                  <div
                    key={b.id}
                    className="bg-slate-900/60 border border-slate-700/40 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-slate-600/60 transition-colors"
                  >
                    {cover && (
                      <div className="h-28 bg-slate-800 overflow-hidden">
                        <img src={cover} alt="" className="w-full h-full object-cover opacity-80" />
                      </div>
                    )}
                    <div className="p-4">
                      {/* Title + link */}
                      {mapUrl ? (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-white text-sm hover:text-amber-400 transition-colors line-clamp-1 block mb-1"
                        >
                          {b.title || 'Unknown title'}
                        </a>
                      ) : (
                        <p className="font-bold text-white text-sm line-clamp-1 mb-1">{b.title || 'Unknown title'}</p>
                      )}
                      {b.artist && <p className="text-xs text-slate-400 mb-2">{b.artist}</p>}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {b.slot && (
                          <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {b.slot}
                          </span>
                        )}
                        {b.mod && (
                          <span className="text-[10px] bg-slate-700/60 border border-slate-600/40 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                            {b.mod}
                          </span>
                        )}
                        {b.skill && (
                          <span className="text-[10px] bg-amber-400/15 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            🎯 {b.skill}
                          </span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {[
                          { label: '★', value: b.stars },
                          { label: 'BPM', value: b.bpm },
                          { label: 'CS', value: b.cs },
                          { label: 'AR', value: b.ar },
                          { label: 'OD', value: b.od },
                          { label: 'Len', value: b.length },
                        ].map(({ label, value }) => value != null && String(value) !== '' ? (
                          <div key={label} className="bg-slate-800/60 rounded-lg px-2 py-1 text-center">
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
                            <div className="text-xs font-bold font-mono text-slate-200">{String(value)}</div>
                          </div>
                        ) : null)}
                      </div>

                      {/* Submitted by */}
                      <div className="text-[11px] text-blue-300/70 mb-3">
                        👤 {b.submitted_by_name || 'Unknown'}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(b)}
                              className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b.id)}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              🗑️ Delete
                            </button>
                          </>
                        )}
                        {previewUrl && (
                          <button
                            type="button"
                            onClick={() => playPreview(previewUrl)}
                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            🔊 Preview
                          </button>
                        )}
                        {bmId && (
                          <button
                            type="button"
                            onClick={() => window.open(`https://preview.tryz.id.vn/?b=${encodeURIComponent(bmId)}&m=`, '_blank', 'noopener,noreferrer')}
                            className="text-[11px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            🎬 Replay
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sign-in modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#1a2a6c] border border-slate-700/60 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black text-white mb-2">👋 Welcome!</h2>
            <p className="text-sm text-slate-400 mb-6">
              Sign in with osu! so your submissions carry your actual profile.
            </p>

            {!loginUnavailable ? (
              <a
                href={LOGIN_URL}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#ff66aa] hover:bg-[#ff4499] text-white font-bold rounded-xl transition-colors text-sm mb-4"
              >
                Sign in with osu!
              </a>
            ) : (
              <p className="text-xs text-slate-500 mb-4">osu! sign-in isn't available right now.</p>
            )}

            {/* Legacy name toggle */}
            <div className="border border-slate-700/50 rounded-xl overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => setLegacyOpen(!legacyOpen)}
                className="w-full text-left px-4 py-3 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-between"
              >
                <span>Continue with just a display name</span>
                <span className="opacity-50">{legacyOpen ? '▲' : '▼'}</span>
              </button>
              {legacyOpen && (
                <div className="px-4 pb-4 border-t border-slate-700/40">
                  <p className="text-[11px] text-slate-500 mt-3 mb-3">
                    No osu! account is checked — this name can't vote and won't be tied to your profile.
                  </p>
                  <form onSubmit={registerName} className="flex gap-2">
                    <input
                      type="text"
                      value={legacyName}
                      onChange={(e) => setLegacyName(e.target.value)}
                      placeholder="Username"
                      minLength={3}
                      maxLength={20}
                      required
                      autoComplete="off"
                      className="flex-1 bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={registering}
                      className="px-4 py-2 bg-amber-400 text-slate-950 font-bold text-sm rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50"
                    >
                      Go
                    </button>
                  </form>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
            >
              Just browsing, thanks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
