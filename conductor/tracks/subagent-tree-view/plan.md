# Implementation Plan: Support Subagent (Agent Tool) Parallel Tree-View Display in HTML Replays

## Phase 1: Exploration & Data Model Extension
- [x] [Explore] Explore subagent file structure and validate JSONL/meta format assumptions against real Claude Code session data <!-- AC-1, TC-1.1 --> [0b1c8b6]
  - [x] Locate a real Claude Code session directory with subagents, or create synthetic fixtures [27d04d1]
  - [x] Read and document the exact shape of agent-*.meta.json files [193dc2c]
  - [x] Read and document the exact shape of agent-*.jsonl files (confirm isSidechain, agentId fields) [6aa5c64]
  - [x] Verify the toolUseId linkage between meta.json and main session tool_use blocks [0b1c8b6]
- [ ] Extend the ToolCall type definition in src/formats/shared.mjs to support an optional subagent field containing parsed internal tool calls <!-- AC-1, TC-1.1, TC-1.2 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in task-workflow.md)

## Phase 2: Subagent Discovery & Parsing
- [ ] Create subagent discovery module (src/subagents.mjs) that, given a main session file path, scans the adjacent subagents/ directory for meta and JSONL files <!-- AC-1, TC-1.1, TC-1.2, TC-1.3 -->
  - [ ] Implement discoverSubagents(mainSessionPath) returning array of { agentId, meta, jsonlPath }
  - [ ] Implement parseSubagentMeta(metaFilePath) returning { agentType, description, toolUseId }
  - [ ] Implement linkSubagents(turns, subagentData) that attaches parsed subagent tool calls to matching Agent ToolCall blocks
- [ ] Add unit tests for subagent discovery: meta parsing, JSONL parsing, toolUseId linking, graceful degradation when files missing <!-- AC-1, AC-4, TC-1.1, TC-1.2, TC-1.3, TC-4.1 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in task-workflow.md)

## Phase 3: CLI Integration
- [ ] Integrate subagent discovery into the CLI build pipeline in bin/claude-replay.mjs so that when a Claude Code session is resolved, subagent files are automatically discovered and parsed <!-- AC-1, TC-1.1, TC-4.1, TC-4.2 -->
  - [ ] Add subagent discovery call after parseTranscript in buildReplay function
  - [ ] Only invoke subagent discovery for Claude Code format sessions
  - [ ] Pass subagent-enriched turns through existing filterTurns, applyPacedTiming, and render pipeline unchanged
- [ ] Add unit tests for CLI integration: verify subagent data flows through to rendered output, verify no-impact on non-Claude-Code formats <!-- AC-5, TC-5.1, TC-5.2 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in task-workflow.md)

## Phase 4: Renderer Serialization
- [ ] Update turnsToJsonData in src/renderer.mjs to serialize subagent data from ToolCall.subagent into the embedded JSON, preserving the existing compression and embedding pipeline <!-- AC-2, TC-2.1 -->
  - [ ] Add subagent field serialization to the tool_call block in turnsToJsonData
  - [ ] Ensure secret redaction applies to subagent tool call input/result strings
- [ ] Add unit tests for renderer serialization: verify subagent data appears in serialized turns, verify redaction applies <!-- AC-2, TC-4.2 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in task-workflow.md)

## Phase 5: HTML Player Tree-View Rendering
- [ ] Add CSS styles for the Agent tree-view in template/player.html: tree node containers, indented child tool blocks, parallel layout for multiple agents <!-- AC-2, AC-3, TC-2.1, TC-3.1, TC-3.2 -->
  - [ ] Add .agent-tree, .agent-node, .agent-children CSS classes with indentation and tree lines
  - [ ] Add parallel layout styles for side-by-side agent trees when multiple agents appear in same turn
- [ ] Update the renderTurn function in template/player.html to detect Agent tool calls with subagent data and render them as expandable tree nodes instead of standard tool blocks <!-- AC-2, AC-3, TC-2.1, TC-2.2, TC-3.1 -->
  - [ ] Add agent tree rendering: header shows "Agent (type/description)", children show internal tool calls as indented blocks
  - [ ] Each internal tool call in the tree should be rendered using existing tool block rendering (formatToolBody)
  - [ ] Ensure Agent tool calls without subagent data fall back to standard tool block rendering
- [ ] Update the tool grouping logic in renderTurn to handle Agent tool calls (which contain sub-tool-calls) correctly within the consecutive tool call grouping <!-- AC-2, TC-2.1 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 5' (Protocol in task-workflow.md)

## Phase 6: Playback Engine Integration & Final Testing
- [ ] Update the animateTurn and block reveal logic in template/player.html to handle Agent tree blocks: when an Agent tree node is revealed, all its child tool blocks should be revealed as a single animation unit <!-- AC-2, TC-2.1 -->
- [ ] Add comprehensive unit tests for the full pipeline: synthetic Claude Code session with subagents -> parse -> serialize -> verify HTML output contains tree structure <!-- AC-1 through AC-6, TC-1.1, TC-2.1, TC-3.1, TC-4.1, TC-5.1, TC-6.1, TC-6.2 -->
- [ ] Run full test suite (unit + E2E) and verify all existing tests pass with no regressions <!-- AC-6, TC-6.1, TC-6.2 -->
- [ ] [Manual] Task: Conductor - User Manual Verification 'Phase 6' (Protocol in task-workflow.md)
