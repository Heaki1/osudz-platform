import React, { useCallback, useEffect, useState } from 'react';
import { Phase } from '../../types';
import { api, ApiSubmission, ApiVoteAudit } from '../../api/client';
import { CurrentRound, formatDeadline, roundLabel, useCountdown } from '../../lib/round';
import { beatmapUrl } from '../../lib/submission';
import { AuthUser } from './NavHeader';
import {
  Shield, ChevronRight, CheckCircle2, Circle, Clock,
  Star, Music2, AlertCircle, Users, Settings, Zap,
  ToggleLeft, ToggleRight, Plus, X, Globe, Inbox, Link as LinkIcon,
  Trophy, Scale, Eye,
} from 'lucide-react';

// ── TAB TYPES ────────────────────────────────────────────────────────────────

type AdminTab = 'round' | 'submissions' | 'eligibility' | 'rules' | 'challenge' | 'users' | 'config';

/** Tabs backed by a real endpoint. The rest are still UI only. */
const WIRED_TABS: AdminTab[] = ['round', 'submissions'];

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'round',       label: 'Round Control', icon: <Clock className="w-4 h-4" /> },
  { key: 'submissions', label: 'Submissions',   icon: <Inbox className="w-4 h-4" /> },
  { key: 'eligibility', label: 'Eligibility',   icon: <Globe className="w-4 h-4" /> },
  { key: 'rules',       label: 'Beatmap Rules', icon: <Star className="w-4 h-4" /> },
  { key: 'challenge',   label: 'Challenge',     icon: <Zap className="w-4 h-4" /> },
  { key: 'users',       label: 'Users',         icon: <Users className="w-4 h-4" /> },
  { key: 'config',      label: 'Config',        icon: <Settings className="w-4 h-4" /> },
];

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1526] border border-slate-800 rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="text-sm font-black text-white">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ── PHASE TABLE & BANNERS ───────────────────────────────────────────────────────────

const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: 'submission', label: 'Submission', color: 'text-amber-400' },
  { key: 'voting',     label: 'Voting',     color: 'text-blue-400' },
  { key: 'challenge',  label: 'Challenge',  color: 'text-purple-400' },
];

function Banner({ tone, text, onDismiss }: { tone: 'error' | 'ok'; text: string; onDismiss: () => void }) {
  const style = tone === 'error'
    ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300';
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-4 py-3 ${style}`}>
      {tone === 'error'
        ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
        : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />}
      <p className="text-xs flex-1">{text}</p>
      <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── WINNER APPROVAL ───────────────────────────────────────────────────────────
//
// The window between the ballot closing and the winner being official. The round is
// still in the 'voting' phase throughout — winner_status is what closed the ballot,
// not the phase — and this panel is the only way out of it: POST /admin/round/winner
// is the sole path to the challenge phase, because NEXT_PHASES deliberately omits
// voting → challenge so the generic phase endpoint cannot skip the approval.

/** One entry in the winner panel — the pending winner, or a tied candidate. */
function WinnerEntry({ id, entry }: { id: number; entry: ApiSubmission | null }) {
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {entry?.coverUrl && (
        <img
          src={entry.coverUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-20 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-900"
        />
      )}
      <div className="min-w-0 text-left">
        <p className="text-sm font-bold text-white truncate">
          {entry ? entry.title : `Submission #${id}`}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {entry
            ? `${entry.artist} · [${entry.difficultyName}] · submitted by ${entry.submittedByName}`
            : 'No longer listed in this round — approve with care.'}
        </p>
      </div>
    </div>
  );
}

