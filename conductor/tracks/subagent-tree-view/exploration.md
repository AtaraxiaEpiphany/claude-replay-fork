## Locate a real Claude Code session directory with subagents, or create synthetic fixtures | 2026-05-21T22:59Z

### Summary

Real Claude Code session directories with subagent files have been located at `~/.claude/projects/`. Multiple sessions with varying numbers of subagents (1 to 5 agents) are available. The exact file structures and data formats of meta.json files and subagent JSONL files have been validated against the spec. No code changes or synthetic fixture creation are needed for this exploration task -- the real data confirms all spec assumptions.

### Key Findings

- **Real sessions confirmed**: At least 8 session directories contain subagent files across 3 project directories under `~/.claude/projects/`.
- **Meta file shape**: `{"agentType": string, "description": string, "toolUseId": string}` -- exactly matches spec FR-2.
- **Subagent JSONL shape**: Identical to main session Claude Code JSONL format, with additional fields `isSidechain: true` and `agentId: "<hex-id>"` on every entry. Confirmed compatible with existing `buildTurnsFromEntries`.
- **toolUseId linkage verified**: All 5 meta files in session `819d412b` have toolUseId values that match exactly with the `id` field of `type: "tool_use"` blocks where `name: "Agent"` in the main session JSONL.
- **Agent tool input shape**: `{"description": string, "prompt": string, "subagent_type": string}` -- the `description` and `subagent_type` fields can be used for tree-node headers.
- **No existing Agent/subagent handling**: `grep -rn "Agent\|subagent" src/` returns zero results (excluding the spec/conductor docs). The current codebase treats "Agent" as just another tool name.
- **Directory structure**: Main session JSONL is at `<project-dir>/<session-id>.jsonl`. Subagents are at `<project-dir>/<session-id>/subagents/agent-<id>.{meta.json,jsonl}`.

### Architecture

```
~/.claude/projects/<encoded-project-path>/
  +-- <session-id>.jsonl                    # Main session transcript (Claude Code JSONL)
  +-- <session-id>/                         # Session directory
  |   +-- subagents/                        # Subagent files directory
  |       +-- agent-<agent-id>.meta.json    # {agentType, description, toolUseId}
  |       +-- agent-<agent-id>.jsonl        # Subagent session (same format as main)
  |       +-- ...
  +-- <other-session>.jsonl
  +-- <other-session>/
```

**Data linkage chain**:
1. Main session JSONL has `tool_use` blocks with `name: "Agent"` and `id: "call_XXXX"`
2. `agent-<id>.meta.json` contains `toolUseId: "call_XXXX"` -- this is the link key
3. `agent-<id>.jsonl` contains the full subagent transcript with `isSidechain: true` and `agentId: "<id>"`

**Available real sessions** (for testing/development):

| Session ID | Project | Agent Count | Agent Types |
|---|---|---|---|
| `819d412b-bb36-461e-8c93-b0c04bd41101` | claude-replay-fork | 5 | project-analyzer, Explore, spec-planner, spec-reviewer, task-executor |
| `9b3c1b1e-1f0c-4c8c-8a40-12b70cfbcc5a` | claude-replay-fork | 2 | (need investigation) |
| `386b14d3-284b-4adc-8fd0-a02d1605e0e7` | claude-replay-fork | 1 | (need investigation) |
| `86ae4f41-12b8-4366-8781-e648a6da3702` | conductor-plugin | 5 | (need investigation) |
| `45589222-2a40-4cd6-ac8f-3ee1ce1bbecb` | conductor-plugin | 1 | (need investigation) |
| `37dfdade-1602-41b6-ba94-711a342915c2` | conductor-plugin | 3 | (need investigation) |
| `0c261f99-eedd-4f5e-b8bf-119bb535d702` | conductor-plugin | 4 | (need investigation) |
| `ed1d0917-1f0b-4283-aabd-f3cba42e3505` | qwen-code | 4 | (need investigation) |

### Gotchas & Constraints

