// Shared types for the osu!dz platform.
//
// One beatmap model (`Beatmap`) covers every surface: dashboard, submit, vote,
// search, and archive. Field names deliberately match `ApiSubmission` in
// src/api/client.ts so that swapping sample data for real server DTOs is a
// rename, not a translation layer.

export type Phase = 'submission' | 'voting' | 'challenge';
export type BeatmapStatus = 'ranked' | 'loved' | 'approved';
export type PlatformPage = 'dashboard' | 'submit' | 'vote' | 'search' | 'admin' | 'archive';

export interface BeatmapComment {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  rating?: number;
}

export interface Beatmap {
  // ── Identity + metadata ──
  id: string;
  title: string;
  artist: string;
  mapper: string;
  difficultyName: string;
  stars: number;
  bpm: number;
  length: string;
  status: BeatmapStatus;
  coverUrl: string;
  previewUrl?: string;

  // ── Difficulty spec (rendered as bars on the vote card) ──
  cs?: number;
  ar?: number;
  od?: number;
  hp?: number;
  previewSeconds?: number;

  // ── Round / submission context ──
  voteCount?: number;
  isVoted?: boolean;
  isFavorited?: boolean;
  modRequirement?: string;
  challengeType?: string;
  submittedByName?: string;
  description?: string;
  comments?: BeatmapComment[];
}

export interface ChallengeScore {
  rank: number;
  username: string;
  score: number;
  accuracy: number;
  misses: number;
  mods: string;
  qualified: boolean;
  isMe?: boolean;
}

export interface ArchiveEntry {
  round: number;
  month: string;
  year: number;
  winner: {
    title: string;
    artist: string;
    mapper: string;
    stars: number;
    bpm: number;
    length: string;
    status: BeatmapStatus;
    difficultyName: string;
    coverUrl: string;
    previewUrl?: string;
    mod: string;
    challengeType: string;
    submittedBy: string;
    votes: number;
    totalVotes: number;
  };
  challengeWinner: {
    username: string;
    score: number;
    accuracy: number;
    misses: number;
    mods: string;
  };
  leaderboard: {
    rank: number;
    username: string;
    score: number;
    accuracy: number;
    misses: number;
    mods: string;
    qualified: boolean;
  }[];
  participants: number;
}
