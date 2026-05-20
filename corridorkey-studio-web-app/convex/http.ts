import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * fal webhook receivers for the keying pipeline. The keying app posts two
 * webhooks per run: an interim /alpha emission once GVM finishes, and a
 * terminal /key once CorridorKey finishes. Both deliver the same payload
 * shape: { request_id, status, payload: { clip_id, frames: [...] } }.
 *
 * Signature verification: HMAC-SHA256 of the raw body using
 * FAL_WEBHOOK_SECRET, compared against the `x-fal-webhook-signature` header.
 * If FAL_WEBHOOK_SECRET isn't set (dev environments) verification is
 * skipped and a warning is logged.
 */

type FrameUpdate = {
  frameNum: number;
  alphaHintUrl?: string;
  matteUrl?: string;
  fgUrl?: string;
  compUrl?: string;
  processedUrl?: string;
};

type FalWebhookBody = {
  request_id?: string;
  status?: string;
  payload?: {
    clip_id?: string;
    frames?: FrameUpdate[];
    error?: string;
  };
  // Some fal endpoints flatten payload onto the root — accept both shapes.
  clip_id?: string;
  frames?: FrameUpdate[];
  error?: string;
};

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.FAL_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("FAL_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }
  const provided =
    req.headers.get("x-fal-webhook-signature") ||
    req.headers.get("x-fal-signature");
  if (!provided) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === provided.toLowerCase();
}

function extractResult(body: FalWebhookBody): {
  requestId: string | null;
  frames: FrameUpdate[];
  error: string | null;
} {
  const requestId = body.request_id ?? null;
  const frames = body.payload?.frames ?? body.frames ?? [];
  const error = body.payload?.error ?? body.error ?? null;
  return { requestId, frames, error };
}

async function handleWebhook(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  req: Request,
  kind: "alpha" | "key"
): Promise<Response> {
  const rawBody = await req.text();

  if (!(await verifySignature(req, rawBody))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: FalWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { requestId, frames, error } = extractResult(body);
  if (!requestId) {
    return new Response("Missing request_id", { status: 400 });
  }

  const clip = await ctx.runQuery(internal.clips._findByKeyingRequest, {
    falKeyingRequestId: requestId,
  });
  if (!clip) {
    // Could be a duplicate delivery for a clip we've already torn down.
    return new Response("Clip not found", { status: 404 });
  }

  if (error) {
    await ctx.runMutation(internal.clips._markKeyingError, {
      clipId: clip._id,
      error: error.slice(0, 500),
    });
    return new Response("ok", { status: 200 });
  }

  if (kind === "alpha") {
    await ctx.runMutation(internal.frames._applyAlphaResult, {
      clipId: clip._id,
      frames,
    });
  } else {
    await ctx.runMutation(internal.frames._applyKeyResult, {
      clipId: clip._id,
      frames,
    });
  }

  return new Response("ok", { status: 200 });
}

http.route({
  path: "/fal-webhook/alpha",
  method: "POST",
  handler: httpAction(async (ctx, req) => handleWebhook(ctx, req, "alpha")),
});

http.route({
  path: "/fal-webhook/key",
  method: "POST",
  handler: httpAction(async (ctx, req) => handleWebhook(ctx, req, "key")),
});

export default http;
