"""Clip lifecycle management — CRUD, state machine, metadata persistence."""

from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path

from corridorkey_studio.models.enums import ClipState
from corridorkey_studio.models.schemas import ClipEntry, ClipUpdate
from corridorkey_studio.services.frame_store import FrameStore
from corridorkey_studio.utils.errors import ClipNotFoundError, InvalidStateTransitionError
from corridorkey_studio.utils.video import get_video_info

logger = logging.getLogger(__name__)

# Valid state transitions
_TRANSITIONS: dict[ClipState, set[ClipState]] = {
    ClipState.EXTRACTING: {ClipState.RAW, ClipState.ERROR},
    ClipState.RAW: {ClipState.MASKED, ClipState.READY, ClipState.ERROR},
    ClipState.MASKED: {ClipState.READY, ClipState.ERROR},
    ClipState.READY: {ClipState.COMPLETE, ClipState.ERROR},
    ClipState.COMPLETE: {ClipState.READY, ClipState.ERROR},  # re-key allowed
    ClipState.ERROR: {ClipState.RAW, ClipState.READY, ClipState.COMPLETE, ClipState.EXTRACTING},  # retry/recovery allowed
}


class ClipManager:
    def __init__(self, data_dir: Path, frame_store: FrameStore) -> None:
        self._data_dir = data_dir
        self._frame_store = frame_store
        self._clips_file = data_dir / "clips.json"
        self._clips: dict[str, ClipEntry] = {}
        self._load()

    def _load(self) -> None:
        """Load clip index from disk."""
        if self._clips_file.exists():
            try:
                data = json.loads(self._clips_file.read_text())
                for item in data:
                    clip = ClipEntry.model_validate(item)
                    self._clips[clip.id] = clip
                logger.info("Loaded %d clips from %s", len(self._clips), self._clips_file)
            except Exception:
                logger.exception("Failed to load clips.json, starting fresh")
                self._clips = {}

    def _save(self) -> None:
        """Persist clip index to disk."""
        data = [clip.model_dump(by_alias=True) for clip in self._clips.values()]
        self._clips_file.write_text(json.dumps(data, indent=2))

    def list_clips(self, state_filter: ClipState | None = None) -> list[ClipEntry]:
        clips = list(self._clips.values())
        if state_filter:
            clips = [c for c in clips if c.state == state_filter]
        return clips

    def get_clip(self, clip_id: str) -> ClipEntry:
        clip = self._clips.get(clip_id)
        if not clip:
            raise ClipNotFoundError(f"Clip not found: {clip_id}")
        return clip

    def import_video(self, filename: str, file_data: bytes) -> tuple[ClipEntry, str]:
        """Import a video file: save source, create clip in EXTRACTING state.

        Returns (clip, clip_id) — caller is responsible for enqueuing
        the VIDEO_EXTRACT job via the job queue.
        """
        clip_id = uuid.uuid4().hex[:12]
        name = Path(filename).stem

        # Set up project directory
        self._frame_store.ensure_project_dirs(clip_id)

        # Save source video
        source_dir = self._frame_store.source_path(clip_id)
        ext = Path(filename).suffix
        source_file = source_dir.with_suffix(ext)
        source_file.write_bytes(file_data)

        # Get video info for initial frame count estimate
        info = get_video_info(source_file)

        # Create clip entry in EXTRACTING state
        clip = ClipEntry(
            id=clip_id,
            name=name,
            state=ClipState.EXTRACTING,
            frame_count=info["frame_count"],
        )
        self._clips[clip_id] = clip
        self._save()

        return clip, clip_id

    def update_clip(self, clip_id: str, update: ClipUpdate) -> ClipEntry:
        clip = self.get_clip(clip_id)
        if update.in_point is not None:
            clip.in_point = update.in_point
        if update.out_point is not None:
            clip.out_point = update.out_point
        if update.current_frame is not None:
            clip.current_frame = update.current_frame
        self._save()
        return clip

    def delete_clip(self, clip_id: str) -> None:
        self.get_clip(clip_id)  # raises if not found
        self._frame_store.delete_project(clip_id)
        del self._clips[clip_id]
        self._save()
        logger.info("Deleted clip: %s", clip_id)

    def transition_state(self, clip_id: str, new_state: ClipState, error_message: str | None = None) -> ClipEntry:
        return self._transition(clip_id, new_state, error_message)

    def _transition(self, clip_id: str, new_state: ClipState, error_message: str | None = None) -> ClipEntry:
        clip = self.get_clip(clip_id)
        valid = _TRANSITIONS.get(clip.state, set())
        if new_state not in valid:
            raise InvalidStateTransitionError(
                f"Cannot transition {clip.name} from {clip.state.value} to {new_state.value}"
            )
        clip.state = new_state
        if error_message:
            clip.error_message = error_message
        elif new_state != ClipState.ERROR:
            clip.error_message = None
        self._save()
        logger.info("Clip %s: %s → %s", clip.name, clip.state.value, new_state.value)
        return clip
