import { v } from "convex/values";
import {
  query,
  internalMutation,
  MutationCtx,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";

const frameUpdate = v.object({
  frameNum: v.number(),
  alphaHintUrl: v.optional(v.string()),
  matteUrl: v.optional(v.string()),
  fgUrl: v.optional(v.string()),
  compUrl: v.optional(v.string()),
  processedUrl: v.optional(v.string()),
});

type FrameUpdate = {
  frameNum: number;
  alphaHintUrl?: string;
  matteUrl?: string;
  fgUrl?: string;
  compUrl?: string;
  processedUrl?: string;
};

export const listByClip = query({
  args: { clipId: v.id("clips") },
  handler: async (ctx, { clipId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();
    if (!user) return [];
    const clip = await ctx.db.get(clipId);
    if (!clip || clip.userId !== user._id) return [];
    return await ctx.db
      .query("frames")
      .withIndex("by_clip_num", (q) => q.eq("clipId", clipId))
      .collect();
  },
});

async function upsertFrames(
  ctx: MutationCtx,
  clipId: Id<"clips">,
  updates: FrameUpdate[]
) {
  for (const u of updates) {
    const existing = await ctx.db
      .query("frames")
      .withIndex("by_clip_num", (q) =>
        q.eq("clipId", clipId).eq("frameNum", u.frameNum)
      )
      .unique();
    const patch: Record<string, string> = {};
    if (u.alphaHintUrl) patch.alphaHintUrl = u.alphaHintUrl;
    if (u.matteUrl) patch.matteUrl = u.matteUrl;
    if (u.fgUrl) patch.fgUrl = u.fgUrl;
    if (u.compUrl) patch.compUrl = u.compUrl;
    if (u.processedUrl) patch.processedUrl = u.processedUrl;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("frames", {
        clipId,
        frameNum: u.frameNum,
        ...patch,
      });
    }
  }
}

export const _applyAlphaResult = internalMutation({
  args: {
    clipId: v.id("clips"),
    frames: v.array(frameUpdate),
  },
  handler: async (ctx, { clipId, frames }) => {
    await upsertFrames(ctx, clipId, frames);
  },
});

export const _applyKeyResult = internalMutation({
  args: {
    clipId: v.id("clips"),
    frames: v.array(frameUpdate),
  },
  handler: async (ctx, { clipId, frames }) => {
    await upsertFrames(ctx, clipId, frames);
    await ctx.db.patch(clipId, {
      state: "COMPLETE",
      updatedAt: Date.now(),
    });
  },
});
