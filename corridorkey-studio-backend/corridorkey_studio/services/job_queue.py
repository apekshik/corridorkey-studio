"""Async job queue with single GPU worker and SSE broadcast."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator

from corridorkey_studio.models.enums import ClipState, JobStatus, JobType
from corridorkey_studio.models.schemas import GPUJob, JobCreate

logger = logging.getLogger(__name__)


class SSEEvent:
    """A server-sent event."""

    def __init__(self, event: str, data: dict) -> None:
        self.event = event
        self.data = data

    def encode(self) -> str:
        return f"event: {self.event}\ndata: {json.dumps(self.data)}\n\n"


class JobRecord:
    """Internal job state wrapping the public GPUJob model."""

    def __init__(self, job: GPUJob, clip_id: str, params: dict | None = None) -> None:
        self.job = job
        self.clip_id = clip_id
        self.params = params or {}
        self.cancel_requested = False

    @property
    def is_cancelled(self) -> bool:
        return self.cancel_requested


class JobQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[JobRecord] = asyncio.Queue()
        self._jobs: dict[str, JobRecord] = {}
        self._worker_task: asyncio.Task | None = None
        self._subscribers: list[asyncio.Queue[SSEEvent]] = []
        # These get set by app lifespan after services are initialized
        self.clip_manager = None
        self.frame_store = None
        self.model_manager = None

    def start_worker(self) -> None:
        """Start the background worker loop."""
        self._worker_task = asyncio.create_task(self._worker())
        logger.info("Job queue worker started")

    async def stop_worker(self) -> None:
        """Stop the worker gracefully."""
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            logger.info("Job queue worker stopped")

    async def enqueue(self, create: JobCreate) -> GPUJob:
        """Create a job and add it to the queue."""
        clip = self.clip_manager.get_clip(create.clip_id)

        # Validate clip state for job type
        if create.type == JobType.INFERENCE and clip.state != ClipState.READY:
            from corridorkey_studio.utils.errors import InvalidStateTransitionError
            raise InvalidStateTransitionError(
                f"Clip '{clip.name}' is {clip.state.value} — generate alpha hints first"
            )

        job_id = uuid.uuid4().hex[:8]
        gpu_job = GPUJob(
            id=job_id,
            clip_name=clip.name,
            type=create.type,
            status=JobStatus.QUEUED,
            progress=0.0,
            total_frames=clip.frame_count,
            current_frame=0,
        )

        record = JobRecord(
            job=gpu_job,
            clip_id=create.clip_id,
            params=create.params.model_dump() if create.params else None,
        )
        self._jobs[job_id] = record
        await self._queue.put(record)

        logger.info("Enqueued job %s: %s for clip %s", job_id, create.type.value, clip.name)
        return gpu_job

    def get_job(self, job_id: str) -> GPUJob:
        record = self._jobs.get(job_id)
        if not record:
            from corridorkey_studio.utils.errors import JobNotFoundError
            raise JobNotFoundError(f"Job not found: {job_id}")
        return record.job

    def list_jobs(self, status_filter: JobStatus | None = None) -> list[GPUJob]:
        jobs = [r.job for r in self._jobs.values()]
        if status_filter:
            jobs = [j for j in jobs if j.status == status_filter]
        return jobs

    async def cancel_job(self, job_id: str) -> GPUJob:
        record = self._jobs.get(job_id)
        if not record:
            from corridorkey_studio.utils.errors import JobNotFoundError
            raise JobNotFoundError(f"Job not found: {job_id}")

        record.cancel_requested = True
        if record.job.status == JobStatus.QUEUED:
            record.job.status = JobStatus.CANCELLED
            await self._broadcast(SSEEvent("job:cancelled", {"id": job_id}))

        return record.job

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted strings for a subscriber."""
        q: asyncio.Queue[SSEEvent] = asyncio.Queue()
        self._subscribers.append(q)
        try:
            while True:
                event = await q.get()
                yield event.encode()
        except asyncio.CancelledError:
            pass
        finally:
            self._subscribers.remove(q)

    async def _broadcast(self, event: SSEEvent) -> None:
        """Push an event to all SSE subscribers."""
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # drop events for slow subscribers

    async def _worker(self) -> None:
        """Background loop: pull jobs from queue and execute them."""
        while True:
            record = await self._queue.get()

            if record.cancel_requested:
                record.job.status = JobStatus.CANCELLED
                self._queue.task_done()
                continue

            record.job.status = JobStatus.RUNNING
            await self._broadcast(SSEEvent("job:progress", {
                "id": record.job.id,
                "status": "RUNNING",
                "currentFrame": 0,
                "progress": 0.0,
            }))

            try:
                await self._execute(record)
                record.job.status = JobStatus.COMPLETE
                record.job.progress = 1.0
                await self._broadcast(SSEEvent("job:complete", {
                    "id": record.job.id,
                    "clipId": record.clip_id,
                    "clipState": self.clip_manager.get_clip(record.clip_id).state.value,
                }))
            except asyncio.CancelledError:
                record.job.status = JobStatus.CANCELLED
                await self._broadcast(SSEEvent("job:cancelled", {"id": record.job.id}))
                raise
            except Exception as e:
                logger.exception("Job %s failed", record.job.id)
                record.job.status = JobStatus.ERROR
                error_msg = str(e)
                await self._broadcast(SSEEvent("job:error", {
                    "id": record.job.id,
                    "error": error_msg,
                }))
                # Transition clip to ERROR
                try:
                    self.clip_manager.transition_state(
                        record.clip_id, ClipState.ERROR, error_message=error_msg
                    )
                except Exception:
                    pass
            finally:
                self._queue.task_done()

    async def _execute(self, record: JobRecord) -> None:
        """Dispatch a job to the appropriate handler."""
        job = record.job

        if job.type == JobType.VIDEO_EXTRACT:
            await self._run_video_extract(record)
        elif job.type == JobType.GVM_ALPHA:
            await self._run_gvm_alpha(record)
        elif job.type == JobType.VIDEOMAMA_ALPHA:
            await self._run_videomama_alpha(record)
        elif job.type == JobType.INFERENCE:
            await self._run_inference(record)
        elif job.type == JobType.PREVIEW:
            await self._run_preview(record)
        else:
            raise ValueError(f"Unknown job type: {job.type}")

    async def _run_video_extract(self, record: JobRecord) -> None:
        """Extract frames from a video file (runs in thread pool to avoid blocking)."""
        from corridorkey_studio.utils.video import extract_frames, extract_thumbnail

        clip_id = record.clip_id
        clip = self.clip_manager.get_clip(clip_id)
        job = record.job

        project_dir = self.frame_store.project_dir(clip_id)
        # Find the source video file
        source_files = list(project_dir.glob("source.*"))
        if not source_files:
            raise FileNotFoundError(f"No source video found for clip {clip_id}")
        source_file = source_files[0]

        input_dir = self.frame_store.frames_dir(clip_id, "input")

        def _progress(current: int, total: int) -> None:
            job.current_frame = current
            job.total_frames = total
            job.progress = current / total if total > 0 else 0

        # Run extraction in a thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        actual_count = await loop.run_in_executor(
            None, lambda: extract_frames(source_file, input_dir, on_progress=_progress)
        )

        # Broadcast final progress
        await self._broadcast(SSEEvent("job:progress", {
            "id": job.id,
            "status": "RUNNING",
            "currentFrame": actual_count,
            "progress": 1.0,
        }))

        # Extract thumbnail
        thumb_path = self.frame_store.thumbnail_path(clip_id)
        mid_frame = actual_count // 2
        await loop.run_in_executor(
            None, lambda: extract_thumbnail(source_file, thumb_path, mid_frame)
        )

        # Update clip
        clip.frame_count = actual_count
        clip.thumbnail_url = f"/clips/{clip_id}/thumbnail"
        self.clip_manager.transition_state(clip_id, ClipState.RAW)

        await self._broadcast(SSEEvent("clip:state", {
            "id": clip_id,
            "state": "RAW",
        }))

    async def _run_gvm_alpha(self, record: JobRecord) -> None:
        """Generate alpha hints using GVM for all input frames."""
        from corridorkey_studio.services.model_manager import ActiveModel

        clip_id = record.clip_id
        job = record.job
        loop = asyncio.get_event_loop()

        input_frames = self.frame_store.list_frames(clip_id, "input")
        if not input_frames:
            raise FileNotFoundError(f"No input frames for clip {clip_id}")
        job.total_frames = len(input_frames)

        # Load GVM (evicts any other model)
        service = await loop.run_in_executor(
            None, lambda: self.model_manager.ensure_model(ActiveModel.GVM)
        )

        input_dir = self.frame_store.frames_dir(clip_id, "input")
        alpha_dir = self.frame_store.frames_dir(clip_id, "alpha_hint")

        # GVM works on sequences — use process_sequence for both real and stub
        def _progress(current: int, total: int) -> None:
            job.current_frame = current
            job.total_frames = total
            job.progress = current / total if total > 0 else 0

        await loop.run_in_executor(
            None,
            lambda: service.process_sequence(input_dir, alpha_dir, progress_callback=_progress),
        )

        # Transition clip: RAW/MASKED → READY
        self.clip_manager.transition_state(clip_id, ClipState.READY)
        await self._broadcast(SSEEvent("clip:state", {"id": clip_id, "state": "READY"}))

    async def _run_videomama_alpha(self, record: JobRecord) -> None:
        """Generate alpha hints using VideoMaMa (artist-guided)."""
        from corridorkey_studio.services.model_manager import ActiveModel
        from corridorkey_studio.utils.image_io import read_image, write_png

        clip_id = record.clip_id
        job = record.job
        loop = asyncio.get_event_loop()

        input_frames = self.frame_store.list_frames(clip_id, "input")
        if not input_frames:
            raise FileNotFoundError(f"No input frames for clip {clip_id}")
        job.total_frames = len(input_frames)

        # Load VideoMaMa model
        service = await loop.run_in_executor(
            None, lambda: self.model_manager.ensure_model(ActiveModel.VIDEOMAMA)
        )

        # Load annotation masks (keyframes painted by the artist)
        ann_dir = self.frame_store.project_dir(clip_id) / "annotations"
        alpha_dir = self.frame_store.frames_dir(clip_id, "alpha_hint")

        for i, frame_num in enumerate(input_frames):
            if record.is_cancelled:
                return

            if self.frame_store.find_frame_file(clip_id, "alpha_hint", frame_num):
                job.current_frame = i + 1
                continue

            frame_path = self.frame_store.find_frame_file(clip_id, "input", frame_num)
            frame = await loop.run_in_executor(None, lambda p=frame_path: read_image(p))

            # Check if this frame has an annotation mask
            mask = None
            mask_path = ann_dir / f"{frame_num:06d}.json"
            # For stub: no actual mask loading — real impl reads brush strokes

            result = await loop.run_in_executor(
                None, lambda f=frame, m=mask: service.process_frame(f, mask=m)
            )

            hint = result["alpha_hint"]
            out_path = alpha_dir / f"{frame_num:06d}.png"
            await loop.run_in_executor(None, lambda p=out_path, h=hint: write_png(p, h))

            await self._report_progress(record, i + 1, len(input_frames))

        self.clip_manager.transition_state(clip_id, ClipState.READY)
        await self._broadcast(SSEEvent("clip:state", {"id": clip_id, "state": "READY"}))

    async def _run_inference(self, record: JobRecord) -> None:
        """Run CorridorKey keying — frames + alpha hints → FG/matte/comp/processed."""
        from corridorkey_studio.services.model_manager import ActiveModel
        from corridorkey_studio.utils.image_io import read_image, write_exr, write_png

        clip_id = record.clip_id
        job = record.job
        params = record.params or {}
        loop = asyncio.get_event_loop()

        input_frames = self.frame_store.list_frames(clip_id, "input")
        if not input_frames:
            raise FileNotFoundError(f"No input frames for clip {clip_id}")

        # Only process frames that have alpha hints
        hint_frames = set(self.frame_store.list_frames(clip_id, "alpha_hint"))
        frames_to_key = [f for f in input_frames if f in hint_frames]
        if not frames_to_key:
            raise FileNotFoundError(f"No alpha hints found for clip {clip_id} — generate hints first")
        job.total_frames = len(frames_to_key)

        # Load CorridorKey model
        service = await loop.run_in_executor(
            None, lambda: self.model_manager.ensure_model(ActiveModel.CORRIDORKEY)
        )

        for i, frame_num in enumerate(frames_to_key):
            if record.is_cancelled:
                return

            # Skip already-keyed frames (resume)
            if self.frame_store.find_frame_file(clip_id, "matte", frame_num):
                job.current_frame = i + 1
                continue

            # Read input frame
            frame_path = self.frame_store.find_frame_file(clip_id, "input", frame_num)
            frame = await loop.run_in_executor(None, lambda p=frame_path: read_image(p))

            # Read alpha hint
            hint_path = self.frame_store.find_frame_file(clip_id, "alpha_hint", frame_num)
            alpha_hint = await loop.run_in_executor(None, lambda p=hint_path: read_image(p))
            if alpha_hint.ndim == 3:
                alpha_hint = alpha_hint[..., 0]

            # Run keying
            result = await loop.run_in_executor(
                None, lambda f=frame, a=alpha_hint: service.process_frame(f, alpha_hint=a, **params)
            )

            # Write outputs (default to png for stub, real impl respects OutputConfig)
            for layer_name, data in result.items():
                out_dir = self.frame_store.frames_dir(clip_id, layer_name)
                out_path = out_dir / f"{frame_num:06d}.png"
                await loop.run_in_executor(None, lambda p=out_path, d=data: write_png(p, d))

            await self._report_progress(record, i + 1, len(input_frames))

        # Transition to COMPLETE
        self.clip_manager.transition_state(clip_id, ClipState.COMPLETE)
        await self._broadcast(SSEEvent("clip:state", {"id": clip_id, "state": "COMPLETE"}))

    async def _run_preview(self, record: JobRecord) -> None:
        """Single-frame preview inference (for live preview toggle)."""
        from corridorkey_studio.services.model_manager import ActiveModel
        from corridorkey_studio.utils.image_io import read_image, write_png

        clip_id = record.clip_id
        params = record.params or {}
        loop = asyncio.get_event_loop()

        clip = self.clip_manager.get_clip(clip_id)
        frame_num = clip.current_frame

        service = await loop.run_in_executor(
            None, lambda: self.model_manager.ensure_model(ActiveModel.CORRIDORKEY)
        )

        frame_path = self.frame_store.find_frame_file(clip_id, "input", frame_num)
        if not frame_path:
            raise FileNotFoundError(f"Input frame {frame_num} not found")
        frame = await loop.run_in_executor(None, lambda p=frame_path: read_image(p))

        alpha_hint = None
        hint_path = self.frame_store.find_frame_file(clip_id, "alpha_hint", frame_num)
        if hint_path:
            alpha_hint = await loop.run_in_executor(None, lambda p=hint_path: read_image(p))
            if alpha_hint.ndim == 3:
                alpha_hint = alpha_hint[..., 0]

        result = await loop.run_in_executor(
            None, lambda f=frame, a=alpha_hint: service.process_frame(f, alpha_hint=a, **params)
        )

        for layer_name, data in result.items():
            out_dir = self.frame_store.frames_dir(clip_id, layer_name)
            out_path = out_dir / f"{frame_num:06d}.png"
            await loop.run_in_executor(None, lambda p=out_path, d=data: write_png(p, d))

        record.job.progress = 1.0

    async def _report_progress(self, record: JobRecord, current: int, total: int) -> None:
        """Update job progress and broadcast to SSE subscribers."""
        job = record.job
        job.current_frame = current
        job.total_frames = total
        job.progress = current / total if total > 0 else 0

        await self._broadcast(SSEEvent("job:progress", {
            "id": job.id,
            "status": "RUNNING",
            "currentFrame": current,
            "progress": job.progress,
        }))
