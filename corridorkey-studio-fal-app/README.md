# CorridorKey Studio — fal apps

Two serverless apps share this directory:

- `extract_app.py` — preview frame extraction (Slice 2)
- `keying_app.py` — keying pipeline (Slice 4)

## Extract app

Server-side fallback for preview frame extraction. Runs when the browser
can't decode the source codec client-side (ProRes, DNxHD, MXF, Cineform,
etc.).

**Endpoint** — `POST /` (`ExtractInput` → `ExtractOutput`). Given a video
URL, returns metadata + a thumbnail URL + an ordered list of low-res JPEG
preview frame URLs on fal CDN.

**Codec support** — matches EZ-CorridorKey, decodes whatever the bundled
system ffmpeg supports. Every common pro format except vendor-RAW (R3D,
BRAW, ARRI RAW), which need vendor SDKs.

**Deploy**

```bash
cd corridorkey-studio-fal-app
fal deploy extract_app.py::ExtractPreviewApp
```

## Keying app

Three webhook-driven endpoints that read a source video and produce alpha
hints + mattes + comps. Convex `keying.dispatch` is the only caller; all
results flow back via fal webhook to Convex `/fal-webhook/{alpha,key}`.

- `POST /alpha` — GVM only → alpha hint URLs
- `POST /key` — CorridorKey only (takes alpha hints) → matte/fg/comp/processed URLs
- `POST /pipeline` — chains both; emits an interim alpha-done webhook so the
  UI can stream hints before mattes land

**Deploy**

```bash
cd corridorkey-studio-fal-app
fal deploy keying_app.py::KeyingApp
```

Copy the resulting app id (e.g. `apek/corridorkey-studio-key`) into both:

- `.env.local` → `NEXT_PUBLIC_FAL_KEYING_APP`
- Convex env → `npx convex env set FAL_KEYING_APP_ID apek/corridorkey-studio-key --prod`

Also set the webhook signing secret on both sides:

```bash
# Convex side
npx convex env set FAL_WEBHOOK_SECRET "$(openssl rand -hex 32)" --prod

# fal side (same value)
fal secrets set FAL_WEBHOOK_SECRET=<the same value>
```

**Stub mode** — until the CorridorKey + GVM repos are bundled into the
container, the app falls back to green-threshold mattes. This is enough
to validate the webhook plumbing end-to-end. See the `_dockerfile`
comments in `keying_app.py` for how to enable real inference (and bump
`machine_type` to `GPU-H100`).

## Why ffmpeg via apt instead of OpenCV's bundled build

OpenCV's bundled ffmpeg strips some pro codec decoders to keep the wheel
small. The apt `ffmpeg` package is the full build, matches what EZ-CK's
Docker image uses.
