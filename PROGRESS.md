# CorridorKey Studio — Cloud Architecture Progress

Tracks the cloud-first rewrite. The old local FastAPI backend still lives in
`corridorkey-studio-backend/` but is in "coming soon" status — CLOUD is now
the default backend mode in the web app.

## Now

- **Shipped:** Slices 1 + 2 + 3 + 4 — auth, Convex shell, extract fal app,
  session clip import + preview scrubbing, v2 design + projects shell,
  keying pipeline end-to-end (stub mode)
- **In flight:** Slice 4.5 — swap stub keying for real CorridorKey + GVM
  inference on GPU-A100
- **Waiting on:** nothing
- **Next slice:** Slice 5 (Hint Painter modal + VideoMaMa + usage tracking)

Last updated: 2026-05-19, end of slice 4 / start of 4.5.

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

### Slice 3 — v2 design + projects shell ✅

Goal: reskin the app to the v2 prototype (`DESIGN_MOCK.html`) and stand up
the projects model so slice 4 has somewhere to attach frames. No keying
work in this slice.

**Design system**
- Token system from the prototype: `--bg-0..4`, `--ink-0..4`, `--rule`,
  `--accent`, `--serif` = Instrument Serif, `--mono` = JetBrains Mono
- Shipped chrome: `accent=green, chrome=hair, density=compact`, pinned
  in `globals.css` + `<html data-*>`. The prototype's live Tweaks panel
  was a design-only playground; we do not ship a runtime selector.

**Projects (stub-level CRUD, wired up but minimal)**
- `projects` table: `{ userId, name, createdAt, updatedAt, coverClipId? }`
  — `coverClipId` reserved, no picker UI in v1
- `clips.projectId` replaces `clips.userId` as parent; `clips.userId`
  kept temporarily to ease migration
- Auto-created "Untitled" project per user on first sign-in
- `projects.rename` + `projects.create` mutations; no delete in v1
- `/projects/:id` studio page; `/` redirects to the default project on
  sign-in. No standalone `/projects` list page in v1 — the TopBar
  dropdown is the canonical way to switch projects. A "Manage all" page
  is slice 5+
- Project switcher in TopBar: serif-italic name + caret → dropdown with
  search + recent projects + `New Project` action. Full CRUD (delete,
  cover picker, manage-all page) is slice 5+

**Chrome rewrites** (pixel-match the prototype)
- TopBar: brand mark + serif wordmark, project switcher, meta strip
  (clip count · total time · saved/unsaved), KEYED-FRAMES chip
  (repurposed from HINTS — see ADR-07), STOP, KEY split-button, icon
  buttons, user chip
- SidePanel: Media / Queue tabs, state color bars, TC overlay,
  warning dot, upload/extract progress row, bottom dropzone (cloud
  imports tagged SOON)
- DualViewer: A│B / A─B / SINGLE / HINT PAINTER (SOON); layer tabs
  Alpha / FG / Matte / Comp / Processed with mini swatches + keys 1–5;
  stream-overlay pending tile; viewer tools (fit / 100% / ruler /
  checker)
- FrameScrubber: transport, processed-region tint, keyed-frame coverage
  ticks, yellow keying-edge marker, playhead caret
- ParameterPanel: groups Alpha Hint (coverage widget + Generate
  Remaining) → Color Space → Refine → Despill → Output. Matches
  ADR-01 exactly
- StatusBar: Cloud (stub `CLOUD`, no region), Queue, Stream pulse,
  Session cost (stubbed 0 until slice 5), Surge chip, keyboard
  shortcut strip, Backend chip

**State changes**
- Clip state enum adds `UPLOADING` (pre-extract) and `KEYING` (between
  READY and COMPLETE). `NEEDS_TRANSCODE` stays on the `warnings` array
- Any param / settings change marks the project dirty; Save button +
  ⌘S flushes to Convex and stamps "saved HH:MM" in the meta strip

**Deferred to later slices (already tagged SOON in the prototype)**
- Hint Painter modal + VideoMaMa propagation (slice 5+)
- S3 / GCS / Dropbox / Frame.io imports (post-v1)
- Real surge / spot pricing indicator, real region/GPU badge (post-v1)
- Project delete, cover picker, `/projects` "Manage all" page (slice 5+)
- Slate EXIF overlay (ROLL / SCENE / CAM / COLOR / LENS) — slice 6 polish

### Slice 4 — Keying pipeline ✅

Goal: the KEY button runs the full pipeline (GVM auto-hints → CorridorKey
→ all outputs), webhook-driven end to end.

Shipped: commit `cf7b980`. Stub mode (green-threshold) for the inference
side — real models land in Slice 4.5.

- New fal app: `apek/corridorkey-studio-key` (M tier, CPU, stub-mode
  green-threshold mattes; bumps to GPU-A100 in 4.5)
