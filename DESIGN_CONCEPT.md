# CorridorKey Studio — Design Concept

A design brief for a cloud-first, AI-assisted green-screen keying tool built for working VFX artists and compositors. This document is intended as creative input for mockup / UI design tools. It describes *what the product is*, *who it's for*, *what it must feel like*, and *which jobs it must do well* — not a copy of the current UI.

---

## 1. One-line positioning

> **CorridorKey Studio is a cloud-first, AI-native keying workstation that turns rough green-screen footage into production-grade alpha mattes — without the artist ever touching a GPU.**

---

## 2. The core insight

Professional keying has always been gated by two scarce resources:

1. **Time** — manual rotoscoping, garbage matting, despill, and cleanup on long shots.
2. **Compute** — modern matte-generation networks (CorridorKey, VideoMaMa, GVM, SAM-style segmenters) are heavy. A single artist with a laptop cannot run them on 4K footage in any reasonable time, and renting workstation GPUs runs into the thousands.

The current generation of tools solves only the first. CorridorKey Studio solves both by treating **on-demand cloud GPU** as the default runtime, not an export step. The artist uploads footage, paints a few hints, and the cloud does the heavy lifting. The local desktop is retained as a side-track for offline / air-gapped work, but it is not where the product lives.

This is the central design pivot: **the app is an interface to elastic GPU, not a local renderer with a cloud option.**

---

## 3. Who this is for

Design the UI assuming the primary user is one of:

- **Compositors and keyers** at boutique VFX houses (3–30 person shops) who do not have a render farm and currently hand-roll keys in Nuke / Fusion / After Effects.
- **Indie filmmakers and virtual-production operators** shooting on LED volumes with green-screen wings who need fast, "good enough" alpha to previz before finishing.
- **YouTubers, streamers, and content studios** moving past chroma key plugins but unwilling to pay for a colorist.
- **ML-curious VFX supervisors** who want state-of-the-art networks (CorridorKey, VideoMaMa) in a tool they can actually put a junior artist in front of.

These users share three traits that the design must respect:

1. They are **fluent in node graphs, color pipelines, and EXR** — do not hide technical controls behind "magic."
2. They are **time-poor and shot-poor** — they would rather key 40 clips in a batch than fiddle with one.
3. They **do not want to become cloud engineers** — GPU provisioning, queueing, and billing must be invisible.

---

## 4. What makes keying software actually useful to pros

A credible professional keyer — the set of capabilities that separates a toy from a tool — must deliver on all of the following. Use this as the feature rubric for the mockups.

### 4.1 Perceptual quality
- **Hair, motion blur, and translucency** must survive. A flat hard-edge matte is not acceptable. Design the UI around the assumption that the output is production-quality, not a plugin preview.
- **Linear vs. sRGB** color-space handling must be explicit and switchable per clip. Pros will refuse a tool that guesses.
- **Despill**, **despeckle**, and **edge refinement** are first-class parameters, not hidden dropdowns.

### 4.2 Deterministic, auditable output
- Same input + same parameters must produce the same matte. Period.
- Every job has a **job ID, parameter snapshot, and GPU identity** attached. A supervisor must be able to re-run a shot six months later and get the same result.
- The queue is a ledger — jobs are canceled, not deleted; parameters are versioned, not overwritten.

### 4.3 Channel-level output
Professionals do not consume "the final video." They consume layers. The tool must export any combination of:

- **FG** — premultiplied foreground
- **MATTE** — the alpha channel alone
- **COMP** — the composite over a chosen plate or checkerboard
- **PROCESSED** — the full RGBA result post-despill

…each selectable as **EXR (linear, float, 16/32-bit)** or **PNG (sRGB, 8-bit)**. No other formats are table stakes. Output format is a color-pipeline decision, not a file-size decision, and the UI should treat it that way.

### 4.4 Batch as the default mental model
- "Key selected clip" is the tutorial path. The real workflow is "key all ready" and "key everything, including generating hints for clips that don't have them yet."
- The UI must make **one-clip, many-clips, and whole-project** the same gesture at different scopes — a single `KEY` button with a dropdown for scope (selected / all-ready / all-pipeline).
- A visible **queue** with per-job progress, cancel, and frame counter is non-negotiable.

