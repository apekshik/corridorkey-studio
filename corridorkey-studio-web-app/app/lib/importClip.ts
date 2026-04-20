"use client";

import { fal } from "@fal-ai/client";
import { useSessionClipStore } from "../stores/useSessionClipStore";

// Configure the client once. All fal.* calls route through our Next.js
// server proxy so FAL_KEY never touches the browser.
let _configured = false;
function ensureConfigured() {
  if (_configured) return;
  fal.config({ proxyUrl: "/api/fal-proxy" });
  _configured = true;
}

/**
 * The deployed app id. Set via NEXT_PUBLIC_FAL_EXTRACT_APP so we can swap
 * between dev/prod deployments without a code change.
 *
 * Example value: "apekshik/corridorkey-studio-extract"
 */
const EXTRACT_APP_ID = process.env.NEXT_PUBLIC_FAL_EXTRACT_APP ?? "";

interface ExtractResult {
  frame_count: number;
  fps: number;
  duration_s: number;
  width: number;
  height: number;
  codec: string;
  thumbnail_url: string;
  preview_frame_urls: string[];
  processing_time_s: number;
}

/**
 * Import a video file into the current session:
 *   1. Upload the source to fal CDN
 *   2. Invoke the extract app with the resulting URL
 *   3. Populate useSessionClipStore
 *
 * Errors land on the store (`stage === "error"`) rather than throwing —
 * UI just watches the store for transitions.
 */
export async function importClip(file: File): Promise<void> {
  ensureConfigured();
  const store = useSessionClipStore.getState();

  if (!EXTRACT_APP_ID) {
    store.setError(
      "NEXT_PUBLIC_FAL_EXTRACT_APP is not set. Deploy the fal extract " +
        "app and add its id to .env.local."
    );
    return;
  }

  store.reset();
  store.setStage("uploading");

  let sourceUrl: string;
  try {
    sourceUrl = await fal.storage.upload(file);
  } catch (err) {
    store.setError(`Upload failed: ${formatError(err)}`);
    return;
  }

  store.setStage("extracting");
  store.setProgress(0);

  try {
    const result = (await fal.subscribe(EXTRACT_APP_ID, {
      input: {
        video_url: sourceUrl,
        max_dim: 480,
        jpeg_quality: 80,
      },
      logs: false,
      onQueueUpdate: (update) => {
        // fal queue emits `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`. We don't
        // get fine-grained progress from inside the container, so just
        // crawl the bar forward on each event.
        if (update.status === "IN_PROGRESS") {
          const cur = useSessionClipStore.getState().progress;
          store.setProgress(Math.min(0.95, cur + 0.1));
        }
      },
    })) as { data: ExtractResult };

    const data = result.data;
    store.setMeta({
      name: file.name,
      sourceUrl,
      thumbnailUrl: data.thumbnail_url,
      previewFrameUrls: data.preview_frame_urls,
      frameCount: data.frame_count,
      fps: data.fps,
      durationS: data.duration_s,
      width: data.width,
      height: data.height,
      codec: data.codec,
    });

    // Warm the browser cache by firing parallel image fetches for every
    // preview frame. Without this, scrubbing and playback trigger a fresh
    // network round-trip per frame — smooth playback needs the frames
    // already cached by the time React requests them via <img src>.
    prefetchAll(data.preview_frame_urls);
  } catch (err) {
    store.setError(`Extract failed: ${formatError(err)}`);
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Keep references so GC doesn't collect mid-prefetch. Cleared on new clip.
let _prefetchBag: HTMLImageElement[] = [];

function prefetchAll(urls: string[]): void {
  _prefetchBag = [];
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    // `loading="eager"` isn't an attribute of the Image constructor, but
    // since the image is never attached to the DOM, the default is already
    // eager for Image() objects.
    img.src = url;
    _prefetchBag.push(img);
  }
}
