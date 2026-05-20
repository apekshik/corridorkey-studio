import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Projects are the stable parent for clips. v1 scope (slice 3):
 *   - auto-create "Untitled" on first sign-in
 *   - list / get / rename / create
 *   - no delete, no cover picker (slice 5+)
 */

async function requireUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
    .first();
  if (!user) throw new Error("User row not found — call users.getOrCreate first");
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
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();
    if (!user) return null;
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== user._id) return null;
    return project;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    const trimmed = name.trim() || "Untitled";
    const now = Date.now();
    return await ctx.db.insert("projects", {
      userId: user._id,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, { projectId, name }) => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Project name cannot be empty");
    await ctx.db.patch(projectId, {
      name: trimmed,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cascade-delete a project: every clip in the project, every frame of
 * every clip, and finally the project row itself. v1 scale is small
 * (single user, a handful of projects, few hundred frames each) so we
 * can collect() and delete() inline — no pagination needed.
 *
 * Ownership is verified via requireUser; a foreign projectId throws.
 */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }

    const clips = await ctx.db
      .query("clips")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const clip of clips) {
      const frames = await ctx.db
        .query("frames")
        .withIndex("by_clip", (q) => q.eq("clipId", clip._id))
        .collect();
      for (const frame of frames) {
        await ctx.db.delete(frame._id);
      }
      await ctx.db.delete(clip._id);
    }

    await ctx.db.delete(projectId);
  },
});

/**
 * Persist parameter settings for the project (⌘S save). Accepts the full
 * ADR-01 parameter surface. Returns the `lastSavedAt` timestamp so the
 * UI can render "saved HH:MM" without racing the reactive query.
 */
export const saveSettings = mutation({
  args: {
    projectId: v.id("projects"),
    inferenceParams: v.object({
      inputIsLinear: v.boolean(),
      despillStrength: v.number(),
      autoDespeckle: v.boolean(),
      despeckleSize: v.number(),
      refinerScale: v.number(),
    }),
    outputConfig: v.object({
      fgEnabled: v.boolean(),
      fgFormat: v.union(v.literal("exr"), v.literal("png")),
      fgPremult: v.union(v.literal("premult"), v.literal("straight")),
      matteEnabled: v.boolean(),
      matteFormat: v.union(v.literal("exr"), v.literal("png")),
      compEnabled: v.boolean(),
      compFormat: v.union(v.literal("exr"), v.literal("png")),
      processedEnabled: v.boolean(),
      processedFormat: v.union(v.literal("exr"), v.literal("png")),
      generateCompPreview: v.boolean(),
    }),
  },
  handler: async (ctx, { projectId, inferenceParams, outputConfig }) => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found or access denied");
    }
    const now = Date.now();
    await ctx.db.patch(projectId, {
      settings: {
        inferenceParams,
        outputConfig,
        lastSavedAt: now,
      },
      updatedAt: now,
    });
    return now;
  },
});
