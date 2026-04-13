"""GPU detection and VRAM monitoring."""

from __future__ import annotations

import logging
import subprocess

from corridorkey_studio.models.schemas import GPUInfo

logger = logging.getLogger(__name__)

_NO_GPU = GPUInfo(name="No GPU", vram_used=0.0, vram_total=0.0)


class GPUService:
    def __init__(self) -> None:
        self._available = False
        self._method: str | None = None
        self._detect()

    def _detect(self) -> None:
        # Try torch.cuda first
        try:
            import torch

            if torch.cuda.is_available():
                self._available = True
                self._method = "torch"
                logger.info("GPU detected via torch.cuda: %s", torch.cuda.get_device_name(0))
                return

            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self._available = True
                self._method = "mps"
                logger.info("GPU detected via Apple MPS")
                return
        except ImportError:
            pass

        # Fall back to nvidia-smi
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.used,memory.total",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                self._available = True
                self._method = "nvidia-smi"
                logger.info("GPU detected via nvidia-smi")
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        logger.warning("No GPU detected — running in CPU-only mode")

    @property
    def is_available(self) -> bool:
        return self._available

    def get_info(self) -> GPUInfo:
        if not self._available:
            return _NO_GPU

        if self._method == "torch":
            return self._info_from_torch()
        elif self._method == "mps":
            return self._info_from_mps()
        elif self._method == "nvidia-smi":
            return self._info_from_smi()
        return _NO_GPU

    def _info_from_torch(self) -> GPUInfo:
        try:
            import torch

            props = torch.cuda.get_device_properties(0)
            allocated = torch.cuda.memory_allocated(0) / (1024**3)
            total = props.total_mem / (1024**3)
            return GPUInfo(
                name=props.name,
                vram_used=round(allocated, 1),
                vram_total=round(total, 1),
            )
        except Exception:
            logger.exception("Failed to read GPU info via torch")
            return _NO_GPU

    def _info_from_mps(self) -> GPUInfo:
        """Apple Silicon — report chip name and total unified memory."""
        try:
            import platform
            import subprocess

            # Get chip name (e.g. "Apple M2 Pro")
            chip = platform.processor() or "Apple Silicon"
            # Try to get more specific name from sysctl
            try:
                result = subprocess.run(
                    ["sysctl", "-n", "machdep.cpu.brand_string"],
                    capture_output=True, text=True, timeout=2,
                )
                if result.returncode == 0 and result.stdout.strip():
                    chip = result.stdout.strip()
            except Exception:
                pass

            # Get total system memory (unified memory = GPU memory on Apple Silicon)
            total_gb = 0.0
            try:
                result = subprocess.run(
                    ["sysctl", "-n", "hw.memsize"],
                    capture_output=True, text=True, timeout=2,
                )
                if result.returncode == 0:
                    total_gb = round(int(result.stdout.strip()) / (1024**3), 1)
            except Exception:
                pass

            # MPS doesn't expose per-process VRAM usage, report 0
            return GPUInfo(
                name=f"{chip} (MPS)",
                vram_used=0.0,
                vram_total=total_gb,
            )
        except Exception:
            logger.exception("Failed to read MPS info")
            return GPUInfo(name="Apple Silicon (MPS)", vram_used=0.0, vram_total=0.0)

    def _info_from_smi(self) -> GPUInfo:
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.used,memory.total",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(",")
                if len(parts) == 3:
                    name = parts[0].strip()
                    vram_used = round(float(parts[1].strip()) / 1024, 1)  # MiB → GiB
                    vram_total = round(float(parts[2].strip()) / 1024, 1)
                    return GPUInfo(name=name, vram_used=vram_used, vram_total=vram_total)
        except Exception:
            logger.exception("Failed to read GPU info via nvidia-smi")
        return _NO_GPU
