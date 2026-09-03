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
}