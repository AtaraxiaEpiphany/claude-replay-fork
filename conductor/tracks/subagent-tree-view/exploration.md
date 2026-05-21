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

## Read and document the exact shape of agent-*.meta.json files | 2026-05-21T23:12Z

### Summary

Examined 28 real `agent-*.meta.json` files across 4 project directories under `~/.claude/projects/`. All files conform to an identical, flat 3-field JSON schema with no variation in field names, types, or structure. The format is stable and simple enough for direct `JSON.parse()` consumption.

### Key Findings

- **Schema is invariant across all 28 observed files**: Every single meta file contains exactly 3 keys: `agentType` (string), `description` (string), `toolUseId` (string). No additional fields, no nesting, no nulls.
- **agentType observed values** (7 unique, in 2 categories):
  - Built-in Claude Code types: `"claude"`, `"Explore"`
  - Conductor plugin types (namespaced): `"conductor:explorer"`, `"conductor:project-analyzer"`, `"conductor:spec-planner"`, `"conductor:spec-reviewer"`, `"conductor:task-executor"`
- **toolUseId format**: Always `"call_"` prefix followed by 24 hex characters, e.g., `"call_4f445696ea9c4445a2c00576"`. This matches the `id` field on `type: "tool_use"` content blocks in the main session JSONL where `name: "Agent"`.
- **description field**: Free-form human-readable string describing the agent's purpose. Ranges from 3 words ("Efficiency review") to longer phrases ("Review spec/plan for subagent tree view"). Matches the `input.description` field of the corresponding Agent tool_use block in the main session.
- **File naming**: `agent-<agentId>.meta.json` where `<agentId>` is a 17-character hex string always starting with `a`. Same `<agentId>` appears as `agentId` field in the companion JSONL entries.
- **Paired files**: Every `agent-<id>.meta.json` has a sibling `agent-<id>.jsonl` in the same directory. No orphaned meta files were observed.
- **toolUseId linkage is 1:1 verified**: For session `819d412b`, all 5 meta file `toolUseId` values match exactly with 5 Agent tool_use `id` values in the main session JSONL, and vice versa. The linkage is bidirectional and complete.

### Architecture

**Canonical shape** (TypeScript notation):
```typescript
interface AgentMetaFile {
  agentType: string;    // Agent type identifier, e.g., "Explore", "claude", "conductor:explorer"
  description: string;  // Human-readable task description
  toolUseId: string;    // Links to tool_use block in main session: "call_" + 24 hex chars
}
```

**File location pattern**:
```
<project-dir>/<session-id>/subagents/agent-<agentId>.meta.json
```

**Linkage chain** (confirmed with real data):
```
Main session JSONL:
  content[{type:"tool_use", name:"Agent", id:"call_4f445696ea9c4445a2c00576"}]
                                                      |
                                                      v
agent-a7a843e00d424af42.meta.json:
  {"toolUseId":"call_4f445696ea9c4445a2c00576", "agentType":"conductor:project-analyzer", ...}
                                                      |
                                                      v
agent-a7a843e00d424af42.jsonl:
  {agentId:"a7a843e00d424af42", isSidechain:true, ...}
```

**Sample meta files** (representative examples from different agent types):
```json
// Built-in "Explore" type
{"agentType":"Explore","description":"Explore Agent tool handling","toolUseId":"call_d307ff6e39b84de4990a122c"}

// Built-in "claude" type
{"agentType":"claude","description":"Code efficiency review","toolUseId":"call_82bbb490f1154b8e90c92983"}

// Conductor plugin explorer type
{"agentType":"conductor:explorer","description":"Explore agent meta.json format","toolUseId":"call_b9046470995c4cc8a5d70a9b"}

// Conductor plugin task-executor type
{"agentType":"conductor:task-executor","description":"Execute P0.T0 subagent exploration","toolUseId":"call_63793e220c0a44ecb03e393b"}
```

### Gotchas & Constraints

- **agentType is NOT an enum -- it is extensible**: The observed values include built-in Claude types (`"Explore"`, `"claude"`) and plugin-namespaced types (`"conductor:explorer"`). Future plugins may introduce new agentType values. Implementation must treat this as a free-form string, not a closed enum.
- **description field may differ from Agent tool input.description**: While in observed data they match, the meta file `description` and the Agent tool_use `input.description` are stored independently. For tree-node headers, prefer the meta file `description` as the authoritative source (per spec FR-8).
- **File is single-line JSON**: All observed meta files are a single JSON line with no pretty-printing. No trailing newline variation observed. `JSON.parse(fs.readFileSync(path, 'utf8'))` is the correct read pattern.
- **No versioning or schema indicator**: The meta file contains no version field. If the format changes in future Claude Code versions, there is no way to detect it from the file contents alone. Defensive parsing (try/catch, field validation) is recommended.
- **The `a` prefix on agentId**: All observed agent IDs start with `a` and are 17 hex characters long (total with prefix: 18 chars). This is likely an internal Claude Code convention but should not be relied upon for validation -- use the file as the source of truth.

### Files Inventory

| Path | Purpose | Key Exports | Related Docs |
|------|---------|-------------|--------------|
| `~/.claude/projects/<proj>/<id>/subagents/agent-<id>.meta.json` | Subagent metadata: type, description, linkage | N/A (data file, 3-field JSON) | spec.md FR-2 |
| `~/.claude/projects/<proj>/<id>.jsonl` | Main session (contains Agent tool_use blocks with matching `id`) | N/A (data file) | spec.md FR-1, FR-2 |

### Recommended Approach

1. **Parsing**: Use `JSON.parse(fs.readFileSync(metaPath, 'utf8'))` directly. No streaming or line-splitting needed since meta files are single-line JSON.
2. **Schema validation**: After parsing, validate that all 3 fields exist and are non-empty strings. If any field is missing, treat as malformed and skip the subagent gracefully.
3. **Type definition for implementation**:
   ```javascript
   // In src/subagents.mjs
   /**
    * @typedef {Object} AgentMeta
    * @property {string} agentType - Agent type (e.g., "Explore", "conductor:explorer")
    * @property {string} description - Human-readable task description
    * @property {string} toolUseId - Links to main session tool_use block ID
    */
   ```
4. **Discovery pattern**: Scan `subagents/` directory for files matching `agent-*.meta.json` glob, parse each one, then look for sibling `.jsonl` files.
5. **Anti-pattern**: Do NOT assume the meta file always pairs with a valid JSONL. Always check that the companion `.jsonl` file exists and is non-empty before attempting to parse it (spec TC-1.2).

### Out-of-Scope Notes

- The `agentType` values observed are specific to the user's installed plugins (conductor). Different Claude Code users may have entirely different agentType values. The tree-view rendering should display the agentType as-is, possibly with a label transformation (e.g., strip "conductor:" prefix).