function WinnerPanel({
  round,
  onRoundChange,
}: {
  round: CurrentRound;
  onRoundChange: () => void | Promise<void>;
}) {
  const tiebreak = round.winnerStatus === 'tiebreak';
  const [entries, setEntries] = useState<ApiSubmission[]>([]);
  const [tied, setTied] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The round carries ids; the titles come from the admin submission list, which is
  // the one read that returns every entry of the round rather than only approved ones.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [rows, ids] = await Promise.all([
        api.admin.submissions(),
        tiebreak ? api.admin.tiebreakEntries() : Promise.resolve<number[]>([]),
      ]);
      if (!live) return;
      setEntries(rows ?? []);
      setTied(ids ?? []);
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [round.id, tiebreak]);

  const entryFor = (id: number) => entries.find((e) => e.id === id) ?? null;

  const approve = async () => {
    setBusy(true);
    setError(null);
    const result = await api.admin.approveWinner(tiebreak ? (choice ?? undefined) : undefined);
    if (!result.ok) {
      setError(result.status === 0 ? result.error : `${result.error} (HTTP ${result.status})`);
      setBusy(false);
      return;
    }
    // Approving moves the round to the challenge phase, which unmounts this panel, so
    // only the failure path puts the button back.
    await onRoundChange();
  };

  const permanence = (
    <p className="text-[11px] text-slate-600">
      Approving records the winner permanently and starts the challenge phase. It cannot be
      undone from here.
    </p>
  );

  if (tiebreak) {
    return (
      <Section
        title="Voting ended in a tie"
        description={`Level on ${round.winnerVoteCount ?? 0} votes${
          round.totalVotes === null ? '' : ` of ${round.totalVotes} cast`
        }. A tie is not resolved automatically — pick the winner.`}
      >
        {error && <Banner tone="error" text={error} onDismiss={() => setError(null)} />}

        {!loaded ? (
          <p className="text-sm text-slate-500">Loading the tied entries…</p>
        ) : tied.length === 0 ? (
          <p className="text-sm text-rose-400">
            This round is marked tied but no candidates came back. Reload — if that does not fix
            it, the round_tiebreak_entries rows are missing and the winner cannot be chosen here.
          </p>
        ) : (
          <div className="space-y-2">
            {tied.map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => setChoice(id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all disabled:opacity-50 ${
                  choice === id
                    ? 'bg-amber-400/10 border-amber-400/40'
                    : 'bg-slate-900/40 border-slate-800/70 hover:border-slate-700'
                }`}
              >
                {choice === id
                  ? <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                <WinnerEntry id={id} entry={entryFor(id)} />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={busy || choice === null}
          onClick={() => { void approve(); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-purple-500 hover:bg-purple-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Scale className="w-4 h-4" />
          {busy ? 'Approving…' : choice === null ? 'Select the winning entry' : 'Approve Winner & Start Challenge'}
        </button>
        {permanence}
      </Section>
    );
  }

  const winner = round.winningSubmissionId;

  return (
    <Section
      title="Winner pending approval"
      description="The ballot is closed and the totals are frozen. The winner is not official, and the challenge does not start, until you approve it."
    >
      {error && <Banner tone="error" text={error} onDismiss={() => setError(null)} />}

      {winner === null ? (
        <p className="text-sm text-rose-400">
          Voting is closed but no winning entry is recorded. This should not happen — a closed
          round is either pending with one entry or tied with several.
        </p>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-800/70 rounded-xl">
          <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <WinnerEntry id={winner} entry={loaded ? entryFor(winner) : null} />
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black font-mono text-amber-400">{round.winnerVoteCount ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-600 font-mono">
              of {round.totalVotes ?? 0} cast
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={busy || winner === null}
        onClick={() => { void approve(); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-purple-500 hover:bg-purple-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trophy className="w-4 h-4" />
        {busy ? 'Approving…' : 'Approve Winner & Start Challenge'}
      </button>
      {permanence}
    </Section>
  );
}

// ── BALLOT MODERATION ─────────────────────────────────────────────────────────
//
// Who voted for what. The only place in the app where a voter and their choice appear
// together: ballot secrecy is a rule for everyone else, and no public endpoint carries
// voter identity. This exists for investigating a dispute.
//
// Collapsed by default on purpose. An administrator opening Round Control to advance a
// phase has no business reading the ballot, and making it a deliberate click keeps that
// distinction visible.

function BallotModeration({ round }: { round: CurrentRound }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ApiVoteAudit[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void (async () => {
      const list = await api.admin.votes();
      if (!live) return;
      setRows(list ?? []);
      setFailed(list === null);
    })();
    return () => { live = false; };
  }, [open, round.id]);

  return (
    <Section
      title="Ballot"
      description="Who voted for what, for moderation only. Players never see this — the public surfaces show totals and nothing else."
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold transition-all"
      >
        <Eye className="w-3.5 h-3.5" />
        {open ? 'Hide the ballot' : 'Show who voted for what'}
      </button>

      {open && (
        rows === null ? (
          <p className="text-sm text-slate-500">Loading the ballot…</p>
        ) : failed ? (
          <p className="text-sm text-rose-400">Could not read the ballot. Reload to try again.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No votes have been cast in this round.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-600">
              {rows.length} {rows.length === 1 ? 'vote' : 'votes'}, newest first.
            </p>
            {rows.map((row) => (
              <div
                key={row.voteId}
                className="flex items-center gap-3 px-3 py-2 bg-slate-900/40 border border-slate-800/70 rounded-xl"
              >
                {row.avatarUrl ? (
                  <img
                    src={row.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full flex-shrink-0 object-cover bg-slate-800"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 flex-shrink-0">
                    {row.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">
                    {row.username}
                    <span className="text-slate-600 font-mono font-normal ml-1.5">
                      {row.country} · {row.osuId}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    voted for {row.submissionArtist} - {row.submissionTitle} [{row.difficultyName}]
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">
                  {new Date(row.castAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </Section>
  );
}

// ── ROUND CONTROL ─────────────────────────────────────────────────────────────

function RoundControl({ round, onRoundChange }: { round: CurrentRound | null; onRoundChange: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [subDays, setSubDays]  = useState('7');
  const [voteDays, setVoteDays] = useState('3');
  const [chalDays, setChalDays] = useState('21');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [reward, setReward] = useState('');
  const countdown = useCountdown(round?.endsAt);

  const describe = (result: { status: number; error: string }) =>
    result.status === 0 ? result.error : `${result.error} (HTTP ${result.status})`;

  // Blank fields are omitted so the server applies its own defaults (current UTC
  // month and year) rather than being sent empty strings.
  const newRoundBody = () => ({
    month: month.trim() || undefined,
    year: year.trim() ? Number(year) : undefined,
    reward: reward.trim() || undefined,
    submissionDays: Number(subDays),
    votingDays: Number(voteDays),
    challengeDays: Number(chalDays),
  });

  const advance = async (next: Phase) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await api.admin.setPhase(next);
    if (result.ok) setNotice(`Round ${result.data.round.roundNumber} is now in the ${next} phase.`);
    else setError(describe(result));
    await onRoundChange();
    setBusy(false);
  };

  // Closing the ballot does not advance the phase. The round stays in 'voting' with
  // the winner pending or tied, and only WinnerPanel below can move it on — counting
  // and freezing the totals happen server-side in one transaction.
  const closeBallot = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await api.admin.closeVoting();
    if (result.ok) {
      setNotice(
        result.data.tied.length > 1
          ? `Voting closed level between ${result.data.tied.length} entries — pick the winner below.`
          : 'Voting closed. The leading entry is waiting for your approval below.'
      );
    } else setError(describe(result));
    await onRoundChange();
    setBusy(false);
  };

  // Ending a round and opening the next are two writes: rounds_single_open means
  // one row cannot be both ended and open. If the second call fails the round is
  // closed with nothing open, which the "Open a Round" form below recovers.
  const archiveAndOpenNext = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const ended = await api.admin.setPhase('ended');
    if (!ended.ok) {
      setError(`Could not end the round: ${describe(ended)}`);
      await onRoundChange();
      setBusy(false);
      return;
    }
    const created = await api.admin.createRound(newRoundBody());
    if (created.ok) setNotice(`Round ${created.data.roundNumber} opened in the submission phase.`);
    else setError(`Round ended, but opening the next one failed: ${describe(created)}`);
    await onRoundChange();
    setBusy(false);
  };

  const openRound = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const created = await api.admin.createRound(newRoundBody());
    if (created.ok) setNotice(`Round ${created.data.roundNumber} opened in the submission phase.`);
    else setError(describe(created));
    await onRoundChange();
    setBusy(false);
  };

  const nextActions: Record<Phase, { label: string; color: string; run: () => Promise<void> }> = {
    submission: { label: 'Close Submissions & Start Voting', color: 'bg-blue-500 hover:bg-blue-400 text-white',       run: () => advance('voting') },
    voting:     { label: 'Close Voting & Count the Ballot',  color: 'bg-amber-400 hover:bg-amber-300 text-slate-950',  run: closeBallot },
    challenge:  { label: 'Archive Round & Open the Next',    color: 'bg-amber-400 hover:bg-amber-300 text-slate-950', run: archiveAndOpenNext },
  };

  const durationInputs = (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Submission', val: subDays,  set: setSubDays },
        { label: 'Voting',     val: voteDays, set: setVoteDays },
        { label: 'Challenge',  val: chalDays, set: setChalDays },
      ].map(({ label, val, set }) => (
        <div key={label}>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">{label} (days)</p>
          <input
            type="number"
            min="1"
            max="365"
            value={val}
            onChange={(e) => set(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors"
          />
        </div>
      ))}
    </div>
  );

  const phaseIdx = round ? PHASES.findIndex((p) => p.key === round.phase) : -1;
  // The ballot closes on winner_status, not on the phase, so a round in 'voting'
  // with a winner pending has no phase action left — approving one is the only move.
  const ballotClosed = round?.phase === 'voting' && round.winnerStatus !== 'none';

  return (
    <div className="space-y-5">
      {error  && <Banner tone="error" text={error}  onDismiss={() => setError(null)} />}
      {notice && <Banner tone="ok"    text={notice} onDismiss={() => setNotice(null)} />}

      {round ? (
        <>
          <Section
            title="Phase Timeline"
            description={
              ballotClosed
                ? `${roundLabel(round)} — the ballot is closed and the totals are frozen.`
                : `${roundLabel(round)} — this phase ends in ${countdown}.`
            }
          >
            {/* Phase progress */}
            <div className="flex items-center gap-0">
              {PHASES.map((p, i) => (
                <React.Fragment key={p.key}>
                  <div className={`flex flex-col items-center gap-1.5 flex-1 ${i <= phaseIdx ? '' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      i < phaseIdx  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                      i === phaseIdx ? 'bg-amber-400/20 border-amber-400 text-amber-400' :
                      'bg-slate-900 border-slate-700 text-slate-600'
                    }`}>
                      {i < phaseIdx ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      i === phaseIdx ? p.color : i < phaseIdx ? 'text-emerald-400' : 'text-slate-600'
                    }`}>{p.label}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div className={`h-px flex-1 mb-5 transition-colors ${i < phaseIdx ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Action button — absent once the ballot is closed, because approving the
                winner is then the only way forward and WinnerPanel owns that. */}
            {ballotClosed ? (
              <div className="flex items-start gap-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                <Trophy className="w-4 h-4 text-blue-400 flex-shrink-0 mt-px" />
                <p className="text-xs text-blue-300/90">
                  Voting is closed — nobody can cast or retract a vote. The round leaves the
                  voting phase only when you approve the winner below.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { void nextActions[round.phase].run(); }}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${nextActions[round.phase].color}`}
                >
                  <ChevronRight className="w-4 h-4" />
                  {busy ? 'Working…' : nextActions[round.phase].label}
                </button>
                <p className="text-[11px] text-slate-600 text-center">
                  This change is immediate and visible to all users. There is no confirmation.
                </p>
              </>
            )}
          </Section>

          {ballotClosed && <WinnerPanel round={round} onRoundChange={onRoundChange} />}

          {round.phase !== 'submission' && <BallotModeration round={round} />}

          <Section
            title="Schedule"
            description="Fixed when the round was opened. Advancing a phase early does not move the later deadlines."
          >
            <div className="space-y-2">
              {PHASES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <span className={`text-xs font-bold ${key === round.phase ? 'text-amber-400' : 'text-slate-400'}`}>
                    {label} ends
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{formatDeadline(round.schedule[key])}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Next Round" description="Durations applied when this round is archived and the next one opens.">
            {durationInputs}
          </Section>
        </>
      ) : (
        <Section
          title="Open a Round"
          description="Nothing is running. Submissions, voting and the challenge all key off the open round, so the platform stays idle until one exists."
        >
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Month',  val: month,  set: setMonth,  hint: 'current UTC month' },
              { label: 'Year',   val: year,   set: setYear,   hint: 'current year' },
              { label: 'Reward', val: reward, set: setReward, hint: 'One month of osu!supporter' },
            ].map(({ label, val, set, hint }) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">{label}</p>
                <input
                  type="text"
                  value={val}
                  placeholder={hint}
                  onChange={(e) => set(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            ))}
          </div>
          {durationInputs}
          <button
            type="button"
            disabled={busy}
            onClick={() => { void openRound(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Opening…' : 'Open Round'}
          </button>
          <p className="text-[11px] text-slate-600">
            The durations become absolute deadlines that cascade — each phase is scheduled to start
            when the previous one closes. Blank month and year default to the current UTC month.
          </p>
        </Section>
      )}
    </div>
  );
}


// ── SUBMISSIONS REVIEW ────────────────────────────────────────────────────────

const REVIEW_TONE: Record<ApiSubmission['reviewStatus'], string> = {
  pending: 'bg-amber-400/10 border-amber-400/25 text-amber-400',
  approved: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  rejected: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
};

/**
 * The gate between a submission existing and it being votable: GET
 * /api/submissions only returns 'approved' rows, so nothing reaches the vote page
 * until it is approved here.
 */
function SubmissionsTab({
  round,
  onReviewed,
}: {
  round: CurrentRound | null;
  onReviewed: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<ApiSubmission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api.admin.submissions();
    setRows(list ?? []);
    setLoadFailed(list === null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load, round?.id]);

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    setBusyId(id);
    setError(null);
    const result = await api.admin.reviewSubmission(id, status);
    if (result.ok) {
      // Patch the one row rather than refetching, so the list does not reorder
      // under the cursor mid-review.
      setRows((prev) => prev.map((r) => (r.id === id ? result.data.submission : r)));
      await onReviewed();
    } else {
      setError(result.status === 0 ? result.error : `${result.error} (HTTP ${result.status})`);
    }
    setBusyId(null);
  };

  const pending = rows.filter((r) => r.reviewStatus === 'pending');

  if (!round) {
    return (
      <Section title="Submissions" description="Review queue for the open round.">
        <p className="text-sm text-slate-500">No round is open, so there is nothing to review.</p>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      {error && <Banner tone="error" text={error} onDismiss={() => setError(null)} />}

      <Section
        title="Review Queue"
        description={`${roundLabel(round)} — ${pending.length} awaiting review, ${rows.length} submitted in total.`}
      >
        {!loaded ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : loadFailed ? (
          <p className="text-sm text-rose-400">Could not reach the API. Reload to try again.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing has been submitted to this round yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((s) => (
              <div key={s.id} className="flex items-start gap-4 p-3 bg-slate-900/40 border border-slate-800/70 rounded-xl">
                {s.coverUrl && (
                  <img
                    src={s.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-24 h-14 rounded-lg object-cover flex-shrink-0 bg-slate-900"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{s.title}</p>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${REVIEW_TONE[s.reviewStatus]}`}>
                      {s.reviewStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {s.artist} · [{s.difficultyName}] · mapped by {s.mapper}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    ★ {s.stars.toFixed(2)} · {s.bpm} BPM · {s.length} · {s.mapStatus}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                      {s.modRequirement}
                    </span>
                    <span className="text-[10px] font-bold bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded text-amber-400">
                      {s.challengeRequirement}
                    </span>
                    <span className="text-[10px] text-slate-600">by {s.submittedByName}</span>
                    <a
                      href={beatmapUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" />
                      osu!
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busyId === s.id || s.reviewStatus === 'approved'}
                    onClick={() => { void decide(s.id, 'approved'); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id || s.reviewStatus === 'rejected'}
                    onClick={() => { void decide(s.id, 'rejected'); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── ELIGIBILITY ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: 'DZ', name: 'Algeria', enabled: true },
  { code: 'TN', name: 'Tunisia', enabled: false },
  { code: 'MA', name: 'Morocco', enabled: false },
  { code: 'LY', name: 'Libya',   enabled: false },
  { code: 'EG', name: 'Egypt',   enabled: false },
];

function EligibilityTab() {
  const [countries, setCountries] = useState(COUNTRIES);
  const [exceptions, setExceptions] = useState([
    { id: '1', username: 'Rimuru_dz',    country: 'DZ', allowed: true,  note: 'Community founder' },
    { id: '2', username: 'Saya_Kizuname', country: 'FR', allowed: true,  note: 'Diaspora exception' },
  ]);
  const [newEx, setNewEx] = useState('');

  const toggle = (code: string) =>
    setCountries((prev) => prev.map((c) => c.code === code ? { ...c, enabled: !c.enabled } : c));

  return (
    <div className="space-y-5">
      <Section title="Country Allowlist" description="Only players from enabled countries may submit or vote.">
        <div className="space-y-2">
          {countries.map((c) => (
            <div key={c.code} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{c.code === 'DZ' ? '🇩🇿' : c.code === 'TN' ? '🇹🇳' : c.code === 'MA' ? '🇲🇦' : c.code === 'LY' ? '🇱🇾' : '🇪🇬'}</span>
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-[10px] text-slate-600 font-mono">{c.code}</p>
                </div>
              </div>
              <button type="button" onClick={() => toggle(c.code)} className="transition-opacity hover:opacity-80">
                {c.enabled
                  ? <ToggleRight className="w-7 h-7 text-emerald-400" />
                  : <ToggleLeft  className="w-7 h-7 text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="User Exceptions" description="Grant or block individual players regardless of country.">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="osu! username"
            value={newEx}
            onChange={(e) => setNewEx(e.target.value)}
            className="flex-1 bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => {
              if (!newEx.trim()) return;
              setExceptions((prev) => [...prev, { id: String(Date.now()), username: newEx.trim(), country: '??', allowed: true, note: '' }]);
              setNewEx('');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {exceptions.map((ex) => (
            <div key={ex.id} className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2.5">
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{ex.username}</p>
                {ex.note && <p className="text-[10px] text-slate-500">{ex.note}</p>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                ex.allowed
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}>
                {ex.allowed ? 'Allowed' : 'Blocked'}
              </span>
              <button type="button" onClick={() => setExceptions((prev) => prev.filter((e) => e.id !== ex.id))} className="text-slate-600 hover:text-rose-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── BEATMAP RULES ─────────────────────────────────────────────────────────────

function BeatmapRulesTab() {
  const [starMin, setStarMin] = useState('3.00');
  const [starMax, setStarMax] = useState('9.00');
  const [lenMin,  setLenMin]  = useState('0:30');
  const [lenMax,  setLenMax]  = useState('5:00');
  const [statuses, setStatuses] = useState({ ranked: true, loved: true, approved: true });

  const toggleStatus = (k: keyof typeof statuses) =>
    setStatuses((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="space-y-5">
      <Section title="Star Rating Range" description="Submitted beatmaps must fall within this range.">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Minimum ★', val: starMin, set: setStarMin },
            { label: 'Maximum ★', val: starMax, set: setStarMax },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">{label}</p>
              <input
                type="text"
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Length Range" description="Drain time of the beatmap must fall within this range.">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Minimum (m:ss)', val: lenMin, set: setLenMin },
            { label: 'Maximum (m:ss)', val: lenMax, set: setLenMax },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">{label}</p>
              <input
                type="text"
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Allowed Beatmap Statuses">
        <div className="flex gap-3 flex-wrap">
          {(Object.keys(statuses) as (keyof typeof statuses)[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all capitalize ${
                statuses[s]
                  ? s === 'ranked'   ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : s === 'loved'    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  :                   'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  : 'bg-slate-900/40 border-slate-700 text-slate-600'
              }`}
            >
              {statuses[s] ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {s}
            </button>
          ))}
        </div>
      </Section>

      <button type="button" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all">
        Save Rules
      </button>
    </div>
  );
}

// ── CHALLENGE SETUP ───────────────────────────────────────────────────────────

const ALL_MODS = ['NM', 'HD', 'HR', 'DT', 'EZ', 'FL', 'HDHR', 'HDDT', 'HRDT'];

function ChallengeTab() {
  const [enabledMods, setEnabledMods] = useState<string[]>(['NM', 'HD', 'HR', 'DT', 'HDHR', 'HDDT']);
  const [types, setTypes] = useState(['Full Combo', 'Top #1 Score', 'Best Accuracy', 'Lowest Miss Count']);
  const [newType, setNewType] = useState('');
  const [bounty, setBounty] = useState('');

  const toggleMod = (m: string) =>
    setEnabledMods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  return (
    <div className="space-y-5">
      <Section title="Allowed Mods" description="Players can choose from these mods when submitting a beatmap.">
        <div className="flex flex-wrap gap-2">
          {ALL_MODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMod(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                enabledMods.includes(m)
                  ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-600 hover:text-slate-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Challenge Types" description="The types of challenges that can be chosen when submitting.">
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t} className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2.5">
              <span className="text-sm text-white">{t}</span>
              <button type="button" onClick={() => setTypes((prev) => prev.filter((x) => x !== t))} className="text-slate-600 hover:text-rose-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New challenge type…"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newType.trim()) {
                setTypes((prev) => [...prev, newType.trim()]);
                setNewType('');
              }
            }}
            className="flex-1 bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => { if (newType.trim()) { setTypes((prev) => [...prev, newType.trim()]); setNewType(''); } }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </Section>

      <Section title="Monthly Bounty Description" description="Shown on the challenge page header. Markdown not supported.">
        <textarea
          value={bounty}
          onChange={(e) => setBounty(e.target.value)}
          placeholder="Describe the challenge bounty, special rules, or prizes for this round…"
          rows={4}
          className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors resize-none"
        />
        <button type="button" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all">
          Save Challenge Settings
        </button>
      </Section>
    </div>
  );
}

// ── USERS ─────────────────────────────────────────────────────────────────────

const SAMPLE_USERS = [
  { id: '1', username: 'Rimuru_dz',     country: 'DZ', rank: 12043, submissions: 3, banned: false },
  { id: '2', username: 'Saya_Kizuname', country: 'DZ', rank: 98321, submissions: 1, banned: false },
  { id: '3', username: 'Azzedd',         country: 'DZ', rank: 4201,  submissions: 5, banned: false },
  { id: '4', username: 'TheSlimyBoy',   country: 'DZ', rank: 55120, submissions: 2, banned: true  },
  { id: '5', username: 'xX_Djezz_Xx',   country: 'DZ', rank: 7830,  submissions: 4, banned: false },
  { id: '6', username: 'NAT_Oran',       country: 'DZ', rank: 21000, submissions: 1, banned: false },
];

function UsersTab() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(SAMPLE_USERS);

  const shown = users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()));

  const toggleBan = (id: string) =>
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, banned: !u.banned } : u));

  return (
    <div className="space-y-5">
      <div className="relative">
        <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by username…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-[#0d1526] border border-slate-800 focus:border-amber-400/50 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
        />
      </div>

      <div className="bg-[#0d1526] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-mono px-5 py-3">Username</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-mono px-5 py-3">Country</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-mono px-5 py-3">Rank</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-mono px-5 py-3">Submissions</th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-mono px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((u, i) => (
              <tr key={u.id} className={`border-b border-slate-800/50 last:border-0 ${i % 2 === 1 ? 'bg-slate-900/20' : ''}`}>
                <td className="px-5 py-3 text-sm font-bold text-white">{u.username}</td>
                <td className="px-5 py-3 text-sm text-slate-400 font-mono">{u.country}</td>
                <td className="px-5 py-3 text-sm font-mono text-slate-300">#{u.rank.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm font-mono text-slate-400">{u.submissions}</td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    u.banned
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {u.banned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleBan(u.id)}
                    className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-all ${
                      u.banned
                        ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400'
                        : 'bg-slate-800 border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

function ConfigTab() {
  const [siteName, setSiteName] = useState('osudz.ppy');
  const [discord,  setDiscord]  = useState('');
  const [maxSubs,  setMaxSubs]  = useState('1');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  return (
    <div className="space-y-5">
      <Section title="Site Settings">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">Site Name</p>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">Max Submissions Per User / Round</p>
            <input
              type="number"
              min="1"
              max="5"
              value={maxSubs}
              onChange={(e) => setMaxSubs(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors"
            />
          </div>
        </div>
      </Section>

      <Section title="Discord Integration" description="Announce phase changes and winner to a Discord channel.">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-mono">Webhook URL</p>
          <input
            type="password"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="w-full bg-slate-900/60 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors font-mono"
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`w-2 h-2 rounded-full ${discord ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-500">{discord ? 'Webhook configured' : 'No webhook configured'}</span>
        </div>
      </Section>

      <Section title="Maintenance Mode" description="Prevents all user actions while admin work is in progress.">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Enable maintenance mode</p>
            <p className="text-xs text-slate-500">Users see a maintenance message. Admin access is unaffected.</p>
          </div>
          <button type="button" onClick={() => setMaintenanceMode((v) => !v)}>
            {maintenanceMode
              ? <ToggleRight className="w-8 h-8 text-rose-400" />
              : <ToggleLeft  className="w-8 h-8 text-slate-600" />}
          </button>
        </div>
        {maintenanceMode && (
          <div className="flex items-center gap-2 bg-rose-500/8 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="text-xs text-rose-300">Site is in maintenance mode. All user-facing actions are blocked.</p>
          </div>
        )}
      </Section>

      <button type="button" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition-all">
        Save Configuration
      </button>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────

interface AdminDashboardProps {
  round: CurrentRound | null;
  user: AuthUser | null;
  onRoundChange: () => void | Promise<void>;
  onLogin?: () => void;
}

/**
 * Shown instead of the dashboard to anyone who is not an admin. The nav button is
 * already hidden for them, so this is only reachable directly — but the check
 * belongs here too, and the endpoints behind it enforce the real gate.
 */
function AdminLocked({ user, onLogin }: { user: AuthUser | null; onLogin?: () => void }) {
  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto mb-5">
        <Shield className="w-6 h-6 text-rose-400" />
      </div>
      <h1 className="text-lg font-black text-white mb-2">Admin access required</h1>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        {user
          ? `${user.username} is not an admin on this instance. Admin accounts are listed in ADMIN_OSU_IDS on the server.`
          : 'Sign in with an osu! account that has admin access.'}
      </p>
      {!user && (
        <button
          type="button"
          onClick={onLogin}
          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all"
        >
          Login with osu!
        </button>
      )}
    </div>
  );
}

export function AdminDashboard({ round, user, onRoundChange, onLogin }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('round');

  if (!user?.isAdmin) return <AdminLocked user={user} onLogin={onLogin} />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-rose-400/70 font-mono">Admin</p>
          <h1 className="text-xl font-black text-white tracking-tight">Admin Dashboard</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5">
          <Music2 className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
            {round ? `${round.phase} Phase Active` : 'No active round'}
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <aside className="w-44 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
                  tab === key
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!WIRED_TABS.includes(tab) && (
            <div className="mb-5 flex items-start gap-2.5 bg-amber-400/8 border border-amber-400/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-px" />
              <p className="text-xs text-amber-400/80">
                This tab is UI only — nothing here is saved. Round Control and Submissions are the wired ones.
              </p>
            </div>
          )}
          {tab === 'round'       && <RoundControl round={round} onRoundChange={onRoundChange} />}
          {tab === 'submissions' && <SubmissionsTab round={round} onReviewed={onRoundChange} />}
          {tab === 'eligibility' && <EligibilityTab />}
          {tab === 'rules'       && <BeatmapRulesTab />}
          {tab === 'challenge'   && <ChallengeTab />}
          {tab === 'users'       && <UsersTab />}
          {tab === 'config'      && <ConfigTab />}
        </div>
      </div>
    </div>
  );
}