- Three endpoints, all dispatched via `fal.queue.submit` with
  `webhook_url`, **no** `fal.subscribe`:
  - `POST /alpha` — GVM → alpha hint URLs
  - `POST /key` — CorridorKey (takes alpha hints) → matte / fg / comp /
    processed URLs
  - `POST /pipeline` — chains both; emits an alpha-done webhook mid-run
- Convex `httpAction` receivers at `/fal-webhook/alpha` + `/fal-webhook/key`,
  bulk-insert `frames` rows. HMAC signature verification scaffolded but
  bypassed for now (Slice 4 follow-up: real Ed25519 verification, task #19)
- Convex `keying.dispatch` action — the only place that holds `FAL_KEY`;
  `clips.saveAndDispatchKey` chains save + dispatch in one call
- Frontend: reactive `frames.listByClip` feeds DualViewer layer outputs,
  FrameScrubber processed tint, TopBar KEYED-FRAMES chip
- DualViewer preloads every per-layer URL on layer/clip change so playback
  doesn't lag on full-res output PNGs
- ClipRow click loads a saved Convex clip into the viewer (active highlight)
- STOP calls `fal.queue.cancel`
- Source frames decoded as JPEG (not PNG) so tmpfs stays in budget on the
  M-tier container

### Slice 4.5 — Real CorridorKey + GVM inference ⏳

Goal: replace the stub matte path with the actual GreenFormer + GVM
engines from the CorridorKey monorepo, running on GPU-A100.

- Dockerfile rewrite: `nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04` base
  + git clone of `https://github.com/apekshik/CorridorKey.git` pinned to
  an explicit SHA + torch 2.8 cu121 + upstream pyproject deps
- `KeyingApp.setup()` downloads weights to fal's persistent `/data` volume
  on first cold start: `nikopueringer/CorridorKey_v1.0` (~400 MB) +
  `geyongtao/gvm` (~80 GB). Subsequent cold starts are weight-cache hits
- Engines instantiated once in `setup()` and stored on `self.ck_engine` /
  `self.gvm`; per-request latency = pure inference
- `_run_gvm` / `_run_corridorkey` converted to methods using the loaded
  engines; stub helpers removed entirely
- `machine_type = "GPU-A100"`, `keep_alive = 600`
- Webhook contract, frames-table shape, frontend wiring — unchanged from
  Slice 4

### Slice 5 — Hint Painter + Usage / cost tracking ⏳

- Hint Painter modal wired to a VideoMaMa fal app (propagation, keyframes)
- `usage` table: GPU-min per user per day
- Rate-limit actions that dispatch jobs
- Status bar: real `CLOUD EU-W4 · A100` + `SESSION $0.45 · 2.1 GPU-min`
  (from fal's `x-fal-billable-units` response header)
- Project CRUD polish: delete, cover picker, `/projects` "Manage all"
  page
- Display remaining free-tier quota

### Slice 6 — Polish aligned with v2 design ⏳

- Slate EXIF overlay (`ROLL / SCENE / CAM / COLOR / LENS` from ffprobe +
  user-entered sidecar)
- Codec details in clip rows
- Resumable uploads for multi-GB ProRes (chunked multipart)
- Cloud import integrations (S3 / GCS / Dropbox / Frame.io)

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

### ADR-07: KEYED-FRAMES chip replaces HINTS chip for v1

The v2 prototype shows a `HINTS 42 / 120` chip in the TopBar that assumes
VideoMaMa manual paint is shipped. Since Hint Painter is deferred to
slice 5, the chip is repurposed to show **keyed-frame coverage** on the
currently-selected clip: `KEYED N / M`. Once frames have been
processed by the key fal app, `N` increments; at N=M the chip turns
green. When Hint Painter ships, a separate HINTS chip or a toggle can
be reintroduced.

### ADR-08: Keying pipeline — webhook only, no `fal.subscribe`

All keying jobs are dispatched with `fal.queue.submit({ webhook_url })`
pointing at Convex `httpAction` receivers. The client never blocks on
fal or polls status. This matches DESIGN_CONCEPT §5.3 (live streaming
results): the UI subscribes reactively to the `frames` table, and the
webhook is the only writer. Separate `/alpha` and `/key` endpoints
exist (on top of the combined `/pipeline`) so that a failure is
attributable to one stage.

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
  DESIGN_MOCK.html               v2 prototype (pixel-match reference)
  PROGRESS.md                    this file
```

## Current deployments

- Convex prod: `https://prestigious-parakeet-797.convex.cloud`
  (HTTP actions: `https://prestigious-parakeet-797.convex.site`)
- fal extract app: `apek/corridorkey-studio-extract`
- fal keying app: `apek/corridorkey-studio-key`

## Environment variables

See `corridorkey-studio-web-app/.env.local.example` for the full list.

Values that also need to be set on Convex prod via
`npx convex env set <NAME> <VALUE> --prod`:
- `WORKOS_ISSUER`
- `WORKOS_CLIENT_ID`
- `FAL_KEY`
