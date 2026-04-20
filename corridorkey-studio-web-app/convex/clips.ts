import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Clips persist on explicit save. Queries + mutations here are user-scoped —
 * `ctx.auth.getUserIdentity()` returns the authenticated WorkOS identity,
 * which we resolve to a Convex users row. No client-supplied userId arg.
 */

async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
    .first();
  if (!user) {
    throw new Error("User row not found — call users.getOrCreate first");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("clips")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();
    if (!user) return [];
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== user._id) return [];
    return await ctx.db
      .query("clips")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { clipId: v.id("clips") },
  handler: async (ctx, { clipId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();
    if (!user) return null;
    const clip = await ctx.db.get(clipId);
    if (!clip || clip.userId !== user._id) return null;
    return clip;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Persist a clip that was being worked on in the browser. Called from the
 * client's "Save" action — takes everything the client knows and writes
 * a row. The source video must already be uploaded to fal CDN.
 */
export const save = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    sourceUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    previewFrameUrls: v.optional(v.array(v.string())),
    frameCount: v.optional(v.number()),
    fps: v.optional(v.number()),
    durationS: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    codec: v.optional(v.string()),
    inPoint: v.optional(v.number()),
    outPoint: v.optional(v.number()),
    currentFrame: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }
    const now = Date.now();
    const clipId = await ctx.db.insert("clips", {
      userId: user._id,
      projectId: args.projectId,
      name: args.name,
      state: "RAW",
      sourceUrl: args.sourceUrl,
      thumbnailUrl: args.thumbnailUrl,
      previewFrameUrls: args.previewFrameUrls,
      frameCount: args.frameCount,
      fps: args.fps,
      durationS: args.durationS,
      width: args.width,
      height: args.height,
      codec: args.codec,
      currentFrame: args.currentFrame ?? 0,
      inPoint: args.inPoint,
      outPoint: args.outPoint,
      warnings: [],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.projectId, { updatedAt: now });
    return clipId;
  },
});

export const remove = mutation({
  args: { clipId: v.id("clips") },
  handler: async (ctx, { clipId }) => {
    const user = await getCurrentUser(ctx);
    const clip = await ctx.db.get(clipId);
    if (!clip || clip.userId !== user._id) {
      throw new Error("Clip not found or access denied");
    }
    // Cascade delete frames. Rows only exist for keyed frames, so this is
    // typically cheap.
    const frames = await ctx.db
      .query("frames")
      .withIndex("by_clip", (q) => q.eq("clipId", clipId))
      .collect();
    for (const frame of frames) {
      await ctx.db.delete(frame._id);
    }
    await ctx.db.delete(clipId);
  },
});

/** Patch UI state on a saved clip (inPoint, outPoint, currentFrame). */
export const patchUiState = mutation({
  args: {
    clipId: v.id("clips"),
    inPoint: v.optional(v.number()),
    outPoint: v.optional(v.number()),
    currentFrame: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const clip = await ctx.db.get(args.clipId);
    if (!clip || clip.userId !== user._id) {
      throw new Error("Clip not found or access denied");
    }
    const patch: Partial<Doc<"clips">> = { updatedAt: Date.now() };
    if (args.inPoint !== undefined) patch.inPoint = args.inPoint;
    if (args.outPoint !== undefined) patch.outPoint = args.outPoint;
    if (args.currentFrame !== undefined) patch.currentFrame = args.currentFrame;
    await ctx.db.patch(args.clipId, patch);
  },
});

// ---------------------------------------------------------------------------
// Internal — used by fal webhook to update extraction state
// ---------------------------------------------------------------------------

export const _markExtracting = internalMutation({
  args: {
    clipId: v.id("clips"),
    falExtractRequestId: v.string(),
  },
  handler: async (ctx, { clipId, falExtractRequestId }) => {
    await ctx.db.patch(clipId, {
      state: "EXTRACTING",
      falExtractRequestId,
      updatedAt: Date.now(),
    });
  },
});

export const _applyExtractResult = internalMutation({
  args: {
    clipId: v.id("clips"),
    frameCount: v.number(),
    fps: v.number(),
    durationS: v.number(),
    width: v.number(),
    height: v.number(),
    codec: v.string(),
    thumbnailUrl: v.string(),
    previewFrameUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clipId, {
      state: "RAW",
      frameCount: args.frameCount,
      fps: args.fps,
      durationS: args.durationS,
      width: args.width,
      height: args.height,
      codec: args.codec,
      thumbnailUrl: args.thumbnailUrl,
      previewFrameUrls: args.previewFrameUrls,
      updatedAt: Date.now(),
    });
  },
});

export const _markExtractError = internalMutation({
  args: {
    clipId: v.id("clips"),
    error: v.string(),
  },
  handler: async (ctx, { clipId, error }) => {
    await ctx.db.patch(clipId, {
      state: "ERROR",
      errorMessage: error,
      updatedAt: Date.now(),
    });
  },
});
