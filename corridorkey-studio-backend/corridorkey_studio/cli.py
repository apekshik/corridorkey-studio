"""CLI entry point — `corridorkey-studio serve`."""

from __future__ import annotations

import click
from rich.console import Console
from rich.panel import Panel

from corridorkey_studio import __version__
from corridorkey_studio.config import settings

console = Console()


@click.group()
@click.version_option(version=__version__, prog_name="corridorkey-studio")
def main() -> None:
    """CorridorKey Studio — local GPU server for AI green screen keying."""


@main.command()
@click.option("--host", default=None, help="Bind host (default: 0.0.0.0)")
@click.option("--port", default=None, type=int, help="Bind port (default: 8000)")
@click.option("--data-dir", default=None, help="Data directory (default: ~/.corridorkey-studio)")
def serve(host: str | None, port: int | None, data_dir: str | None) -> None:
    """Start the CorridorKey Studio server."""
    import uvicorn

    if host:
        settings.host = host
    if port:
        settings.port = port
    if data_dir:
        from pathlib import Path

        settings.data_dir = Path(data_dir)

    settings.ensure_dirs()

    # Startup banner
    console.print()
    console.print(
        Panel(
            f"[bold white]CORRIDORKEY STUDIO[/] v{__version__}\n\n"
            f"  Server    http://{settings.host}:{settings.port}\n"
            f"  Data      {settings.data_dir}\n"
            f"  Web UI    http://localhost:3000",
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
