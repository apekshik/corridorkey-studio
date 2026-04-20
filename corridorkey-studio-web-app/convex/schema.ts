import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  })
    .index("by_workos_id", ["workosId"])
    .index("by_email", ["email"]),

  // A clip represents a source video a user has saved. Sessions that haven't
  // been saved never hit this table — they live entirely in the browser.
  //
  // `previewFrameUrls` is an array of fal CDN URLs for 480p preview JPEGs,
  // one per source frame. Populated once by the extract fal app. Keying
  // outputs go to the `frames` table, not here.
  clips: defineTable({
    userId: v.id("users"),
    name: v.string(),
    state: v.union(
      v.literal("EXTRACTING"),
      v.literal("RAW"),
      v.literal("MASKED"),
      v.literal("READY"),
      v.literal("COMPLETE"),
      v.literal("ERROR")
    ),

    // fal CDN — the source video upload
    sourceUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),

    // Populated by the fal extract app
    previewFrameUrls: v.optional(v.array(v.string())),
    frameCount: v.optional(v.number()),
    fps: v.optional(v.number()),
    durationS: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    codec: v.optional(v.string()),

    // UI state persisted with the clip
    currentFrame: v.number(),
    inPoint: v.optional(v.number()),
    outPoint: v.optional(v.number()),

    warnings: v.array(v.string()),
    errorMessage: v.optional(v.string()),

    // fal.queue request id for webhook correlation
    falExtractRequestId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_fal_extract_request", ["falExtractRequestId"]),

  // Output frames from keying. Sparse — rows only exist for frames that
  // have at least one rendered layer. A frame with only an alpha hint and
  // no matte is still a row here.
  frames: defineTable({
    clipId: v.id("clips"),
    frameNum: v.number(),

    // Outputs — populated as keying / alpha generation completes
    alphaHintUrl: v.optional(v.string()),   // from GVM or VideoMaMa
    matteUrl: v.optional(v.string()),        // from CorridorKey
    fgUrl: v.optional(v.string()),
    compUrl: v.optional(v.string()),
    processedUrl: v.optional(v.string()),   // linear premul RGBA, deliverable
  })
    .index("by_clip", ["clipId"])
    .index("by_clip_num", ["clipId", "frameNum"]),
});
