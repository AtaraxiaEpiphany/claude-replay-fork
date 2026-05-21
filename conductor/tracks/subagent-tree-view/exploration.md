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

## Read and document the exact shape of agent-*.jsonl files (confirm isSidechain, agentId fields) | 2026-05-21T23:35Z

### Summary

Analyzed 29 real `agent-*.jsonl` files across 4 project directories (1177 total entries: 670 assistant, 487 user, 20 attachment). The agent JSONL format is identical to the main session Claude Code JSONL format in its core `{ type, message, timestamp }` structure, with the addition of two subagent-specific fields (`isSidechain: true`, `agentId: "<hex-id>"`) present on every entry. Three entry types exist: `user`, `assistant`, and `attachment`. The existing `claude-code.mjs` parser handles agent JSONL files without any modification.

### Key Findings

- **`isSidechain` is ALWAYS `true`** on every entry in every agent JSONL file (verified across all 1177 entries in 29 files). This is the defining marker that distinguishes subagent entries from main session entries. Main session entries always have `isSidechain: false` (or omit the field).
- **`agentId` is ALWAYS present** on every entry, and is always the same value within a single file (e.g., all entries in `agent-a7a843e00d424af42.jsonl` have `agentId: "a7a843e00d424af42"`). The agentId matches the `<id>` portion of the filename `agent-<id>.jsonl` and the companion `agent-<id>.meta.json`.
- **Three entry types observed**: `user` (487 entries), `assistant` (670 entries), `attachment` (20 entries). The `attachment` type does NOT exist in main session JSONL as a core conversation entry type (main session has different auxiliary types like `file-history-snapshot`, `last-prompt`, `permission-mode`).
- **`attachment` entries are metadata-only**: They carry a `skill_listing` payload (`{ type: "skill_listing", content: string, skillCount: number, isInitial: boolean }`) that lists available skills/plugins. These are NOT user/assistant messages and the existing parser correctly skips them (since `parseEntries` only keeps `type === "user"` or `type === "assistant"`).
- **Parser compatibility confirmed**: The existing `claude-code.mjs` parser's `parseEntries()` function filters on `obj.type === "user" || obj.type === "assistant"`, which correctly processes the agent JSONL entries. The extra fields (`isSidechain`, `agentId`, `attributionAgent`, etc.) are simply ignored.
- **`attributionAgent` is ALWAYS present on assistant entries** (670/670 = 100%). Observed values: `"Explore"` (343), `"conductor:explorer"` (182), `"claude"` (67), `"conductor:task-executor"` (40), `"conductor:spec-planner"` (29), `"conductor:project-analyzer"` (13), `"conductor:spec-reviewer"` (4). This could serve as a fallback source for the agent type label if the meta file is missing.
- **`promptId` is on ALL user entries** (487/487) but NEVER on assistant entries (0/670). This mirrors the main session pattern.
- **Main session vs agent session key difference**: Main session entries have `isSidechain: false` and lack `agentId`. Main session also has auxiliary entry types (`file-history-snapshot`, `last-prompt`, `permission-mode`) that agent sessions do not have. Agent sessions have `attachment` entries (skill listings) that main sessions also have but as a different pattern.

### Architecture

**Canonical entry shapes** (TypeScript notation):

```typescript
// Base fields present on ALL entry types in agent JSONL
interface AgentEntryBase {
  type: "user" | "assistant" | "attachment";
  isSidechain: true;                           // ALWAYS true in agent files
  agentId: string;                             // e.g., "a7a843e00d424af42"
  parentUuid: string | null;                   // null for first entry, UUID thereafter
  uuid: string;                                // unique entry identifier
  timestamp: string;                           // ISO 8601
  sessionId: string;                           // parent session ID
  cwd: string;                                 // working directory
  userType: "external";                        // always "external"
  entrypoint: "cli";                           // always "cli"
  gitBranch: string;
  version: string;                             // e.g., "2.1.146"
}

// User entry (tool results and text)
interface AgentUserEntry extends AgentEntryBase {
  type: "user";
  message: {
    role: "user";
    content: string | ToolResultBlock[];       // string for initial prompt, array for tool results
  };
  promptId: string;                            // ALWAYS present on user entries
  sourceToolAssistantUUID?: string;            // present when content is tool_result (points to triggering assistant entry)
  // Rare optional fields:
  isMeta?: boolean;                            // 0.2% of user entries (meta/system messages)
  sourceToolUseID?: string;                    // co-occurs with isMeta
  toolUseResult?: string;                      // 2.2% of user entries (error summary)
}

// Assistant entry (text, thinking, tool_use blocks)
interface AgentAssistantEntry extends AgentEntryBase {
  type: "assistant";
  message: {
    id: string;                                // message ID (e.g., "msg_1779368148165")
    type: "message";
    role: "assistant";
    content: TextBlock[] | ThinkingBlock[] | ToolUseBlock[];
    model: string;                             // e.g., "doubao-seed-2-0-pro-260215", "glm-5-turbo"
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: object;
  };
  attributionAgent: string;                    // ALWAYS present (agent type that produced this)
  attributionSkill?: string;                   // 52.8% of assistant entries
  attributionPlugin?: string;                  // 39.2% of assistant entries
}

// Attachment entry (skill/plugin listing - metadata, not conversation)
interface AgentAttachmentEntry extends AgentEntryBase {
  type: "attachment";
  attachment: {
    type: string;                              // observed: "skill_listing"
    content: string;                           // large text blob listing available skills
    skillCount?: number;                       // for skill_listing type
    isInitial?: boolean;                       // for skill_listing type
  };
}

// Content block shapes (same as main session)
interface TextBlock { type: "text"; text: string; }
interface ThinkingBlock { type: "thinking"; thinking: string; signature: string; }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: object; }
interface ToolResultBlock { type: "tool_result"; tool_use_id: string; content: string | TextBlock[]; is_error?: boolean; }
```

