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

/**
 * Idempotent — returns the newest project if any exists, otherwise
 * creates an "Untitled" one. Called after sign-in by the StudioShell.
 */
export const getOrCreateDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("projects", {
      userId: user._id,
      name: "Untitled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

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
