/**
 * API client for the CorridorKey Studio backend.
 * All calls go through the serverUrl from useSettingsStore.
 */

import { ClipEntry, GPUJob, JobType } from "./types";

let _serverUrl = "http://localhost:8000";

export function setServerUrl(url: string) {
  _serverUrl = url;
}

function url(path: string): string {
  return `${_serverUrl}${path}`;
}

// --- Clips ---

export async function fetchClips(): Promise<ClipEntry[]> {
  const res = await fetch(url("/clips"));
  if (!res.ok) throw new Error(`Failed to fetch clips: ${res.status}`);
  return res.json();
}

export async function importVideo(file: File): Promise<ClipEntry> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url("/clips/import"), { method: "POST", body: form });
  if (!res.ok) throw new Error(`Failed to import video: ${res.status}`);
  return res.json();
}

export async function deleteClip(clipId: string): Promise<void> {
  const res = await fetch(url(`/clips/${clipId}`), { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete clip: ${res.status}`);
}

export async function updateClip(
  clipId: string,
  update: { inPoint?: number | null; outPoint?: number | null; currentFrame?: number }
): Promise<ClipEntry> {
  const res = await fetch(url(`/clips/${clipId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Failed to update clip: ${res.status}`);
  return res.json();
}

export async function fetchCoverage(
  clipId: string
): Promise<{ annotations: number[]; alphaHints: number[]; inferenceOutput: number[] }> {
  const res = await fetch(url(`/clips/${clipId}/coverage`));
  if (!res.ok) throw new Error(`Failed to fetch coverage: ${res.status}`);
  return res.json();
}

// --- Frame URLs (for <img> src) ---

export function frameUrl(clipId: string, frameNum: number, layer: string = "input"): string {
  return url(`/clips/${clipId}/frames/${frameNum}?layer=${layer}`);
}

export function thumbnailUrl(clipId: string): string {
  return url(`/clips/${clipId}/thumbnail`);
}

// --- Jobs ---

export async function fetchJobs(): Promise<GPUJob[]> {
  const res = await fetch(url("/jobs"));
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  return res.json();
}

export async function createJob(clipId: string, type: JobType): Promise<GPUJob> {
  const res = await fetch(url("/jobs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipId, type }),
  });
  if (!res.ok) throw new Error(`Failed to create job: ${res.status}`);
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(url(`/jobs/${jobId}`), { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to cancel job: ${res.status}`);
}

// --- SSE ---

export function subscribeToJobEvents(
  onProgress: (data: { id: string; currentFrame: number; progress: number; status: string }) => void,
  onComplete: (data: { id: string; clipId: string; clipState: string }) => void,
  onError: (data: { id: string; error: string }) => void,
  onClipState: (data: { id: string; state: string }) => void
): EventSource {
  const es = new EventSource(url("/jobs/events"));

  es.addEventListener("job:progress", (e) => onProgress(JSON.parse(e.data)));
  es.addEventListener("job:complete", (e) => onComplete(JSON.parse(e.data)));
  es.addEventListener("job:error", (e) => onError(JSON.parse(e.data)));
  es.addEventListener("job:cancelled", (e) => onError(JSON.parse(e.data)));
  es.addEventListener("clip:state", (e) => onClipState(JSON.parse(e.data)));

  return es;
}