**Field presence matrix** (across 1177 entries in 29 files):

| Field | user (487) | assistant (670) | attachment (20) |
|-------|-----------|----------------|----------------|
| `isSidechain` | 100% (always true) | 100% (always true) | 100% (always true) |
| `agentId` | 100% | 100% | 100% |
| `type` | 100% | 100% | 100% |
| `message` | 100% | 100% | -- |
| `timestamp` | 100% | 100% | 100% |
| `uuid` | 100% | 100% | 100% |
| `parentUuid` | 100% | 100% | 100% |
| `sessionId` | 100% | 100% | 100% |
| `promptId` | 100% | 0% | -- |
| `attributionAgent` | -- | 100% | -- |
| `attributionSkill` | -- | 52.8% | -- |
| `attributionPlugin` | -- | 39.2% | -- |
| `attachment` | -- | -- | 100% |
| `sourceToolAssistantUUID` | ~98% | -- | -- |
| `slug` | 4.3% | 4.6% | 10.0% |
| `toolUseResult` | 2.2% | -- | -- |
| `isMeta` | 0.2% | -- | -- |
| `sourceToolUseID` | 0.2% | -- | -- |

### Gotchas & Constraints

- **`attachment` entries must be skipped**: The existing parser correctly skips them because `parseEntries()` only keeps `type === "user" || type === "assistant"`. If any future parser change adds `attachment` handling, it must not treat `attachment` entries as user messages.
- **`isSidechain: true` is reliable for filtering**: If the discovery module needs to validate that a JSONL file is a subagent file, checking that the first entry has `isSidechain === true` is a reliable detection method.
- **`attributionAgent` is NOT the same as `agentType` from meta.json**: The meta `agentType` is set by the conductor plugin (e.g., `"conductor:explorer"`, `"Explore"`), while the JSONL `attributionAgent` is set by the agent's model attribution. They often overlap but are independent fields. For tree-node headers, use the meta `agentType` as the canonical source (per spec FR-8).
- **`toolUseResult` field is a rare shortcut**: Present on only 2.2% of user entries, it duplicates error information that is also available in the `message.content` tool_result block. The parser should ignore this field and rely on the standard `tool_result.content` path.
- **`slug` field appears sporadically**: Present on ~4-10% of entries. Unknown purpose. Should be ignored.
- **User `content` can be string OR array**: The first user entry in each agent file has `content` as a plain string (the initial prompt). All subsequent user entries have `content` as an array of `tool_result` blocks. The existing parser's `extractText()` and `isToolResultOnly()` handle both cases correctly.
- **Agent JSONL files contain tool calls to any tool**: Not limited to specific tools. Observed tools include `Read`, `Bash`, `Grep`, `Glob`, `Write`, `Edit` -- the full standard set. The existing `buildTurnsFromEntries` handles all of these.

### Files Inventory

| Path | Purpose | Key Exports | Related Docs |
|------|---------|-------------|--------------|
| `~/.claude/projects/<proj>/<id>/subagents/agent-<id>.jsonl` | Subagent session transcript (same core format as main session with extra fields) | N/A (data file) | spec.md FR-3 |
| `src/formats/claude-code.mjs` | Parser that handles both main and agent JSONL | `parse`, `detect`, `parseEntries` | spec.md FR-3 |
| `src/formats/shared.mjs` | `buildTurnsFromEntries` works on agent entries unchanged | `buildTurnsFromEntries` | spec.md FR-3, FR-4 |

### Recommended Approach

1. **No parser changes needed**: The existing `claude-code.mjs` parser's `parseEntries()` function already correctly handles agent JSONL files. It filters on `type === "user" || type === "assistant"`, which captures all conversational entries and correctly skips `attachment` entries.
2. **Validation pattern for subagent detection**: If needed, validate a file is a subagent JSONL by checking the first parsed entry for `isSidechain === true`.
3. **Agent ID extraction**: Read the `agentId` from the first entry of the JSONL file. It will be the same across all entries. Alternatively, extract it from the filename (`agent-<id>.jsonl`).
4. **Tool call extraction**: Use the existing full pipeline: `parseEntries(text)` -> `buildTurnsFromEntries(entries)` to get `Turn[]`. Extract `ToolCall` objects from the resulting turns' blocks where `kind === "tool_use"`. These are the internal tool operations to display in the tree view.
5. **Anti-pattern**: Do NOT attempt to manually parse individual JSONL lines to extract tool calls. Always use the existing parser pipeline for consistency and correctness.

### Out-of-Scope Notes

- The `attachment` entry type with `skill_listing` data is not needed for tree-view rendering. It contains metadata about available skills/plugins at the time the agent was invoked, which is informational only.
- The `attributionAgent` field on assistant entries could theoretically be used as a fallback agent type label if the meta file is missing, but this is not required by the current spec.
- Nested subagents (agents that themselves spawn further agents) would produce their own `agent-*.jsonl` files in the same `subagents/` directory. The spec explicitly excludes nested subagent support, so only one level of agent JSONL parsing is needed.
