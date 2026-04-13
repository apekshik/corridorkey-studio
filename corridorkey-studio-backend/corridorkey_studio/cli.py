"""CLI entry point — `corridorkey-studio serve`."""

from __future__ import annotations

import click
from rich.console import Console
from rich.panel import Panel

from corridorkey_studio import __version__
from corridorkey_studio.config import settings

console = Console()

CORRIDORKEY_REPO = "https://github.com/nikopueringer/CorridorKey.git"


def _ensure_corridorkey(data_dir) -> str | None:
    """Clone or update the CorridorKey repo in the data directory.

    Returns the path to the repo, or None if git isn't available.
    """
    import subprocess
    from pathlib import Path

    repo_dir = Path(data_dir) / "corridorkey"

    if repo_dir.exists() and (repo_dir / ".git").exists():
        # Pull latest
        console.print("  [dim]Updating CorridorKey models...[/]")
        try:
            result = subprocess.run(
                ["git", "pull", "--ff-only"],
                cwd=repo_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                msg = result.stdout.strip().split("\n")[0]
                console.print(f"  [dim]CorridorKey: {msg}[/]")
            else:
                console.print(f"  [yellow]CorridorKey update failed (using existing)[/]")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            console.print(f"  [yellow]git not available, using existing CorridorKey[/]")
        return str(repo_dir)

    # Fresh clone
    console.print(f"  [dim]Cloning CorridorKey models (first run)...[/]")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", CORRIDORKEY_REPO, str(repo_dir)],
            check=True,
            timeout=120,
        )
        console.print(f"  [dim]CorridorKey: cloned to {repo_dir}[/]")
        return str(repo_dir)
    except FileNotFoundError:
        console.print("[yellow]git not found — install git to enable model downloads[/]")
        return None
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        console.print(f"[yellow]Failed to clone CorridorKey: {e}[/]")
        return None


@click.group()
@click.version_option(version=__version__, prog_name="corridorkey-studio")
def main() -> None:
    """CorridorKey Studio — local GPU server for AI green screen keying."""


@main.command()
@click.option("--host", default=None, help="Bind host (default: 0.0.0.0)")
@click.option("--port", default=None, type=int, help="Bind port (default: 8000)")
@click.option("--data-dir", default=None, help="Data directory (default: ~/.corridorkey-studio)")
@click.option("--corridorkey-path", default=None, help="Override CorridorKey repo path (default: auto-managed)")
def serve(host: str | None, port: int | None, data_dir: str | None, corridorkey_path: str | None) -> None:
    """Start the CorridorKey Studio server."""
    import os
    import sys
    import uvicorn
    from pathlib import Path

    # Enable MPS fallback for ops not yet implemented on Apple Metal
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    if host:
        settings.host = host
    if port:
        settings.port = port
    if data_dir:
        settings.data_dir = Path(data_dir)

    settings.ensure_dirs()

    # Resolve CorridorKey repo path
    if corridorkey_path:
        ck_path = corridorkey_path
    else:
        ck_path = _ensure_corridorkey(settings.data_dir)

    if ck_path and Path(ck_path).exists():
        if ck_path not in sys.path:
            sys.path.insert(0, ck_path)
        settings.corridorkey_path = Path(ck_path)

    # Startup banner
    ck_status = f"CorridorKey  {ck_path}" if ck_path else "CorridorKey  [not available]"
    console.print()
    console.print(
        Panel(
            f"[bold white]CORRIDORKEY STUDIO[/] v{__version__}\n\n"
            f"  Server       http://{settings.host}:{settings.port}\n"
            f"  Data         {settings.data_dir}\n"
            f"  {ck_status}\n"
            f"  Web UI       http://localhost:3000",
            border_style="red",
            padding=(1, 2),
        )
    )
    console.print()

    uvicorn.run(
        "corridorkey_studio.app:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level="info",
    )
