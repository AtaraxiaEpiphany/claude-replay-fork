# Product Guide

## Product Name

claude-replay

## Description

A zero-runtime-dependency CLI tool that converts AI coding session transcripts into self-contained, interactive HTML replays. Supports transcripts from Claude Code, Cursor, Codex CLI, Gemini CLI, and OpenCode.

## Target Users

- Developers who want to review or share their AI coding sessions
- Teams using AI-assisted development tools (Claude Code, Cursor, etc.)
- Educators and content creators demonstrating AI coding workflows

## Core Value Proposition

Transform opaque AI coding session logs into visual, interactive, shareable HTML replays — no server required, no runtime dependencies.

## Key Features

1. **Multi-format parsing** — Claude Code, Cursor, Codex CLI, Gemini CLI, OpenCode transcripts
2. **Self-contained HTML output** — single file, no external dependencies
3. **Plugin architecture** — extensible format parsers via `{ name, detect, parse }` interface
4. **6 built-in themes** — customizable via JSON
5. **Secrets redaction** — automatic API key/token detection and masking
6. **Web editor** — interactive editor for replay customization
7. **Roundtrip support** — extract turn data from generated HTML
8. **Serve/watch modes** — live preview during development

## Project Maturity

Brownfield — active development, v0.8.0, small codebase (~33 JS files).

## License

MIT
