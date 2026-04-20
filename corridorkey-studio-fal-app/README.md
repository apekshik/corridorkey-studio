# CorridorKey Studio — fal extract app

Server-side fallback for preview frame extraction. Runs when the browser
can't decode the source codec client-side (ProRes, DNxHD, MXF, Cineform,
etc.).

## Endpoint

`POST /` — `ExtractInput` → `ExtractOutput` (see `extract_app.py`)

Given a video URL, returns metadata + a thumbnail URL + an ordered list of
low-res JPEG preview frame URLs on fal CDN.

## Codec support

Matches EZ-CorridorKey — decodes whatever the bundled system ffmpeg
supports. That's every common pro format except vendor-RAW (R3D, BRAW,
ARRI RAW), which need vendor SDKs.

## Deploy

```bash
cd corridorkey-studio-fal-app
fal deploy extract_app.py::ExtractPreviewApp
```

## Why ffmpeg via apt instead of OpenCV's bundled build

OpenCV's bundled ffmpeg strips some pro codec decoders to keep the wheel
small. The apt `ffmpeg` package is the full build, matches what EZ-CK's
Docker image uses.
