# CorridorKey Studio — Cloud Architecture Progress

Tracks the cloud-first rewrite. The old local FastAPI backend still lives in
`corridorkey-studio-backend/` but is in "coming soon" status — CLOUD is now
the default backend mode in the web app.

## Now

- **Shipped:** Slices 1 + 2 — auth, Convex shell, extract fal app, session
  clip import + preview scrubbing
- **In flight:** nothing — between slices
- **Waiting on:** v2 mockup from the designer (right-panel locked to
  ADR-01, left-panel + chrome mostly unchanged, new color
  language to match a "real product")
- **Next slice:** Slice 3 (keying pipeline) — can start in parallel with
  the design work since it's mostly backend + API wiring

Last updated: after commit `cf81b8d` (2026-04-20).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (Turbopack) + React 19 + Tailwind v4 + Zustand |
| Auth | WorkOS AuthKit (via `@workos-inc/authkit-nextjs` v3) |
| Data | Convex (prod: `prestigious-parakeet-797`) |
| Compute | fal.ai serverless apps |
| Storage | fal CDN |
| LOCAL mode | FastAPI backend (on hold, UI shows "coming back soon") |

## Slices

### Slice 1 — Auth + Convex shell, CLOUD as default ✅
Shipped: commit `df48a03`

- Convex schema with `users` table + `customJwt` auth provider
- WorkOS AuthKit routes: `/sign-in`, `/callback`, `/api/auth/sign-out`,
  `/api/auth/token`
- `proxy.ts` at repo root (Next.js 16 uses `proxy.ts`, **not** `middleware.ts`)
- `ConvexProviderWithAuth` bridge via `useWorkOSAuth` hook
- `app/page.tsx` is a server component that gates on `withAuth()`
- `StudioShell` mirrors WorkOS identity into the `users` table on client mount
- Avatar + sign-out in top-right (`UserMenu`)
- `BackendMode.CLOUD` is default; LOCAL shown as "coming back soon"

**Gotchas discovered:**
- Next.js 16 uses `proxy.ts`, not `middleware.ts`
- WorkOS access tokens have no `aud` claim — Convex needs `type: "customJwt"`
  with `applicationID: null`
- `@fal-ai/server-proxy` latest is v1.2.1, not v1.3

### Slice 2 — Clip import + preview scrubbing ✅
Shipped: commit `7f1b6f0`

- Extract fal app: `apek/corridorkey-studio-extract` (CPU-XS machine,
  system `ffmpeg` installed via apt → pro codec support: ProRes, DNxHD,
  MXF, Cineform, etc.)
- `@fal-ai/client` + `/api/fal-proxy/route.ts` (auth-gated, server-side
  `FAL_KEY` never touches the browser)
- `useSessionClipStore` — ephemeral session clip; never persisted to
  Convex in this slice. Drop file → upload to fal CDN → call extract →
  populate store → scrub
- `SidePanel` shows a single session row with live stages (uploading /
  extracting / ready / error)
- `DualViewer` is a drop zone; renders preview frames from fal CDN
- `FrameScrubber` plays back at source fps
- Prefetch trick in `importClip`: fires `new Image()` per preview URL so
  the browser cache is warm before playback touches it

**Gotchas discovered:**
- `fal.toolkit.File.from_url` was privatized to `._from_url`; use
  `urllib.request.urlretrieve`
- `from __future__ import annotations` broke FastAPI body inference under
  fal's runtime — Pydantic model params were read as query params. Removed.
- fal apps bind to **one** machine type per app → extract (CPU) and key
  (GPU) must be separate apps

### Slice 3 — Keying pipeline ⏳ (next up)

Goal: the KEY button runs the full pipeline (GVM auto-hints → CorridorKey →
all outputs).

- New fal app: `corridorkey-studio-key` (H100, loads GVM + CorridorKey at
  warmup — ~14–22 GB VRAM, fits easily)
- Three endpoints:
  - `POST /alpha` — GVM only → alpha hint URLs
  - `POST /key` — CorridorKey only, takes alpha hints → matte / fg / comp / processed URLs
  - `POST /pipeline` — combined, returns all of the above in one call
- Convex webhook receiver (`httpAction`) for fal job completion, updates
  `frames` table
- Frontend: wire KEY button, reactive `frames` query, progress in status bar
- `DualViewer` output side renders matte / fg / comp / processed
- Timeline coverage bar populates green as frames complete
- Parameter panel wired to the locked MVP spec (ADR-01)

### Slice 4 — Projects + Save ⏳

Projects as first-class, flat hierarchy (no scenes/shots nesting).

- `projects` table: `{ userId, name, description?, createdAt, updatedAt, coverClipId? }`
- `clips.projectId` replaces `clips.userId` as parent
- `/projects` list page + `/projects/:id` studio page
- Default "Untitled" project auto-created on first sign-in
- Session clip lives in the current project; explicit save writes to that
  project's clips list
- Header project switcher (click project name → dropdown + "New Project")
- `beforeunload` warning for unsaved keyed output

### Slice 5 — Usage / cost tracking ⏳