### 4.5 Scrub-first review, not playback-first
Keyers review frame-by-frame, not in real time. The viewer should be a **dual A/B** (input vs. output) with instant switching between output layers (ALPHA / FG / MATTE / COMP / PROCESSED). Playback matters, but scrub and single-frame step are the hot path.

### 4.6 Trust signals
- **Clip state** (EXTRACTING, RAW, MASKED, READY, COMPLETE, ERROR) is shown at every surface — media list, thumbnail, viewer header, status bar. A keyer's eyes should never have to hunt for "is this one done."
- **Alpha-hint coverage** is exposed numerically ("42 / 120 frames hinted") and surfaced as a warning before running a partial key. Silent partial processing is the fastest way to lose a pro user's trust.
- **Warnings** (resolution mismatch, color-space guess, missing hints) live on the clip row, not buried in logs.

---

## 5. The cloud-first architecture, as a UX principle

The cloud is not a backend detail — it shapes every interaction. Design the mockups around these consequences:

### 5.1 Upload is the new "import"
- Drag-and-drop a video file → the client immediately begins a **resumable upload** to object storage while showing a local thumbnail and scrub strip generated from the first MB or two.
- The clip appears in the media list in **EXTRACTING** state within a second of the drop, with a progress bar for both upload and server-side decode.
- The artist can queue jobs **before** upload finishes — jobs wait for the clip to reach READY. This is critical: artists do not wait on networks, networks wait on artists.

### 5.2 GPU is invisible, but accounted for
- There is **no "select GPU" dialog**. Ever.
- There is a **live cost counter** somewhere unobtrusive (status bar): *"$0.42 this session · 2 GPU-minutes"*. Pros do not mind paying; they mind being surprised.
- The queue shows **estimated completion time**, not "processing…". If the cloud is backed by spot / surplus capacity, expose that as "surge pricing off — jobs may take longer" rather than hiding it.

### 5.3 Live results, streaming in
- As the cloud GPU produces frames, the viewer **streams them in** — the artist can scrub the first 40 keyed frames while frame 200 is still being computed. This is the single most important affordance the cloud enables over a local tool. Do not waste it by showing a spinner until the job is 100% done.
- **STOP** is a first-class button. Cloud compute means artists will speculatively start jobs; canceling must be instant, visible, and refund any per-frame cost.

### 5.4 Session continuity
- Close the tab, reopen it tomorrow, and every clip, every matte, every parameter is exactly where it was. This is a cloud-native app; local-only state is a bug.
- Sessions are per-**project**, not per-browser. Signing in on another machine brings the project with you.

### 5.5 Local mode is the exception path
- A **LOCAL backend toggle** exists for offline / air-gapped / IP-sensitive work. It is a setting, not a co-equal product. The mockups should make CLOUD feel like home and LOCAL feel like a deliberate choice.

---

## 6. The alpha-hint model (why this tool exists at all)

CorridorKey's refinement network needs a rough mask — an **alpha hint** — to produce a clean key. Two ways to get one:

- **GVM AUTO** — one-click automatic segmentation. Best for clean green-screen shots.
- **VIDEOMAMA** — artist paints foreground (green) and background (red) strokes on a handful of keyframes; the model interpolates between them. Best for tricky shots, transparent objects, fine hair, or partial green.

The UI must communicate this two-tier model clearly:

1. **Auto is the default**, offered the moment a clip reaches RAW.
2. **Manual** is one click away, not three, and feels like "I'm taking over" rather than "I'm in expert mode."
3. **Partial hints** are explicitly surfaced — if an artist has hinted 40 of 120 frames, the tool should warn before keying, and offer to "generate remaining" as a one-click escalation.

This is the single most important interaction in the product. Every mockup should make the pipeline **RAW → hint → KEY → done** feel like three deliberate gestures, not a mystery box.

---

## 7. Layout principles

These are the layout invariants. The visual style can change; these cannot.

