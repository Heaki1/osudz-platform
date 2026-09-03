import type { BeatmapBounty, BountyChallenge, ApiCandidate } from './types';

function parseLength(s: string): number {
  if (!s) return 60;
  const parts = s.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return parseInt(s) || 60;
}

function difficultyCategory(stars: number): BeatmapBounty['difficultyCategory'] {
  if (stars < 2.5) return 'Easy';
  if (stars < 3.5) return 'Normal';
  if (stars < 4.5) return 'Hard';
  return 'Insane';
}

function defaultChallenges(stars: number): BountyChallenge[] {
  const isHard = stars >= 4.2;
  return [
    {
      id: 'c1',
      title: isHard ? '#1 HD Score' : '#1 Score',
      description: isHard
        ? 'Claim the top score with Hidden mod on this difficult map.'
        : 'Set the highest score on the leaderboard, any mod.',
      reward: isHard ? 200 : 150,
      icon: 'crown',
      difficulty: isHard ? 'Platinum' : 'Gold',
      completedBy: isHard ? 2 : 8,
    },
    {
      id: 'c2',
      title: 'Full Combo',
      description: 'Complete the map without dropping your combo.',
      reward: isHard ? 120 : 75,
      icon: 'zap',
      difficulty: isHard ? 'Gold' : 'Silver',
      completedBy: isHard ? 24 : 91,
    },
    {
      id: 'c3',
      title: 'S Rank',
      description: 'Achieve 95% accuracy or higher.',
      reward: 50,
      icon: 'medal',
      difficulty: 'Silver',
      completedBy: isHard ? 77 : 320,
    },
    {
      id: 'c4',
      title: 'First Pass',
      description: 'Submit your first score on this map.',
      reward: 10,
      icon: 'target',
      difficulty: 'Bronze',
      completedBy: isHard ? 440 : 1100,
    },
  ];
}

export function mapCandidate(
  c: ApiCandidate,
  userVotedId: number | null
): BeatmapBounty {
  const stars = parseFloat(c.stars) || 0;
  return {
    id: String(c.beatmap_id),
    title: c.title ?? 'Unknown',
    artist: c.artist ?? c.title ?? 'Unknown',
    mapper: c.mapper ?? 'unknown',
    genre: 'Electronic',
    difficultyRating: stars,
    difficultyCategory: difficultyCategory(stars),
    difficultyName: c.difficulty_name ?? '',
    votes: c.vote_count ?? 0,
    userVoted: userVotedId === c.beatmap_id,
    userFavorited: false,
    bannerUrl: c.cover_url ?? '',
    previewDuration: c.length ?? '0:00',
    previewSeconds: parseLength(c.length),
    currentPlaybackTime: 0,
    isPlaying: false,
    bpm: parseFloat(c.bpm) || 0,
    length: c.length ?? '0:00',
    circleSize: parseFloat(c.cs) || 0,
    approachRate: parseFloat(c.ar) || 0,
    accuracy: parseFloat(c.od) || 0,
    hpDrain: parseFloat(c.hp) || 0,
    bountyRewardPoints: 50,
    description: '',
    comments: [],
    challenges: defaultChallenges(stars),
  };
}
