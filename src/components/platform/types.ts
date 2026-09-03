export type Phase = 'submission' | 'voting' | 'challenge';
export type BeatmapStatus = 'ranked' | 'loved' | 'approved';
export type PlatformPage = 'dashboard' | 'submit' | 'vote' | 'search' | 'admin' | 'archive';

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

export interface PlatformBeatmap {
  id: string;
  title: string;
  artist: string;
  mapper: string;
  stars: number;
  bpm: number;
  length: string;
  status: BeatmapStatus;
  coverUrl: string;
  difficultyName: string;
  previewUrl?: string;
  isFavorited?: boolean;
  isVoted?: boolean;
  voteCount?: number;
  modRequirement?: string;
  challengeType?: string;
  submittedByName?: string;
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
