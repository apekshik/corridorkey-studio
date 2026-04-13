# CorridorKey Studio

A web interface for AI-powered green screen keying. Import your footage, generate alpha hints, and produce production-quality mattes — all from your browser.

CorridorKey Studio wraps the [CorridorKey](https://github.com/CorridorDigital/CorridorKey) neural network keyer in a clean, intuitive UI so you can key green screen footage on your own machine without touching a command line.

## How it works

1. **Import** your green screen video
2. **Generate an alpha hint** — a rough foreground mask the AI uses as a starting point
   - **GVM Auto** — one-click automatic segmentation, works great for standard shots
   - **VideoMaMa** — paint a few brush strokes on keyframes for tricky footage
3. **Key the clip** — CorridorKey refines the hint into a production matte with clean hair, motion blur, and translucency
4. **Export** — FG, Matte, Comp, or full RGBA in EXR or PNG

## Features

- **Dual viewer** — compare input and output side-by-side or in single view
- **Frame scrubber** — timeline with coverage visualization showing what's been keyed
- **Parameter tuning** — despill, despeckle, refiner, color space, live preview
- **Media panel** — manage multiple clips, filter by state, track progress
- **Job queue** — batch process clips with real-time progress
- **Local or cloud** — run on your own GPU or sign in to key footage for free on cloud GPUs

## Stack

- **Frontend**: Next.js, React, Tailwind CSS, Zustand
- **Backend** (coming soon): FastAPI wrapping CorridorKey, GVM, and VideoMaMa models
- **Cloud option** (coming soon): fal.ai serverless GPU inference — free to use

## Getting started

```bash
cd corridorkey-studio-web-app
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The UI runs with mock data until the backend is connected.

## Project structure

```
corridorkey-studio/
  corridorkey-studio-web-app/   # Next.js frontend
  corridorkey-studio-backend/   # FastAPI backend (coming soon)
```

## License

TBD
