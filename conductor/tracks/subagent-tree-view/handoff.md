# Handoff: subagent-tree_20260521

**Track ID**: subagent-tree_20260521
**Description**: Support subagent (Agent tool) parallel tree-view display in HTML replays
**Status**: Phase 1/6 | 31 tasks remaining
**Updated**: 2026-05-21T15:34:55.094318+00:00

---

## Execution Summary

| Metric | Value |
|--------|-------|
| Completed | 6/37 tasks |
| Failed | 0 tasks |
| Skipped | 0 tasks |
| Blocked | 0 tasks |

### Current Focus
**Phase 1**: Next task
**Next**: Extend the ToolCall type definition in src/formats/shared.mjs to support an optional subagent field containing parsed internal tool calls

### Risk Radar

---

## Phase Index

### Phase 1: Phase 1: Exploration & Data Model Extension ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | ✅ [Explore] Explore subagent file structure and validate JSONL/meta format assumptions against real Claude Code session data | [P0T0](.conductor/handoff/P0T0.md) |
| 1. | ✅ Extend the ToolCall type definition in src/formats/shared.mjs to support an optional subagent field containing parsed internal tool calls | [P0T1](.conductor/handoff/P0T1.md) |
| 2. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 1 | [P0T2](.conductor/handoff/P0T2.md) |

### Phase 2: Phase 2: Subagent Discovery & Parsing ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | [ ] Create subagent discovery module (src/subagents.mjs) that, given a main session file path, scans the adjacent subagents/ directory for meta and JSONL files | [P1T0](.conductor/handoff/P1T0.md) |
| 1. | [ ] Add unit tests for subagent discovery: meta parsing, JSONL parsing, toolUseId linking, graceful degradation when files missing | [P1T1](.conductor/handoff/P1T1.md) |
| 2. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 2 | [P1T2](.conductor/handoff/P1T2.md) |

### Phase 3: Phase 3: CLI Integration ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | [ ] Integrate subagent discovery into the CLI build pipeline in bin/claude-replay.mjs so that when a Claude Code session is resolved, subagent files are automatically discovered and parsed | [P2T0](.conductor/handoff/P2T0.md) |
| 1. | [ ] Add unit tests for CLI integration: verify subagent data flows through to rendered output, verify no-impact on non-Claude-Code formats | [P2T1](.conductor/handoff/P2T1.md) |
| 2. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 3 | [P2T2](.conductor/handoff/P2T2.md) |

### Phase 4: Phase 4: Renderer Serialization ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | [ ] Update turnsToJsonData in src/renderer.mjs to serialize subagent data from ToolCall.subagent into the embedded JSON, preserving the existing compression and embedding pipeline | [P3T0](.conductor/handoff/P3T0.md) |
| 1. | [ ] Add unit tests for renderer serialization: verify subagent data appears in serialized turns, verify redaction applies | [P3T1](.conductor/handoff/P3T1.md) |
| 2. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 4 | [P3T2](.conductor/handoff/P3T2.md) |

### Phase 5: Phase 5: HTML Player Tree-View Rendering ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | [ ] Add CSS styles for the Agent tree-view in template/player.html: tree node containers, indented child tool blocks, parallel layout for multiple agents | [P4T0](.conductor/handoff/P4T0.md) |
| 1. | [ ] Update the renderTurn function in template/player.html to detect Agent tool calls with subagent data and render them as expandable tree nodes instead of standard tool blocks | [P4T1](.conductor/handoff/P4T1.md) |
| 2. | [ ] Update the tool grouping logic in renderTurn to handle Agent tool calls (which contain sub-tool-calls) correctly within the consecutive tool call grouping | [P4T2](.conductor/handoff/P4T2.md) |
| 3. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 5 | [P4T3](.conductor/handoff/P4T3.md) |

### Phase 6: Phase 6: Playback Engine Integration & Final Testing ⏸️

| # | Task | Details |
|---|------|---------|
| 0. | [ ] Update the animateTurn and block reveal logic in template/player.html to handle Agent tree blocks: when an Agent tree node is revealed, all its child tool blocks should be revealed as a single animation unit | [P5T0](.conductor/handoff/P5T0.md) |
| 1. | [ ] Add comprehensive unit tests for the full pipeline: synthetic Claude Code session with subagents -> parse -> serialize -> verify HTML output contains tree structure | [P5T1](.conductor/handoff/P5T1.md) |
| 2. | [ ] Run full test suite (unit + E2E) and verify all existing tests pass with no regressions | [P5T2](.conductor/handoff/P5T2.md) |
| 3. | [ ] [Manual] Task: Conductor - User Manual Verification Phase 6 | [P5T3](.conductor/handoff/P5T3.md) |

---

## Risks & Coordination

*See individual task handoff files for details.*


---

## Technical Decisions

*See .conductor/handoff/decisions.md for details.*


---

## Deviation Report

*See individual task handoff files for deviations.*
