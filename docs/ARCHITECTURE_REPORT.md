# How claude-replay Replays Agent Sessions: Implementation Principles

## Overview

claude-replay does **not** re-execute or replay agent requests. It is a **transcript-to-HTML converter** that takes raw session logs produced by AI coding agents (Claude Code, Cursor, Codex CLI, Gemini CLI, OpenCode), normalizes them into a unified data model, and renders them into a self-contained HTML file with an interactive playback UI. The "replay" is a **visual playback** of the recorded conversation — similar to watching a video recording of a past session.

The entire pipeline is:

```
Raw session log (JSONL/JSON)
  → Format detection
  → Format-specific parsing
  → Canonical Turn[] data model
  → Secret redaction
  → Theme application
  → Data compression (deflate+base64)
  → HTML template injection
  → Self-contained HTML file
  → Browser-side interactive playback
```

---

## 1. Session Transcript Sources

Each AI agent stores its session logs in a different location and format:

| Agent | Location | Format |
|-------|----------|--------|
| Claude Code | `~/.claude/projects/` | JSONL: `{ type: "user"|"assistant", message: {...}, timestamp }` |
| Cursor | `~/.cursor/projects/` | JSONL: `{ role: "user"|"assistant", message: {...} }` |
| Codex CLI | `~/.codex/sessions/` | JSONL: event-driven (`session_meta`, `event_msg`, `item.completed`) |
| Gemini CLI | `~/.gemini/tmp/` | Single JSON: `{ sessionId, messages[] }` |
| OpenCode | via `opencode export` | JSONL: event-based (`step_start`, `tool_use`, `step_finish`) |

The CLI can resolve session IDs to file paths by scanning these directories (`src/resolve-session.mjs`).

---

## 2. Format Detection (Plugin Architecture)

Format detection lives in `src/formats/index.mjs`. It uses a **plugin architecture** where each format module exports:

```js
{ name, detect(firstObj), detectFromText?(text), parse(text) }
```

Detection operates in two phases:

1. **Text-level detectors** (`textDetectors`): checked first. Currently only Gemini, which is a single JSON object (not JSONL), so it needs full-text parsing via `detectFromText()`.

2. **JSONL detectors** (`formats`): scanned line-by-line. Each JSONL line is parsed, and each format's `detect()` function tests the first matching object. Detection is tried in order — more specific formats first (replay, codex, opencode) before generic ones (claude-code, cursor).

Detection ordering is critical. For example, both Claude Code and Cursor use `{ role: "user" }` entries, but Claude Code also has a `type` field. The cursor detector explicitly rejects entries with a `type` field to avoid false matches.

---

## 3. Parsing: Format-Specific to Canonical Model

Each format parser converts its native structure into the **canonical `Turn[]` data model** defined in `src/formats/shared.mjs`:

```
Turn {
  index: number,
  user_text: string,
  blocks: AssistantBlock[],
  timestamp: string,
  system_events?: string[]
}

AssistantBlock {
  kind: "text" | "thinking" | "tool_use",
  text: string,
  tool_call: ToolCall | null,
  timestamp: string | null
}

ToolCall {
  tool_use_id: string,
  name: string,
  input: object,
  result: string | null,
  resultTimestamp: string | null,
  is_error: boolean
}
```

### Shared Parsing Logic (`shared.mjs`)

Claude Code and Cursor share a common parsing pipeline through `buildTurnsFromEntries()`:

1. **Scan entries** linearly, grouping user→assistant→tool_result sequences into turns.
2. **`collectAssistantBlocks()`**: Starting from an assistant entry, collect all consecutive `text`, `thinking`, and `tool_use` blocks, deduplicating by content key.
3. **`attachToolResults()`**: Scan forward through subsequent user entries to find `tool_result` blocks, matching them to pending `tool_use` blocks by `tool_use_id`.
4. **`cleanSystemTags()`**: Strip XML-like system tags (`<system-reminder>`, `<ide_opened_file>`, `<command-name>`, etc.) from user text to show only the human-readable portion.
5. **`filterEmptyTurns()`**: Remove turns with no meaningful content and re-index sequentially.

### Format-Specific Adaptations

**Claude Code** (`claude-code.mjs`): Simplest parser — entries use `{ type: "user"|"assistant" }` and delegate directly to `buildTurnsFromEntries()`.

