import { describe, expect, it } from 'vitest';
import { REVIEW_PRESENTATION, beatmapUrl, toBeatmap } from './submission';
import type { ApiSubmission } from '../api/client';

const submission = (over: Partial<ApiSubmission> = {}): ApiSubmission => ({
  id: 7,
  beatmapsetId: 2297621,
  difficultyId: 4907876,
  title: 'Souzou Forest',
  artist: 'Kano',
  mapper: 'Kana Arima',
  difficultyName: 'Expert',
  mapStatus: 'ranked',
  coverUrl: 'https://assets.ppy.sh/cover.jpg',
  previewUrl: 'https://b.ppy.sh/preview/2297621.mp3',
  stars: 5.67,
  bpm: 180,
  length: '4:06',
  cs: 3.8,
  ar: 9.2,
  od: 9,
  hp: 5,
  challengeRequirement: 'Lowest Miss Count',
  modRequirement: 'HD',
  submittedByName: 'Heaki',
  voteCount: 3,
  reviewStatus: 'approved',
  submittedAt: '2026-09-03T23:52:19.497Z',
  ...over,
});

describe('toBeatmap', () => {
  it('renames the three fields the two shapes disagree about', () => {
    const mapped = toBeatmap(submission());
    // id is a string on Beatmap and a number on the DTO — the reason this mapper exists
    // rather than a cast.
    expect(mapped.id).toBe('7');
    expect(mapped.status).toBe('ranked');
    expect(mapped.challengeType).toBe('Lowest Miss Count');
  });

  it('carries the vote count and the requirements through untouched', () => {
    const mapped = toBeatmap(submission({ voteCount: 12 }));
    expect(mapped.voteCount).toBe(12);
    expect(mapped.modRequirement).toBe('HD');
    expect(mapped.submittedByName).toBe('Heaki');
  });

  // isVoted is per-caller: whose vote it would be depends on who is asking, so App
  // applies it from GET /votes/my instead of this mapper inventing an answer.
  it('does not decide whether the caller voted for it', () => {
    expect(toBeatmap(submission()).isVoted).toBeUndefined();
  });

  it('turns an empty preview url into undefined, so no audio element is built', () => {
    expect(toBeatmap(submission({ previewUrl: '' })).previewUrl).toBeUndefined();
  });

  it('defaults isFavorited rather than leaving it undefined', () => {
    expect(toBeatmap(submission()).isFavorited).toBe(false);
    expect(toBeatmap(submission({ isFavorited: true })).isFavorited).toBe(true);
  });
});

describe('beatmapUrl', () => {
  it('links the difficulty, not just the set', () => {
    expect(beatmapUrl(submission())).toBe(
      'https://osu.ppy.sh/beatmapsets/2297621#osu/4907876'
    );
  });
});

describe('REVIEW_PRESENTATION', () => {
  it('has a label, a tone and a blurb for every review state', () => {
    for (const status of ['pending', 'approved', 'rejected'] as const) {
      const copy = REVIEW_PRESENTATION[status];
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.tone.length).toBeGreaterThan(0);
      expect(copy.blurb.length).toBeGreaterThan(0);
    }
  });

  // Named by request: the state is 'rejected' in the database but a submitter is told
  // changes were requested, because they can withdraw and re-enter while the round is
  // still in its submission phase.
  it('presents rejection as changes requested', () => {
    expect(REVIEW_PRESENTATION.rejected.label).toBe('Changes Requested');
  });
});