1. **The viewer is the center of the universe.** It is always the largest surface. Everything else (media list, parameters, queue) is chrome that folds away.
2. **A/B input-vs-output is always one keystroke away.** Split view is default; single view for deep inspection.
3. **The parameter panel is dense and compact.** Artists read all of it at a glance — no tabs, no accordions, no wizards. A single scrollable column of grouped sliders, toggles, and numeric inputs.
4. **Media and queue share a panel, toggled by tabs.** They are rarely needed at the same time, but when one is needed, it is needed instantly.
5. **The top bar is action-oriented**, not navigational. KEY and STOP live there. Settings, user, and about live at the edges.
6. **The status bar tells the truth about the system**: connection state, active GPU (or "cloud"), cost so far, shortcut hints.
7. **Dark UI, desaturated chrome, one accent color.** Artists stare at mattes for hours — the UI must not compete with the content.

---

## 8. Tone & personality

- **Technical, terse, unfussy.** Labels are uppercase, tracked-out, short. "KEY SELECTED," not "Process the currently selected clip."
- **No consumer hand-holding.** Empty states say "NO CLIPS" not "Welcome! Let's get started."
- **No emoji, no marketing language, no cartoon illustrations.** This is a DCC tool in the lineage of Nuke, DaVinci Resolve, and Flame — it earns trust by looking like it was built by people who have done this work.
- **Warnings are yellow, errors are red, success is green — and they're small.** Pros do not need a banner; they need a colored dot.
- **Micro-copy is informational, not apologetic.** "No alpha hints" is a statement, not a problem.

---

## 9. Interaction model, at a glance

A single-file pipeline from empty project to exported mattes should read:

1. **Sign in** → project restored from cloud.
2. **Drop videos** → they upload + decode in the background, appearing as thumbnails with live state.
3. **(Optional) paint hints** on tricky shots — green/red brushes on a few keyframes.
4. **Press KEY** — scoped to selected, all-ready, or everything (auto-generating hints for those that need it).
5. **Watch the queue fill** as cloud GPUs pick up jobs. Scrub the viewer to preview frames as they stream back.
6. **Flip through output layers** (ALPHA / FG / MATTE / COMP / PROCESSED) to approve.
7. **Configure exports** — any combination of FG / MATTE / COMP / PROCESSED, each as EXR or PNG.
8. **Export** — cloud renders the final files, delivers a download or direct hand-off to S3 / Dropbox / a delivery endpoint.

Steps 3 and 4 are the only places the artist's creative judgment is required. Everything else must feel automatic.

---

## 10. What to emphasize in mockups

For the downstream design tool, please stress these motifs visually:

- **The dual viewer with crisp layer tabs** — this is the product's signature screen.
- **The media list with live-state color bars on each thumbnail** — orange/yellow/green progression tells the story of a project at a glance.
- **The queue as a vertical ledger** — not a modal, not a toast, a permanent column of jobs with progress bars and cancel buttons.
- **The KEY button as a split-action control** — primary click does the obvious thing, dropdown exposes batch scope.
- **A status bar that surfaces cloud state** — connected GPU region, session cost, shortcut hints.
- **A parameter panel that looks like a mixing console** — grouped, dense, every control visible.

---

## 11. Non-goals

To keep the mockups focused, these are explicitly out of scope:

- **Editing / timeline / NLE functionality.** This is not a video editor.
- **Tracking, paint, or rotoscoping beyond the alpha-hint brush.** Other tools do that better.
- **Final-delivery color grading.** The tool outputs clean, linear mattes and foregrounds for downstream comp.
- **Real-time playback at 24 fps+.** Scrubbing and frame-step are sufficient.
- **A node graph.** CorridorKey is a single-purpose tool. The power is in the model and the cloud, not in user-configurable DAGs.

---

## 12. Success criteria for the design

A mockup succeeds if a working compositor, shown it cold, can answer all of:

- "Where do I drop a video?"
- "How do I key one clip?"
- "How do I key forty clips?"
- "How do I see just the alpha?"
- "Where do my EXRs come out?"
- "How much is this costing me?"

…in under thirty seconds, without reading a tutorial.

That is the bar.
