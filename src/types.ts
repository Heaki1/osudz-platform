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

export interface SubmittedBeatmap {
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
  previewUrl?: string;
}
