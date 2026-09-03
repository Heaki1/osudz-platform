export interface BountyChallenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  difficulty: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  completedBy: number;
}

export interface BeatmapComment {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  rating?: number;
}

export interface BeatmapBounty {
  id: string;
  title: string;
  artist: string;
  mapper: string;
  genre: 'Electronic' | 'Rock' | 'Pop' | 'Classical' | 'Anime';
  difficultyRating: number;
  difficultyCategory: 'Easy' | 'Normal' | 'Hard' | 'Insane';
  difficultyName: string;
  votes: number;
  userVoted: boolean;
  userFavorited: boolean;
  bannerUrl: string;
  previewDuration: string;
  previewSeconds: number;
  currentPlaybackTime: number;
  isPlaying: boolean;
  bpm: number;
  length: string;
  circleSize: number;
  approachRate: number;
  accuracy: number;
  hpDrain: number;
  bountyRewardPoints: number;
  description: string;
  comments: BeatmapComment[];
  challenges: BountyChallenge[];
}

export interface Session {
  authenticated: boolean;
  username: string;
  avatar: string;
  osu_id: number;
  can_vote: boolean;
  vote_blocked_reason: string | null;
  is_admin: boolean;
}

export interface Challenge {
  id: number;
  month: string;
  title: string;
  bounty: string;
  status: 'draft' | 'open' | 'closed';
  closes_at: string | null;
  candidates: ApiCandidate[];
  user_vote: { beatmap_id: number } | null;
}

export interface ApiCandidate {
  beatmap_id: number;
  title: string;
  artist: string | null;
  mapper: string | null;
  difficulty_name: string | null;
  stars: string;
  cs: string;
  ar: string;
  od: string;
  hp: string;
  bpm: string;
  length: string;
  cover_url: string | null;
  preview_url: string | null;
  vote_count: number;
}
