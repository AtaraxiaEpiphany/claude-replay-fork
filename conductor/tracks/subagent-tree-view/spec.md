# Specification: Support Subagent (Agent Tool) Parallel Tree-View Display in HTML Replays

## Overview

Extend claude-replay to discover, parse, and render Claude Code subagent sessions alongside the main session transcript. When an Agent tool call is encountered in the main session, the tool's internal operations (discovered from subagent JSONL files) are displayed as a parallel tree structure showing all tools used within each Agent call.

## Type
feature

## Requirements

### Functional Requirements

- FR-1: Discover subagent JSONL files and meta files from the `subagents/` directory adjacent to the main session JSONL file. Subagent files are located at `~/.claude/projects/.../<session-id>/subagents/agent-<agent-id>.jsonl` with corresponding meta files at `agent-<agent-id>.meta.json`. ([Architecture Report](docs/ARCHITECTURE_REPORT.md))
- FR-2: Parse subagent meta files to extract `{ agentType, description, toolUseId }` and link each subagent back to its parent Agent tool call in the main session via `toolUseId`. ([Claude Code Parser](src/formats/claude-code.mjs))
- FR-3: Parse subagent JSONL files using the existing Claude Code parser (`buildTurnsFromEntries`), since the subagent JSONL format is identical to the main session format: `{ type: "user"|"assistant", message: { content: [...] }, timestamp, agentId, isSidechain: true }`. ([Shared Parser Utilities](src/formats/shared.mjs))
- FR-4: Extend the canonical `ToolCall` data model to carry subagent information. Add an optional `subagent` field to `ToolCall` containing the parsed subagent tool calls (a simplified representation of the subagent's internal operations). ([Canonical Data Model](src/formats/shared.mjs))
- FR-5: When the CLI resolves a Claude Code session, automatically discover and load associated subagent files from the same session directory. ([Session Resolver](src/resolve-session.mjs), [CLI Entry Point](bin/claude-replay.mjs))
- FR-6: Render Agent tool calls in the HTML player as expandable tree nodes, where each Agent node shows its internal tool calls as indented children in a parallel tree layout. ([HTML Player Template](template/player.html))
- FR-7: When multiple Agent calls appear in the same turn, display their tool call trees side-by-side (or stacked) to convey parallel execution. ([HTML Player Template](template/player.html))
- FR-8: The Agent tree node header should display the agent type/description (e.g., "Agent (Explore)" or "Agent (Plan)") derived from the subagent meta file's `description` field or the Agent tool's `input.description`. ([HTML Player Template](template/player.html))
- FR-9: Preserve the existing renderer serialization pipeline: subagent data embedded in the turn data must be compressed (deflate+base64) and injected into the HTML template alongside existing data. ([Renderer](src/renderer.mjs))
- FR-10: Gracefully degrade when subagent files are not found (e.g., when processing a plain JSONL file not in a session directory, or when using other format parsers). The Agent tool call should still render as a regular tool call showing input and result. ([Parser](src/parser.mjs))

### Non-Functional Requirements

- NFR-1: Zero new runtime dependencies -- subagent parsing reuses existing `buildTurnsFromEntries` from `shared.mjs`.
- NFR-2: Backward compatibility -- existing replays and other format parsers (Cursor, Codex, Gemini, OpenCode) must be unaffected.
- NFR-3: The HTML output must remain self-contained; all subagent data is embedded in the generated HTML file.
- NFR-4: Performance -- subagent discovery and parsing should not add noticeable latency to the replay build process.

## Acceptance Criteria

- AC-1: Given a Claude Code session with subagent JSONL files, the CLI discovers and parses all subagent data, linking each subagent to its parent Agent tool call via `toolUseId`.
- AC-2: Agent tool calls in the generated HTML display as expandable tree nodes showing internal tool operations as indented children.
- AC-3: Multiple Agent calls in the same turn render as parallel tree structures, each showing its own internal tools.
- AC-4: When no subagent files exist, Agent tool calls render as standard tool calls with input/result, and the replay builds without errors.
- AC-5: Non-Claude-Code formats (Cursor, Codex, Gemini, OpenCode) continue to work identically, with no change in output.
- AC-6: Existing unit tests and E2E tests pass without modification.

## Test Scenarios

| ID | AC Ref | Scenario | Expected Outcome |
| -- | ------ | --------- | ---------------- |
| TC-1.1 | AC-1 | Parse main session JSONL with 2 subagent meta+JSONL files present | Both subagents parsed, each linked to correct Agent tool call by toolUseId |
| TC-1.2 | AC-1 | Subagent JSONL file referenced by meta file does not exist | Graceful degradation -- Agent tool call has no subagent data, no crash |
| TC-1.3 | AC-1 | Meta file contains toolUseId that matches no Agent tool call in main session | Meta file ignored, no error |
| TC-2.1 | AC-2 | Render Agent tool call with 3 internal tools (Bash, Read, Grep) | HTML contains expandable tree node with 3 indented child tool blocks |
| TC-2.2 | AC-2 | Agent tool call with no subagent data (standalone JSONL input) | Renders as standard tool call with input/result fields |
| TC-3.1 | AC-3 | Turn with 3 concurrent Agent calls, each with different internal tools | HTML shows 3 parallel tree structures, each with correct child tools |
| TC-3.2 | AC-3 | Two Agent calls launched simultaneously (same timestamps) | Both rendered as parallel trees, visually distinct |
| TC-4.1 | AC-4 | Replay built from JSONL file in arbitrary directory (no subagents dir) | Builds successfully, Agent calls render as regular tools |
| TC-4.2 | AC-4 | Replay built with `--no-auto-redact` or other flags | Subagent data respects all existing CLI flags |
| TC-5.1 | AC-5 | Parse Cursor format JSONL -- no Agent awareness | Output identical to current behavior |
| TC-5.2 | AC-5 | Parse Codex CLI JSONL -- no Agent awareness | Output identical to current behavior |
| TC-6.1 | AC-6 | Run existing `test/test-parser.mjs` suite | All tests pass |
| TC-6.2 | AC-6 | Run existing `test/test-renderer.mjs` suite | All tests pass |

## Constraints

- Zero runtime dependencies (project constraint from [Product Guidelines](conductor/overview/product-guidelines.md))
- ESM only, `.mjs` file extension ([Tech Stack](conductor/design/tech-stack.md))
- Node.js >= 18 ([Tech Stack](conductor/design/tech-stack.md))
- Subagent discovery is only applicable to Claude Code format sessions stored in `~/.claude/projects/` directory structure. Other formats (Cursor, Codex, Gemini, OpenCode) do not have subagent files.
- The subagent data must be serializable into the existing turn data pipeline (JSON-compatible).

## Out of Scope

- **Non-Claude-Code subagent formats** -- Only Claude Code sessions have subagent JSONL files. Other formats (Cursor, Codex, Gemini, OpenCode) will not receive subagent support.
- **Nested subagent support** -- Subagents that themselves spawn further subagents (recursive agents) are not supported in this iteration. Only one level of Agent tree depth is rendered.
- **Real-time subagent streaming** -- Live monitoring of subagent execution during `--watch`/`--serve` mode is deferred to a future track.
- **Subagent-specific filtering** -- CLI flags to filter/hide subagent content (e.g., `--no-subagents`) is deferred to a future track.
- **Editor UI subagent support** -- The web editor (`src/editor-server.mjs`) will not gain subagent browsing/editing capabilities in this track.
- **Subagent timeline synchronization** -- Precise timeline alignment between parallel subagent execution and the main session timeline is out of scope.

## References

### Project Context
- [Architecture Report](docs/ARCHITECTURE_REPORT.md) -- Full pipeline description: parse, process, compress, embed, playback
- [Tech Stack](conductor/design/tech-stack.md) -- ESM, Node.js >= 18, zero runtime deps
- [Product Guidelines](conductor/overview/product-guidelines.md) -- Design constraints and scope boundaries

### Source Code (Core Pipeline)
- [Canonical Data Model](src/formats/shared.mjs) -- Turn, AssistantBlock, ToolCall types and buildTurnsFromEntries
- [Claude Code Parser](src/formats/claude-code.mjs) -- Simplest parser, delegates to shared utilities
- [Format Registry](src/formats/index.mjs) -- Plugin architecture, detection ordering
- [Session Resolver](src/resolve-session.mjs) -- Session ID to file path resolution
- [Parser Facade](src/parser.mjs) -- Public API for parseTranscript, filterTurns
- [Renderer](src/renderer.mjs) -- Turn serialization, compression, template injection
- [CLI Entry Point](bin/claude-replay.mjs) -- Argument parsing, build pipeline, serve/watch modes

### Source Code (Player)
- [HTML Player Template](template/player.html) -- Browser-side playback engine, DOM rendering, tool block rendering
