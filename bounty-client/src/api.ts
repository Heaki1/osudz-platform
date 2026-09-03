import type { Session, Challenge } from './types';

export async function getMe(): Promise<Session | null> {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return null;
    const data = await r.json();
    return data.authenticated ? data : null;
  } catch {
    return null;
  }
}

export async function getCurrentChallenge(): Promise<Challenge | null> {
  try {
    const r = await fetch('/api/challenges/current', { credentials: 'include' });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export async function castVote(challengeId: number, beatmapId: number): Promise<boolean> {
  try {
    const r = await fetch(`/api/challenges/${challengeId}/vote`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatmap_id: beatmapId }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function getComments(challengeId: number, beatmapId: number) {
  try {
    const r = await fetch(
      `/api/challenges/${challengeId}/candidates/${beatmapId}/comments`,
      { credentials: 'include' }
    );
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}

export async function postComment(
  challengeId: number,
  beatmapId: number,
  body: string,
  parentId?: number
) {
  try {
    const r = await fetch(
      `/api/challenges/${challengeId}/candidates/${beatmapId}/comments`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parent_id: parentId ?? null }),
      }
    );
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