- **Main JSONL location is NOT inside the session directory**: The main `<session-id>.jsonl` file is at the project level, one directory UP from the `<session-id>/subagents/` directory. The discovery module must derive the session directory path from the JSONL file path (strip `.jsonl` extension to get the directory path).
- **No `.jsonl` extension on agent files**: Agent JSONL files follow the pattern `agent-<id>.jsonl` (they DO have .jsonl extension). The `<id>` portion after `agent-` is the `agentId` found in the JSONL entries.
- **Agent tool results in main session**: The main session contains a `tool_result` entry for each Agent call, but the content is just a summary. The detailed tool calls are ONLY in the subagent JSONL files.
- **Subagent entries have extra fields**: `isSidechain: true`, `agentId`, `attributionAgent`, `attributionSkill`, `attributionPlugin` -- these are not in the main session entries but should be ignored by the existing parser since it only looks at `type`, `message`, and `timestamp`.
- **Session without subagents**: Some sessions have no `subagents/` directory at all. The discovery module must handle this gracefully (return empty array).
- **Meta file naming convention**: `agent-<agentId>.meta.json` where `<agentId>` is a hex string with a leading `a` (observed pattern: always starts with 'a' followed by hex chars). The same `<agentId>` appears in the JSONL `agentId` field.
- **Zero runtime dependencies**: Must use existing `buildTurnsFromEntries` from `shared.mjs` for subagent parsing. Cannot add new npm packages.
- **The existing claude-code.mjs parser already works for subagent JSONL**: Since `parseEntries()` only filters on `obj.type === "user" || obj.type === "assistant"`, and subagent JSONL entries have the same type field, the existing parser should handle them without modification.

### Files Inventory

| Path | Purpose | Key Exports | Related Docs |
|------|---------|-------------|--------------|
| `~/.claude/projects/<proj>/<id>.jsonl` | Main Claude Code session transcript | N/A (data file) | spec.md FR-1 |
| `~/.claude/projects/<proj>/<id>/subagents/agent-<id>.meta.json` | Subagent metadata | N/A (data file) | spec.md FR-2 |
| `~/.claude/projects/<proj>/<id>/subagents/agent-<id>.jsonl` | Subagent session transcript | N/A (data file) | spec.md FR-3 |
| `src/formats/shared.mjs` | Canonical data model + buildTurnsFromEntries | `buildTurnsFromEntries`, `ToolCall`, `AssistantBlock`, `Turn` | spec.md FR-4 |
| `src/formats/claude-code.mjs` | Claude Code parser (delegates to shared) | `parse`, `detect`, `name` | spec.md FR-3 |
| `src/resolve-session.mjs` | Session ID to file path resolution | `resolveSessionId` | spec.md FR-5 |
| `bin/claude-replay.mjs` | CLI entry point with buildReplay pipeline | `buildReplay` | spec.md FR-5 |
| `src/parser.mjs` | Public parser API facade | `parseTranscript`, `filterTurns`, `applyPacedTiming` | spec.md |
| `src/renderer.mjs` | Turn serialization + HTML generation | N/A | spec.md FR-9 |
| `template/player.html` | HTML player with tool-group rendering | N/A (browser) | spec.md FR-6 |
| `test/fixture.jsonl` | Existing test fixture (no subagents) | N/A | test fixture |

### Recommended Approach

1. **For synthetic test fixtures**: Create a minimal `test/fixture-subagent-session/` directory structure that mirrors the real `~/.claude/projects/` layout but with synthetic data. This avoids coupling tests to real user data. Structure:
   - `test/fixture-subagent-session/main.jsonl` -- main session with 2 Agent tool_use blocks
   - `test/fixture-subagent-session/subagents/agent-test001.meta.json`
   - `test/fixture-subagent-session/subagents/agent-test001.jsonl`
   - `test/fixture-subagent-session/subagents/agent-test002.meta.json`
   - `test/fixture-subagent-session/subagents/agent-test002.jsonl`

2. **Discovery module pattern**: Given a main JSONL file path, derive the subagents directory by:
   ```javascript
   const sessionDir = mainPath.replace(/\.jsonl$/, '');
   const subagentsDir = path.join(sessionDir, 'subagents');
   ```
   This works because the real structure places `<id>.jsonl` alongside `<id>/subagents/`.

3. **Reuse existing parser**: Subagent JSONL files can be parsed directly using `parseEntries()` from `claude-code.mjs` followed by `buildTurnsFromEntries()` from `shared.mjs`. No new parsing logic needed.

4. **Anti-pattern to avoid**: Do NOT parse the meta JSONL line-by-line manually. Use the existing JSONL parsing pattern (split by newline, JSON.parse each line).

### Out-of-Scope Notes

- **Nested subagents**: Some subagent sessions might themselves spawn further subagents (recursive agents). The spec explicitly excludes nested subagent support. Implementation should ignore any subagent JSONL that contains Agent tool_use blocks pointing to further sub-subagents.
- **Session without main JSONL**: Session `819d412b` initially appeared to lack a main JSONL file, but it was found at the project level (not inside the session directory). This is a critical path resolution detail for the discovery module.
- **Non-Claude-Code subagent formats**: The spec explicitly scopes subagent support to Claude Code only. Other formats (Cursor, Codex, Gemini, OpenCode) do not have subagent directory structures.
