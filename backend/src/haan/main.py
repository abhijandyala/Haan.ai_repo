"""
Main entry point for the Haan.ai backend.

Provides both:
- A FastAPI application for programmatic use (import and run with uvicorn)
- A Typer CLI for command-line use (haan serve, haan run, etc.)

Usage:
    # Start the server
    haan serve --port 8000

    # Run a pipeline task directly
    haan run "Add authentication to the API"

    # Check health
    haan health
"""

from __future__ import annotations

import asyncio
import sys
from typing import Optional

import typer
import uvicorn
from rich.console import Console
from rich.panel import Panel

from haan import __version__
from haan.config import settings
from haan.utils.logger import logger

# ── Typer CLI Application ──
cli_app = typer.Typer(
    name="haan",
    help="Haan.ai - AI-powered software engineering pipeline",
    no_args_is_help=True,
)

console = Console()


@cli_app.command()
def serve(
    host: str = typer.Option(None, help="Host to bind to"),
    port: int = typer.Option(None, help="Port to listen on"),
    reload: bool = typer.Option(False, help="Enable auto-reload for development"),
    log_level: str = typer.Option(None, help="Log level (debug, info, warning, error)"),
) -> None:
    """Start the Haan.ai API server."""
    effective_host = host or settings.host
    effective_port = port or settings.port
    effective_log_level = log_level or settings.log_level

    # Configure logging
    logger.set_level(effective_log_level)

    console.print(Panel(
        f"[bold]Haan.ai[/bold] v{__version__}\n"
        f"Server: http://{effective_host}:{effective_port}\n"
        f"WebSocket: ws://{effective_host}:{effective_port}/ws\n"
        f"Log level: {effective_log_level}",
        title="Starting Server",
        border_style="bright_yellow",
    ))

    # Import here to avoid circular imports at CLI parse time
    from haan.api.server import app

    uvicorn.run(
        app,
        host=effective_host,
        port=effective_port,
        log_level=effective_log_level,
        reload=reload,
    )


@cli_app.command()
def run(
    task: str = typer.Argument(..., help="Task description to execute"),
    mode: str = typer.Option("auto", help="Execution mode: auto or human"),
    model: Optional[str] = typer.Option(None, help="LLM model to use"),
    provider: Optional[str] = typer.Option(None, help="LLM provider (anthropic, openai, google)"),
) -> None:
    """Run a pipeline task directly from the command line."""
    logger.set_level(settings.log_level)

    console.print(Panel(
        f"[bold]Task:[/bold] {task}\n"
        f"[bold]Mode:[/bold] {mode}\n"
        f"[bold]Provider:[/bold] {provider or settings.default_provider}\n"
        f"[bold]Model:[/bold] {model or settings.default_model}",
        title="Running Pipeline",
        border_style="bright_yellow",
    ))

    from haan.pipeline.engine import PipelineEngine
    from haan.providers.factory import create_llm

    # Create LLM if provider/model specified
    llm = None
    if provider or model:
        try:
            llm = create_llm(
                provider=provider or settings.default_provider,
                model=model or settings.default_model,
            )
        except ValueError as e:
            console.print(f"[red]Error:[/red] {e}")
            raise typer.Exit(1)

    engine = PipelineEngine(llm=llm)

    # Run the pipeline
    state = asyncio.run(engine.execute(task=task, mode=mode))  # type: ignore[arg-type]

    # Print results
    if state.current_stage.value == "complete":
        console.print("\n[green bold]Pipeline completed successfully![/green bold]")
    else:
        console.print(f"\n[red bold]Pipeline failed:[/red bold] {state.error}")
        raise typer.Exit(1)


@cli_app.command()
def health() -> None:
    """Check the health of the API server."""
    import httpx

    url = f"http://{settings.host}:{settings.port}/api/health"
    try:
        response = httpx.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            console.print(f"[green]Server is healthy[/green] (v{data['version']})")
        else:
            console.print(f"[red]Server returned {response.status_code}[/red]")
            raise typer.Exit(1)
    except httpx.ConnectError:
        console.print(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(1)


@cli_app.command()
def tools() -> None:
    """List all available tools."""
    from haan.tools import get_all_tool_schemas

    schemas = get_all_tool_schemas()
    console.print(f"\n[bold]Available Tools ({len(schemas)}):[/bold]\n")
    for schema in schemas:
        console.print(f"  [cyan]{schema['name']:<20}[/cyan] {schema['description']}")
    console.print()


@cli_app.command()
def models() -> None:
    """List all available LLM models."""
    from haan.providers.factory import list_available_models

    all_models = list_available_models()
    console.print(f"\n[bold]Available Models:[/bold]\n")
    for m in all_models:
        status = "[green]available[/green]" if m["available"] else "[red]no API key[/red]"
        default = " [yellow](default)[/yellow]" if (
            m["provider"] == settings.default_provider
            and m["model"] == settings.default_model
        ) else ""
        console.print(f"  {m['provider']:<12} {m['model']:<35} {status}{default}")
    console.print()


@cli_app.command()
def version() -> None:
    """Show the current version."""
    console.print(f"Haan.ai v{__version__}")


# ── Module Entry Point ──
# Allows running with: python -m haan.main
if __name__ == "__main__":
    cli_app()
