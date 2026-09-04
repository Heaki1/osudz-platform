// ApiSubmission -> Beatmap.
//
// The two shapes were deliberately named alike, but they are not identical: the
// DTO's id is a number and Beatmap's is a string, its map status lives under
// `mapStatus` while Beatmap calls it `status`, and Beatmap has no place for
// beatmapsetId or the review state. So the seam needs this small mapper rather
// than a cast.

import { ApiBeatmapPreview, ApiSubmission } from '../api/client';
import { Beatmap } from '../types';

export function toBeatmap(submission: ApiSubmission): Beatmap {
  return {
    id: String(submission.id),
    title: submission.title,
    artist: submission.artist,
    mapper: submission.mapper,
    difficultyName: submission.difficultyName,
    stars: submission.stars,
    bpm: submission.bpm,
    length: submission.length,
    status: submission.mapStatus,
    coverUrl: submission.coverUrl,
    previewUrl: submission.previewUrl || undefined,
    cs: submission.cs,
    ar: submission.ar,
    od: submission.od,
    hp: submission.hp,
    voteCount: submission.voteCount,
    isVoted: submission.isVoted ?? false,
    isFavorited: submission.isFavorited ?? false,
    modRequirement: submission.modRequirement,
    challengeType: submission.challengeRequirement,
    submittedByName: submission.submittedByName,
  };
}

/** osu! difficulty URL for a submission, for "open on osu!" links. */
export const beatmapUrl = (submission: ApiSubmission): string =>
  `https://osu.ppy.sh/beatmapsets/${submission.beatmapsetId}#osu/${submission.difficultyId}`;

/** "2:19" from the preview's raw seconds — submissions arrive pre-formatted. */
export const formatLength = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The lookup result, shaped for the same card the rest of the app renders. */
export function previewToBeatmap(preview: ApiBeatmapPreview): Beatmap {
  return {
    id: `preview-${preview.difficultyId}`,
    title: preview.title,
    artist: preview.artist,
    mapper: preview.mapper,
    difficultyName: preview.difficultyName,
    stars: preview.stars,
    bpm: preview.bpm,
    length: formatLength(preview.lengthSeconds),
    status: preview.mapStatus,
    coverUrl: preview.coverUrl,
    previewUrl: preview.previewUrl || undefined,
    cs: preview.cs ?? undefined,
    ar: preview.ar ?? undefined,
    od: preview.od ?? undefined,
    hp: preview.hp ?? undefined,
  };
}
