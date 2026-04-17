import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

/**
 * Upsert the Convex user row that mirrors a WorkOS identity.
 * Called once on client mount after sign-in.
 *
 * Requires an authenticated caller — derives workosId from the JWT `sub`
 * claim rather than trusting a client-supplied id.
 */
export const getOrCreate = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { email, name, profileImageUrl }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const workosId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        name,
        profileImageUrl,
        lastLoginAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      workosId,
      email,
      name,
      profileImageUrl,
      createdAt: now,
      lastLoginAt: now,
    });
  },
});

/** Current authenticated user, or null if not signed in. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    return user;
  },
});

/** Internal: resolve a workosId to a Convex user document. */
export const _getByWorkosId = internalQuery({
  args: { workosId: v.string() },
  handler: async (ctx, { workosId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();
  },
});
