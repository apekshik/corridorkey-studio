import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Defaults that mirror app/lib/types.ts. The action falls back to these if
 * the project hasn't been saved (settings === undefined). Keep this small —
 * proper defaults live on the frontend; this is just a safety net.
 */
const DEFAULT_INFERENCE = {
  inputIsLinear: false,
  despillStrength: 1.0,
  autoDespeckle: true,
  despeckleSize: 200,
  refinerScale: 1.0,
};

const DEFAULT_OUTPUT = {
  fgEnabled: true,
  fgFormat: "exr" as const,
  fgPremult: "premult" as const,
  matteEnabled: true,
  matteFormat: "exr" as const,
  compEnabled: false,
  compFormat: "png" as const,
  processedEnabled: true,
  processedFormat: "exr" as const,
  generateCompPreview: true,
};

/**
 * Dispatch a keying job to the fal keying app. Webhook-driven: the response
 * here is just the queue ack; results land via /fal-webhook/key (and an
 * interim /fal-webhook/alpha) and flow into the `frames` table.
 *
 * `FAL_KEY` lives only in this action.
 */
export const dispatch = action({
  args: {
    clipId: v.id("clips"),
    scope: v.union(
      v.literal("ready"),
      v.literal("selected"),
      v.literal("all")
    ),
  },
  handler: async (ctx, { clipId, scope }): Promise<{ requestId: string }> => {
    const FAL_KEY = process.env.FAL_KEY;
    const KEYING_APP_ID = process.env.FAL_KEYING_APP_ID;
    const SITE_URL = process.env.CONVEX_SITE_URL;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured on Convex");
    if (!KEYING_APP_ID) throw new Error("FAL_KEYING_APP_ID not configured on Convex");
    if (!SITE_URL) throw new Error("CONVEX_SITE_URL not available");

    const clip = await ctx.runQuery(api.clips.get, { clipId });
    if (!clip) throw new Error("Clip not found or access denied");
    if (!clip.projectId) throw new Error("Clip has no project");
    if (!clip.sourceUrl) throw new Error("Clip has no source video");

    const project = await ctx.runQuery(api.projects.get, {
      projectId: clip.projectId,
    });
    if (!project) throw new Error("Project not found");

    const inference = project.settings?.inferenceParams ?? DEFAULT_INFERENCE;
    const output = project.settings?.outputConfig ?? DEFAULT_OUTPUT;

    // Webhook URL — fal POSTs the response body here when the job finishes.
    // The handler in convex/http.ts looks up the clip by request_id via the
    // by_fal_keying_request index, so we don't need to encode the clipId.
    const alphaWebhook = `${SITE_URL}/fal-webhook/alpha`;
    const keyWebhook = `${SITE_URL}/fal-webhook/key`;

    // /pipeline chains GVM then CorridorKey; emits the alpha-done webhook
    // mid-run so the UI can stream hints before the mattes land.
    const url = `https://queue.fal.run/${KEYING_APP_ID}/pipeline?fal_webhook=${encodeURIComponent(keyWebhook)}`;

    const payload = {
      clip_id: clipId,
      source_url: clip.sourceUrl,
      frame_urls: clip.previewFrameUrls ?? [],
      frame_count: clip.frameCount ?? 0,
      in_point: clip.inPoint ?? null,
      out_point: clip.outPoint ?? null,
      scope,
      settings: inference,
      output_config: output,
      alpha_webhook: alphaWebhook,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      await ctx.runMutation(internal.clips._markKeyingError, {
        clipId,
        error: `fal submit failed (${resp.status}): ${text.slice(0, 500)}`,
      });
      throw new Error(`fal submit failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as { request_id: string };
    await ctx.runMutation(internal.clips._markKeying, {
      clipId,
      falKeyingRequestId: data.request_id,
    });

    return { requestId: data.request_id };
  },
});

export const cancel = action({
  args: { clipId: v.id("clips") },
  handler: async (ctx, { clipId }): Promise<{ cancelled: boolean }> => {
    const FAL_KEY = process.env.FAL_KEY;
    const KEYING_APP_ID = process.env.FAL_KEYING_APP_ID;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured on Convex");
    if (!KEYING_APP_ID) throw new Error("FAL_KEYING_APP_ID not configured on Convex");

    const clip = await ctx.runQuery(api.clips.get, { clipId });
    if (!clip) throw new Error("Clip not found or access denied");
    if (!clip.falKeyingRequestId) {
      return { cancelled: false };
    }

    const url = `https://queue.fal.run/${KEYING_APP_ID}/requests/${clip.falKeyingRequestId}/cancel`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Key ${FAL_KEY}` },
    });

    // fal returns 200 on success or 4xx if the job is already terminal;
    // either way we move the clip out of KEYING so the UI unblocks.
    await ctx.runMutation(internal.clips._markKeyingError, {
      clipId,
      error: resp.ok ? "Cancelled by user" : `Cancel returned ${resp.status}`,
    });

    return { cancelled: resp.ok };
  },
});
