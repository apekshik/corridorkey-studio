"""Disk I/O for frame sequences — manages the project directory layout."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Valid layer names matching ViewMode enum
LAYERS = ("input", "alpha_hint", "fg", "matte", "comp", "processed")


class FrameStore:
    def __init__(self, projects_dir: Path) -> None:
        self._projects_dir = projects_dir

    def project_dir(self, clip_id: str) -> Path:
        return self._projects_dir / clip_id

    def ensure_project_dirs(self, clip_id: str) -> Path:
        """Create the full directory structure for a clip."""
        root = self.project_dir(clip_id)
        root.mkdir(parents=True, exist_ok=True)
        frames_dir = root / "frames"
        for layer in LAYERS:
            (frames_dir / layer).mkdir(parents=True, exist_ok=True)
        (root / "annotations").mkdir(exist_ok=True)
        return root

    def source_path(self, clip_id: str) -> Path:
        return self.project_dir(clip_id) / "source"

    def frames_dir(self, clip_id: str, layer: str = "input") -> Path:
        return self.project_dir(clip_id) / "frames" / layer

    def frame_path(self, clip_id: str, layer: str, frame_num: int, fmt: str = "png") -> Path:
        return self.frames_dir(clip_id, layer) / f"{frame_num:06d}.{fmt}"

    def thumbnail_path(self, clip_id: str) -> Path:
        return self.project_dir(clip_id) / "thumbnail.png"

    def metadata_path(self, clip_id: str) -> Path:
        return self.project_dir(clip_id) / "metadata.json"

    def list_frames(self, clip_id: str, layer: str = "input") -> list[int]:
        """Return sorted list of frame numbers that exist for a layer."""
        d = self.frames_dir(clip_id, layer)
        if not d.exists():
            return []
        frames = []
        for f in d.iterdir():
            if f.suffix in (".png", ".exr") and f.stem.isdigit():
                frames.append(int(f.stem))
        return sorted(frames)

    def find_frame_file(self, clip_id: str, layer: str, frame_num: int) -> Path | None:
        """Find a frame file regardless of format (png or exr)."""
        for fmt in ("png", "exr"):
            p = self.frame_path(clip_id, layer, frame_num, fmt)
            if p.exists():
                return p
        return None

    def get_coverage(self, clip_id: str) -> dict:
        """Compute frame coverage data for the scrubber timeline."""
        return {
            "annotations": self._annotation_frames(clip_id),
            "alphaHints": self.list_frames(clip_id, "alpha_hint"),
            "inferenceOutput": self.list_frames(clip_id, "matte"),
        }

    def _annotation_frames(self, clip_id: str) -> list[int]:
        """List frames that have VideoMaMa annotations."""
        ann_dir = self.project_dir(clip_id) / "annotations"
        if not ann_dir.exists():
            return []
        frames = []
        for f in ann_dir.iterdir():
            if f.suffix == ".json" and f.stem.isdigit():
                frames.append(int(f.stem))
        return sorted(frames)

    def delete_project(self, clip_id: str) -> None:
        """Remove all files for a clip."""
        import shutil

        root = self.project_dir(clip_id)
        if root.exists():
            shutil.rmtree(root)
            logger.info("Deleted project directory: %s", root)