**Cursor** (`cursor.mjs`): Similar to Claude Code but uses `role` instead of `type`. After parsing, reclassifies all assistant text blocks except the last one per turn as `thinking` (Cursor's intermediate text is essentially chain-of-thought).

**Codex CLI** (`codex.mjs`): Most complex (332 lines). Supports two format variants:
- **Legacy**: `event_msg` events with `task_started`/`task_complete` boundaries.
- **New**: `item.completed` events with nested item objects.
- Maps Codex-specific constructs: `exec_command` → `Bash`, `apply_patch` → `Edit`/`Write` (with a custom patch parser `parseCodexPatch()` that parses `*** Begin Patch` / `*** Update File` / `*** Add File` diff format).

**Gemini CLI** (`gemini.mjs`): Single JSON object with a `messages[]` array. Each Gemini message has `thoughts[]`, `toolCalls[]`, and `content`. Tool names are mapped through a lookup table (`run_shell_command` → `Bash`, `read_file` → `Read`, etc.). Tool results are extracted from Gemini's nested `functionResponse` structure.

**OpenCode** (`opencode.mjs`): Event-based JSONL with `step_start`/`step_finish` boundaries. Tool names mapped similarly. Input fields are normalized (e.g., `filePath` → `file_path`, commands prefixed with workdir).

### Tool Name Normalization

All parsers map agent-specific tool names to a standard set: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebSearch`, `WebFetch`. This allows the player UI to render tools consistently regardless of the source agent.

---

## 4. Post-Processing Pipeline

After parsing, several transforms are applied before rendering:

### Turn Filtering (`parser.mjs: filterTurns()`)
- Range filtering (`--turns 5-10`)
- Turn exclusion (`--exclude-turns 3,7`)
- Time range filtering (`--from` / `--to` ISO 8601 timestamps)

### Timestamp Handling (`parser.mjs: applyPacedTiming()`)
When real timestamps are unavailable or `--timing paced` is used, synthetic timestamps are generated:
- 500ms gap before each turn
- Per-block delay: `min(max(text_length * 30ms, 1000ms), 10000ms)` — longer text = longer display time
- Tool call results get their own timestamp

The player supports toggling between real and paced timing at runtime.

### Secret Redaction (`secrets.mjs`)
9 regex patterns detect and replace with `[REDACTED]`:
- Private keys (PEM blocks)
- AWS access keys (`AKIA...`)
- Anthropic API keys (`sk-ant-...`)
- Generic `sk-`/`key-` prefixed tokens
- Bearer tokens
- JWT tokens (`eyJ...`)
- Database connection strings
- Key-value secrets (`api_key=...`)
- Environment variable secrets (`PASSWORD=...`)
- Hex tokens (40+ hex chars)

Additionally, user-supplied `--redact` rules provide custom find-and-replace. All redaction is applied recursively to strings and nested objects via `transformStrings()`.

### Multi-Session Concatenation
When multiple input files are provided:
- Sessions with timestamps are sorted chronologically
- All others keep CLI argument order
- Turns are re-indexed sequentially across sessions

---

## 5. HTML Rendering (`renderer.mjs`)

The renderer produces a single self-contained HTML file through **template injection**:

### Template System
`template/player.html` is a complete HTML document (~98KB unminified) containing CSS, JS, and structural HTML. It uses `/*PLACEHOLDER*/` comment-style tokens that the renderer replaces:

```
/*THEME_CSS*/        → CSS :root variables from theme
/*TURNS_DATA*/       → Compressed turn data (deflate+base64)
/*BOOKMARKS_DATA*/   → Compressed bookmark data
/*FILES_DATA*/       → Compressed file activity sidebar data
/*INITIAL_SPEED*/    → Playback speed
/*PAGE_TITLE*/       → HTML title
/*USER_LABEL*/       → "User" or custom label
/*ASSISTANT_LABEL*/  → "Claude" / "Gemini" / etc.
... and more
```

### Data Compression
Turn data is serialized to JSON, then compressed via `deflateSync` + base64 encoding. This typically achieves ~60-70% size reduction. The browser-side decoder uses the native `DecompressionStream("deflate")` API. A `--no-compress` fallback embeds raw escaped JSON for older browsers.

### File Activity Extraction
`extractFileData()` scans all tool calls for file paths, building a sidebar index that maps each file to the turns/blocks that reference it, with a computed common path prefix for display.

### Template Build (Minification)
`scripts/build-template.mjs` uses esbuild to minify `player.html` → `player.min.html`:
1. Replace `/*PLACEHOLDER*/` tokens with safe string tokens (esbuild would strip comment-like syntax)
2. Extract and minify CSS and JS separately via esbuild
3. Reassemble the HTML with minified content
4. Restore original placeholder tokens
5. Verify all tokens were restored correctly

---

## 6. Browser-Side Interactive Playback

The player HTML contains a complete vanilla JavaScript playback engine (~600 lines). Here's how it works:

### Data Loading
On page load, the embedded data is decoded:
```js
const TURNS = await decodeData("/*TURNS_DATA*/");
const BOOKMARKS = await decodeData("/*BOOKMARKS_DATA*/");
const FILES = await decodeData("/*FILES_DATA*/");
```
`decodeData()` detects whether the data is compressed (base64 → inflate → JSON parse) or raw JSON.

### DOM Rendering
All turns are rendered into the DOM immediately, but hidden:
- Each turn is a `<div class="turn">` containing a header, user message, and assistant blocks
- Blocks are wrapped in `.block-wrapper.block-hidden` elements
- Consecutive tool calls are grouped into `.tool-group` elements
- Edit operations render as LCS-based diffs (longest common subsequence algorithm)
- Long content is wrapped in collapsible containers

### Playback Engine

The playback is a **progressive reveal** engine — it does not re-render content, it unhides what's already in the DOM:

1. **`showUpTo(index)`**: Makes turns 1..N visible, hides N+1..end. Reveals all blocks in completed turns. Scrolls the active turn into view.

2. **`animateTurn(turnIndex, onComplete)`**: The core animation function. Computes time gaps between segments based on timestamps, then progressively reveals each block-wrapper:
   - Gap calculation: uses real timestamps between blocks, or `ANIMATE_FALLBACK_DELAY` (800ms) if missing
   - Gaps are clamped to `[600ms, 10000ms]`
   - `adaptiveWait(gapMs, callback)`: sleeps for `gapMs / speed`, checking speed **live** every 100ms tick so speed changes take effect immediately
   - Each block reveal triggers a scroll-if-needed to keep the active block visible

3. **`playStep()`**: The main playback loop:
   - Show the turn container (header + user text)
   - Animate blocks within the turn via `animateTurn()`
   - After all blocks revealed, `dwellThenAdvance()` waits `SHORT_TURN_DELAY_MS` (5s)
   - Then calls `playStep()` again for the next turn

4. **Pause/Resume**: When paused mid-turn, the animation state is frozen in `animatePausedState = { turnIndex, blockIdx }`. On resume, `animateTurn()` continues from that block index.

### Navigation
- **Progress bar**: Maps between turn numbers and 0-1 percentages. Clicking seeks to that turn.
- **Prev/Next buttons**: Step forward/backward by one turn (fully reveal/hide blocks).
- **Prev/Next turn buttons**: Step by block within a turn.
- **Chapter menu**: Bookmarks rendered as a dropdown, each jumping to a specific turn.
- **Scroll tracking**: Scrolling past a turn automatically sets it as current.

### Timing Modes
The player supports two timing modes, toggled at runtime:
- **Real timing**: Uses actual timestamps from the session. Elapsed time and total duration reflect the real session.
- **Paced timing**: Synthetic timing based on content length. Provides a more watchable experience for long pauses or very fast tool calls.

Both modes compute `turnStartTimes[]`, `turnEndTimes[]`, and `sessionTotalMs` for the progress bar and timer display.

### Markdown Rendering
A built-in markdown renderer handles:
- Fenced code blocks (`` ``` ``)
- Headers (`#` through `####`)
- Bold, italic, inline code
- Ordered/unordered lists
- Tables (pipe-delimited)
- Links (with `target="_blank"`)
- Horizontal rules

