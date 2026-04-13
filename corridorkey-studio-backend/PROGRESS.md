# CorridorKey Studio Backend — Progress

## What's Done

### Phase 1: Health + CLI (get the green dot)
- `cli.py` — Click CLI with `corridorkey-studio serve` command, Rich startup banner
- `app.py` — FastAPI app factory with CORS, lifespan hooks
- `config.py` — Settings (host, port, data_dir, cors_origins) with env var overrides
- `models/enums.py` — All enums matching TypeScript types (ClipState, JobType, JobStatus, etc.)
- `models/schemas.py` — Pydantic models with camelCase JSON output (GPUInfo, ClipEntry, GPUJob, InferenceParams, OutputConfig, etc.)
- `services/gpu.py` — GPU detection: torch.cuda → nvidia-smi → fallback "No GPU"
- `routers/health.py` — `GET /health` returning GPU info, version, availability
- `utils/errors.py` — Exception hierarchy (CKError, GPUUnavailableError, ClipNotFoundError, etc.) + FastAPI handler

**Verified**: Server starts, web app green dot lights up.

### Phase 2: Clip Management
- `utils/video.py` — Frame extraction + thumbnails via cv2.VideoCapture
- `utils/image_io.py` — PNG/EXR read/write helpers
- `utils/color.py` — sRGB↔linear conversion, despill, matte cleanup (ported from EZ-CK)
- `services/frame_store.py` — Disk layout management (`~/.corridorkey-studio/projects/{id}/frames/...`), frame lookup, coverage scanning
- `services/clip_manager.py` — Clip CRUD, state machine (EXTRACTING→RAW→MASKED→READY→COMPLETE), JSON persistence
- `routers/clips.py` — `GET /clips`, `POST /clips/import`, `PATCH /clips/{id}`, `DELETE /clips/{id}`, `GET /clips/{id}/coverage`
- `routers/frames.py` — `GET /clips/{id}/frames/{num}?layer=input`, `GET /clips/{id}/thumbnail`

**Verified**: Upload video → frames extracted to disk → thumbnails served → clip list works.

### Phase 3: Job Queue + SSE
- `services/job_queue.py` — Async single-worker queue, cancellation, SSE broadcast to subscribers
- `routers/jobs.py` — `GET /jobs`, `POST /jobs`, `DELETE /jobs/{id}`, `GET /jobs/events` (SSE stream)
- Refactored clip import to be non-blocking: returns EXTRACTING immediately, extraction runs as VIDEO_EXTRACT job

**Verified**: Import → extraction job queued → SSE streams progress → clip transitions to RAW.

### Phase 4: Model Integration (stubs)
- `services/model_manager.py` — GPU lock, one-model-in-VRAM enforcement, model eviction (unload → gc.collect → empty_cache → load)
- `inference/base.py` — Abstract ModelService interface
- `inference/corridorkey.py` — Stub keyer: green threshold → matte/fg/comp/processed
- `inference/gvm.py` — Stub auto alpha hint generator
- `inference/videomama.py` — Stub artist-guided alpha hint generator
- Job queue wired to dispatch GVM_ALPHA, INFERENCE, VIDEOMAMA_ALPHA, PREVIEW jobs

**Verified**: Full stub pipeline: import → extract (48 frames) → GVM alpha (48 hints) → inference (48 matte/fg/comp) → clip COMPLETE. All output layers served via HTTP.

---

## What's Left

### Phase 5: Real Model Wiring (needs GPU machine)
Replace stubs with real CorridorKey model wrappers. **Wire directly to the CorridorKey repo** (`/CorridorKey/CorridorKeyModule/`), NOT EZ-CorridorKey. EZ-CK was just our architecture reference — CorridorKey is the source of truth with the latest optimizations (float16, torch.compile, MLX tiling).

**CorridorKey keyer** (`inference/corridorkey.py`):
- [ ] Import `CorridorKeyEngine` from `CorridorKey/CorridorKeyModule/inference_engine.py`
- [ ] Use `backend.py`'s `_discover_checkpoint()` + `resolve_backend()` for weight loading
- [ ] Auto-download from HuggingFace: `nikopueringer/CorridorKey_v1.0` → `~/.corridorkey-studio/weights/`
- [ ] Map our `InferenceParams` to `engine.process_frame()` kwargs:
  - `refiner_scale`, `input_is_linear`, `despill_strength`
  - `auto_despeckle`, `despeckle_size`, `despeckle_dilation`, `despeckle_blur`
- [ ] Configure: `model_precision=torch.float16`, `mixed_precision=True`, `img_size=2048`
- [ ] Handle device selection: engine already does CUDA → MPS → CPU
- [ ] Output: `{'alpha': [H,W,1], 'fg': [H,W,3]}` → write matte/fg/comp/processed

**GVM alpha hints** (`inference/gvm.py`):
- [ ] Import `GVMProcessor` from `CorridorKey/gvm_core/wrapper.py`
- [ ] Load VAE + UNet + scheduler from `~/.corridorkey-studio/weights/gvm/`
- [ ] Call `gvm.process_sequence(input_path, output_dir, mode='matte', denoise_steps=1)`
- [ ] Tune `num_frames_per_batch` (default 8, reduce to 2-4 for low VRAM)
- [ ] Tune `decode_chunk_size` for memory budget
- [ ] All float16, ~6-12 GB VRAM