- `usage` table: GPU-min per user per day
- Rate-limit actions that dispatch jobs
- Status bar: `SESSION $0.45 · 2.1 GPU-min · CLOUD EU-W4 · A100` (from
  fal's `x-fal-billable-units` response header)
- Display remaining free-tier quota

### Slice 6 — Polish aligned with v2 design ⏳

- Metadata overlay card (`ROLL / SCENE / CAM / LENS` from ffprobe + user)
- Codec details in clip rows
- Keyboard shortcut strip in status bar
- KEY `SCOPE` dropdown (ALL-READY / selection / single)
- Resumable uploads for multi-GB ProRes (chunked multipart, maybe)

## Architecture Decision Records

### ADR-01: Parameter panel scope — 18 IN, 13 OUT

Panel maps 1:1 to EZ-CorridorKey's real parameter surface. No new model
features for MVP.

**ALPHA HINT**
- IN: `GVM AUTO`, coverage counter, partial-hints copy, `GENERATE REMAINING`
- OUT: `MANUAL PAINT`, `IMPORT ALPHA`, `PAINT HINTS / EXPORT MASKS`

**COLOR SPACE** (per-clip)
- IN: `Linear workflow` toggle, input space `sRGB | LINEAR`
- OUT: `LOGC4`, `REC709`, `ACESCG`, working-space selector

**REFINE** (corridorkey)
- IN: `Refiner strength` slider (0.0–3.0, default 1.0)
- OUT: `Propagation`, `Temporal blend`, `Feather`, `Choke`,
  `Preserve motion blur`

**DESPILL** (green suppression)
- IN: `Strength` (0.0–1.0, default 1.0), `Auto despeckle` toggle,
  `Despeckle size` (50–2000, default 400)
- OUT: `Hue lock`, `Return balance`

**OUTPUT** (per-job)
- IN: `FG` enable + format + straight/premultiplied, `MATTE` enable + format,
  `COMP` enable + format, `PROCESSED` enable + format, `Generate comp preview`
- OUT: nothing cut

Every IN binds to an existing engine parameter. Every OUT requires new
engineering (model changes, new post-matte ops, OCIO integration, or a
VideoMaMa deploy).

### ADR-02: Projects — flat hierarchy

A project contains clips. No deeper nesting (scenes / shots / plates). The
project name is free-form and can contain slashes for display convention
(e.g. `Atrium / Plate B`) but is semantically single-level.

### ADR-03: Save model — explicit only

No real-time autosave. User clicks SAVE. Optional timer-based autosave
(e.g. every 10 min) is a future enhancement, not v1. Closing the tab
without saving discards the session clip + any local parameter tweaks.

### ADR-04: Extraction — server-side, source-video-is-authoritative

Source video is uploaded once to fal CDN. The fal extract app decodes it
with system `ffmpeg` (apt-installed) for broad codec support. It emits a
mid-frame thumbnail + one 480p JPEG per source frame to fal CDN. Keying
endpoints decode the **same source video** server-side — preview frame
indices and keying frame indices stay aligned because the same decoder
produces both.

### ADR-05: Preview frame storage — fal CDN, not IndexedDB

Preview frames live on fal CDN so sessions open on any device without
re-extraction. The `frames` Convex table is sparse — rows only for frames
that have at least one keyed output (matte, fg, comp, processed, or alpha
hint). Preview frame URLs are an array on the `clips` row (fine up to
~5k frames; longer clips would need a separate `previewFrames` table).

### ADR-06: Identity — Convex derives userId from the WorkOS JWT

No client-supplied `userId` arguments to mutations. Every mutation calls
`ctx.auth.getUserIdentity()`, gets `identity.subject` (WorkOS user id),
and resolves to the `users` row. Protects against a client forging a
different user's id to trigger billable jobs.

## File layout

```
corridorkey-studio/
  corridorkey-studio-web-app/    Next.js 16 client (CLOUD)
    app/
      api/{auth,fal-proxy}/       auth + fal forwarding routes
      callback/sign-in/            WorkOS OAuth routes
      components/                  studio UI
      lib/importClip.ts            upload + extract orchestration
      providers/                   Convex + WorkOS client bridge
      stores/                      Zustand (session, settings, clips, queue)
      StudioShell.tsx              authenticated client shell
      page.tsx                     server-side auth gate
    convex/                        schema, auth.config, users, clips
    proxy.ts                       WorkOS AuthKit proxy (Next.js 16)
  corridorkey-studio-fal-app/    fal serverless extract app (deployed)
    extract_app.py                 preview extraction endpoint
  corridorkey-studio-backend/    old local FastAPI backend (frozen)
  DESIGN_CONCEPT.md              design-brief for the v2 mock
  PROGRESS.md                    this file
```

## Current deployments

- Convex prod: `https://prestigious-parakeet-797.convex.cloud`
  (HTTP actions: `https://prestigious-parakeet-797.convex.site`)
- fal extract app: `apek/corridorkey-studio-extract`

## Environment variables

See `corridorkey-studio-web-app/.env.local.example` for the full list.

Values that also need to be set on Convex prod via
`npx convex env set <NAME> <VALUE> --prod`:
- `WORKOS_ISSUER`
- `WORKOS_CLIENT_ID`
- `FAL_KEY`
