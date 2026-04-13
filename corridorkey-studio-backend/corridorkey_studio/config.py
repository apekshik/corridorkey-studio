"""Application configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    host: str = "0.0.0.0"
    port: int = 8000
    data_dir: Path = field(default_factory=lambda: Path.home() / ".corridorkey-studio")
    cors_origins: list[str] = field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    def __post_init__(self) -> None:
        if isinstance(self.data_dir, str):
            self.data_dir = Path(self.data_dir)
        # Allow env overrides
        self.host = os.environ.get("CK_HOST", self.host)
        self.port = int(os.environ.get("CK_PORT", self.port))
        data_dir_env = os.environ.get("CK_DATA_DIR")
        if data_dir_env:
            self.data_dir = Path(data_dir_env)

    def ensure_dirs(self) -> None:
        """Create required directories."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "weights").mkdir(exist_ok=True)
        (self.data_dir / "projects").mkdir(exist_ok=True)


settings = Settings()