---

## 7. Output Modes

The CLI (`bin/claude-replay.mjs`) supports three output modes:

1. **File output** (`-o file.html`): Build once, write to file.
2. **Serve mode** (`--serve`): Start an HTTP server (default port 7332) that serves the replay. Includes a live-reload script that polls `/__reload` every second — when the build version increments (from `--watch`), it reloads the page preserving scroll position.
3. **Watch mode** (`--watch`): Watch input files for changes. Combined with `--serve`, auto-rebuilds and live-reloads. Without `--serve`, writes to the output file on each change.

---

## 8. Roundtrip: Extract

`claude-replay extract <replay.html>` reverses the process:
- Pattern-matches the embedded data blobs in the HTML
- Decompresses and parses the turn data and bookmarks
- Outputs JSONL or JSON, suitable for re-processing or analysis

This enables a full roundtrip: session → replay HTML → extracted data → re-generated replay.

---

## 9. Web Editor

When invoked with no arguments (or `claude-replay editor`), an HTTP server starts on port 7331 serving `template/editor.html` — a full web-based editor for browsing, editing, and previewing sessions. The editor server (`src/editor-server.mjs`) provides a REST API for session discovery, editing, and export, with in-memory session storage and autosave to `~/.claude-replay/autosave/`.

---

## Summary

claude-replay's architecture can be summarized as:

1. **Parse** diverse agent log formats into a **unified data model** (Turn[])
2. **Process** the data (filter, redact, time, concatenate)
3. **Compress** and **embed** the data into an HTML template
4. **Playback** via progressive DOM reveal with timestamp-driven timing

The key insight is that it treats replay as a **data transformation problem** (multi-format parsing → normalization → rendering) rather than a **re-execution problem**. The output is a static HTML file that requires no server, no runtime, and no external dependencies — the entire session is embedded and replayed client-side.