**VideoMaMa alpha hints** (`inference/videomama.py`):
- [ ] Import pipeline from `CorridorKey/VideoMaMaInferenceModule/pipeline.py`
- [ ] Load SVD-based UNet (12 input channels: 4 noise + 4 cond + 4 mask)
- [ ] Implement brush stroke annotation loading from JSON keyframes
- [ ] Chunk processing (24-50 frames per batch)
- [ ] ~24+ GB VRAM — may need CPU offloading for consumer cards

**Model manager** (`services/model_manager.py`):
- [ ] Implement weight auto-download with progress (httpx streaming + rich progress bar)
- [ ] SHA256 checksum verification after download
- [ ] Retry with exponential backoff on download failure
- [ ] Store weights in `~/.corridorkey-studio/weights/{corridorkey,gvm,videomama}/`

**Other**:
- [ ] Add export endpoint (`POST /clips/{id}/export`) — zip or sequence
- [ ] Respect OutputConfig format (exr vs png) in output writes
- [ ] Add `POST /key` batch endpoint for TopBar KEY button
- [ ] Test MPS path for CorridorKey + GVM on Apple Silicon
- [ ] Test MLX tiling backend path (CorridorKey has native MLX support)

### Phase 6: Cloud Mode (future, no GPU needed for dev)
- [ ] fal.ai serverless integration
- [ ] Same API contract, dispatch based on BackendMode (LOCAL vs CLOUD)
- [ ] Account system for rate limiting

### Web App Wiring (can be done on any machine)
- [ ] Replace mock data in Zustand stores with real API calls
- [ ] Wire SidePanel (Media tab) to `GET /clips` + `POST /clips/import`
- [ ] Wire DualViewer to `GET /clips/{id}/frames/{num}?layer=...`
- [ ] Wire FrameScrubber to `GET /clips/{id}/coverage`
- [ ] Wire Queue tab to `GET /jobs/events` SSE stream
- [ ] Wire ParameterPanel actions (GENERATE, KEY) to `POST /jobs`
- [ ] Wire TopBar KEY button to `POST /key` (once that endpoint exists)
- [ ] Wire export button to `POST /clips/{id}/export`

---

## Architecture Summary

```
Web App (Next.js, localhost:3000)
  ↕ polls GET /health every 5s
  ↕ REST API + SSE for everything else
Backend (FastAPI, localhost:8000)
  ├── GPU Service (detection + VRAM monitoring)
  ├── Clip Manager (CRUD, state machine, JSON persistence)
  ├── Frame Store (disk I/O, ~/.corridorkey-studio/projects/)
  ├── Job Queue (async single-worker, SSE broadcast)
  └── Model Manager (GPU lock, one model at a time)
       ├── CorridorKey (GreenFormer keyer, ~8-10 GB VRAM)
       ├── GVM (auto alpha hints, ~6-12 GB VRAM)
       └── VideoMaMa (artist-guided hints, ~24+ GB VRAM)
```

## Key Files

| File | What it does |
|------|-------------|
| `cli.py` | `corridorkey-studio serve` entry point |
| `app.py` | FastAPI factory, CORS, lifespan |
| `config.py` | Settings with env var overrides |
| `models/schemas.py` | All Pydantic models (camelCase JSON) |
| `services/gpu.py` | GPU detection (torch → nvidia-smi → fallback) |
| `services/clip_manager.py` | Clip lifecycle + state machine |
| `services/frame_store.py` | Disk layout for frames |
| `services/job_queue.py` | Async queue + SSE |
| `services/model_manager.py` | GPU lock + model switching |
| `inference/corridorkey.py` | CorridorKey wrapper (stub) |
| `inference/gvm.py` | GVM wrapper (stub) |
| `inference/videomama.py` | VideoMaMa wrapper (stub) |

## VRAM Budget (sequential, not concurrent)

| Model | VRAM | Notes |
|-------|------|-------|
| CorridorKey | ~8-10 GB | float16 + torch.compile, runs on 8 GB cards |
| GVM | ~6-12 GB | float16, chunked decoding, tunable batch size |
| VideoMaMa | ~24+ GB | Heaviest model, needs high-end card |

Only one model loaded at a time. Model manager evicts before loading next.

## How to Continue on Windows

```bash
# 1. Push from Mac
git push

# 2. On Windows, clone and install
git clone https://github.com/apekshik/corridorkey-studio.git
cd corridorkey-studio/corridorkey-studio-backend
pip install -e ".[gpu]"    # includes torch, numpy, opencv

# 3. Verify stubs work
corridorkey-studio serve
# In another terminal:
curl http://localhost:8000/health   # should show your RTX card

# 4. Start wiring real models in inference/corridorkey.py, inference/gvm.py
# Reference: ../EZ-CorridorKey/ (clone that repo too if not on the machine)
```
