# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- [Project Overview](#project-overview)
- [Commands](#commands)
- [Architecture](#architecture)
  - [Data Flow](#data-flow)
  - [Canonical Data Model](#canonical-data-model)
  - [Key Modules](#key-modules)
  - [Adding a New Format Parser](#adding-a-new-format-parser)
  - [Tool Name Normalization](#tool-name-normalization)
  - [Template Build System](#template-build-system)
- [Conventions](#conventions)

## Project Overview

claude-replay is a zero-runtime-dependency CLI tool that converts AI coding session transcripts into self-contained, interactive HTML replays. Supports transcripts from Claude Code, Cursor, Codex CLI, Gemini CLI, and OpenCode.

## Commands

```bash
npm test                  # Run all unit tests (node --test test/test-*.mjs)
node --test test/test-parser.mjs   # Run a single test file
npm run build             # Minify template/player.html → player.min.html (esbuild)
npm run build:website     # Build template + website into docs/
npm run test:e2e          # Run Playwright E2E tests (Chromium, headless)
npx oxlint@latest --deny-warnings src/ bin/   # Lint
```

Tests use Node.js built-in test runner (`node:test` + `node:assert/strict`). E2E tests use Playwright (`@playwright/test`).

## Architecture

### Data Flow

Raw transcript → Format detection → Format-specific parser → `Turn[]` → Secrets redaction → Theme application → HTML template rendering → Self-contained HTML file.

### Canonical Data Model (defined in `src/formats/shared.mjs`):
- `Turn` — one exchange: `{ index, user_text, blocks: AssistantBlock[], timestamp }`
- `AssistantBlock` — typed content: `{ kind, text, tool_call: ToolCall|null, timestamp }`
- `ToolCall` — `{ tool_use_id, name, input, result, resultTimestamp, is_error }`

Block kinds: `text`, `thinking`, `tool_use`.

### Key Modules
- `bin/claude-replay.mjs` — CLI entry point. Argument parsing, subcommand dispatch (replay, editor, extract), session resolution, serve/watch modes.
- `src/parser.mjs` — Public API facade. Delegates to format registry.
- `src/formats/index.mjs` — Format registry with ordered detection. Plugin architecture: each format exports `{ name, detect(obj), parse(text) }`. Detection order matters (specific before generic).
- `src/formats/*.mjs` — Format-specific parsers. All normalize to the canonical `Turn[]` shape. Shared utilities in `shared.mjs` (`buildTurnsFromEntries`, `attachToolResults`, `cleanSystemTags`).
- `src/renderer.mjs` — Node.js renderer. Reads template, compresses turn data (deflate+base64), applies secrets/themes, produces final HTML.
- `src/browser.mjs` — Browser-compatible renderer (no zlib, uses escaped JSON instead of compression).
- `src/themes.mjs` — 6 built-in themes. Custom themes loaded from JSON, merged with tokyo-night defaults.
- `src/secrets.mjs` — Regex-based API key/token detection and redaction.
- `src/editor-server.mjs` — HTTP server for the web-based editor UI.
- `src/extract.mjs` — Extracts turn data from generated HTML replays (roundtrip support).
- `template/player.html` — Self-contained vanilla JS player (no frameworks). Data embedded in `<script>` tags via `/*PLACEHOLDER*/` tokens that the renderer replaces.

### Adding a New Format Parser
1. Create `src/formats/my-format.mjs` with `{ name, detect(obj), parse(text) }` exports
2. Import and add to the `formats` array in `src/formats/index.mjs` (order matters — specific before generic)
3. Add fixture and tests

### Tool Name Normalization

All format parsers normalize tool names to a standard set (Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch).

### Template Build System

`scripts/build-template.mjs` uses esbuild to minify the player HTML. Template uses `/*PLACEHOLDER*/` comment-style tokens that get swapped to safe tokens before minification and restored after.

## Conventions

- ESM only (`"type": "module"`) — all files use `.mjs` extension
- Zero runtime dependencies — only `esbuild` and `@playwright/test` as devDependencies
- Node.js >= 18
- Pre-commit hook runs oxlint on `src/` and `bin/`

# Conductor

## File Index

Use this map when explicit links are missing. All new documents MUST be created in the following **RELEVANT** paths:

| Category        | Document Type           | Default Path Pattern                                       | Creation Rule                         |
| :-------------- | :---------------------- | :--------------------------------------------------------- | :------------------------------------ |
| **Overview**    | Product Definition      | `./conductor/overview/product.md`                          | Create if missing.                    |
|                 | Product Guidelines      | `./conductor/overview/product-guidelines.md`               | Create if missing.                    |
| **Requirement** | PRD                     | `./conductor/requirement/prd/<name>.md`                    | **Create here** if missing.           |
| **Design**      | Tech Stack              | `./conductor/design/tech-stack.md`                         | Create if missing.                    |
|                 | UX/UI Spec              | `./conductor/requirement/ux-ui/design-spec.md`             | Create if missing.                    |
|                 | Architecture            | `./conductor/design/architecture/system-architecture.md`   | Create if missing.                    |
|                 | DB Design               | `./conductor/design/database/schema.md`                    | Create if missing.                    |
|                 | API Specs               | `./conductor/design/api-specs/<endpoint>.md`               | **Strict Schema Adherence Required**. |
| **Workflow**    | Workflow Index          | `./conductor/workflow/index.md`                            | Create if missing.                    |
|                 | Code Patterns           | `./conductor/workflow/code-styleguides/<code-patterns>.md` | Create if missing.                    |
|                 | Code Style              | `./conductor/workflow/code-styleguides/<language>.md`      | Create if missing.                    |
|                 | Git Flow                | `./conductor/workflow/git-flow.md`                         | Create if missing.                    |
|                 | Testing                 | `./conductor/workflow/testing/strategy.md`                 | Create if missing.                    |
| **Resources**   | References/FAQ/Glossary | `./conductor/resource/<type>.md`                           | Create if needed.                     |
| **Management**  | Track Spec/Plan/Meta    | `./conductor/tracks/<track_id>/`                           | Read/Update based on context.         |
