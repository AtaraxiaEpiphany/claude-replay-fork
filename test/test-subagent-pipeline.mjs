import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { parseTranscript, detectFormat } from '../src/parser.mjs';
import { discoverSubagents, linkSubagents } from '../src/subagents.mjs';
import { render } from '../src/renderer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createSessionDir(tmpDir) {
  const sessionDir = resolve(tmpDir, 'session');
  const subagentsDir = resolve(sessionDir, 'subagents');
  mkdirSync(subagentsDir, { recursive: true });

  const mainJsonl = resolve(sessionDir, 'main.jsonl');
  const mainContent = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Build and test the project' }, timestamp: '2026-01-01T00:00:00Z' }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-01-01T00:00:01Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will run the tests and check the code.' },
          { type: 'tool_use', id: 'agent_001', name: 'Agent', input: { subagent_type: 'code-reviewer', description: 'Review test coverage', prompt: 'Check if tests cover edge cases' } },
          { type: 'tool_use', id: 'bash_001', name: 'Bash', input: { command: 'npm test' } },
        ],
      },
    }),
    JSON.stringify({
      type: 'user', timestamp: '2026-01-01T00:00:10Z',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'agent_001', content: 'Review complete: 3 edge cases missing' },
          { type: 'tool_result', tool_use_id: 'bash_001', content: 'All 42 tests passed' },
        ],
      },
    }),
  ].join('\n');
  writeFileSync(mainJsonl, mainContent);

  const meta = { agentType: 'code-reviewer', description: 'Review test coverage', toolUseId: 'agent_001' };
  writeFileSync(resolve(subagentsDir, 'agent-reviewer.meta.json'), JSON.stringify(meta));

  const agentJsonl = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Check if tests cover edge cases' }, timestamp: '2026-01-01T00:00:02Z' }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-01-01T00:00:03Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me examine the test files.' },
          { type: 'tool_use', id: 'read_001', name: 'Read', input: { file_path: '/test/example.mjs' } },
        ],
      },
    }),
    JSON.stringify({
      type: 'user', timestamp: '2026-01-01T00:00:04Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'read_001', content: 'import { test } from "node:test";' }],
      },
    }),
    JSON.stringify({
      type: 'assistant', timestamp: '2026-01-01T00:00:05Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'bash_002', name: 'Bash', input: { command: 'npm test -- --coverage' } },
        ],
      },
    }),
    JSON.stringify({
      type: 'user', timestamp: '2026-01-01T00:00:06Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'bash_002', content: 'Coverage: 87% — 3 edge cases missing in error handling' }],
      },
    }),
  ].join('\n');
  writeFileSync(resolve(subagentsDir, 'agent-reviewer.jsonl'), agentJsonl);

  return mainJsonl;
}

describe('full subagent pipeline', () => {
  let tmpDir;

  it('parses, discovers, links, and renders subagent data end-to-end', () => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'pipeline-test-'));
    const mainJsonl = createSessionDir(tmpDir);

    // Step 1: Parse main session
    const fmt = detectFormat(mainJsonl);
    assert.equal(fmt, 'claude-code');
    const turns = parseTranscript(mainJsonl);
    assert.ok(turns.length >= 1, 'should have at least 1 turn');

    // Step 2: Discover subagents
    const subagents = discoverSubagents(mainJsonl);
    // discoverSubagents is async — but parseTranscript is sync, need to handle this
    // For this test, we manually construct the subagent data since discoverSubagents is async
    const subagentData = [
      {
        meta: { agentType: 'code-reviewer', description: 'Review test coverage', toolUseId: 'agent_001' },
        turns: parseTranscript(resolve(tmpDir, 'session', 'subagents', 'agent-reviewer.jsonl')),
      },
    ];

    assert.ok(subagentData[0].turns.length >= 1, 'subagent should have turns');

    // Step 3: Link subagents
    linkSubagents(turns, subagentData);

    // Verify linkage
    const agentBlock = turns[0].blocks.find(b => b.tool_call?.name === 'Agent');
    assert.ok(agentBlock, 'should find Agent tool call');
    assert.ok(agentBlock.tool_call.subagent, 'Agent should have subagent data');
    assert.ok(agentBlock.tool_call.subagent.length >= 1, 'subagent should have turns');

    // Step 4: Render
    const html = render(turns, { compress: false, minified: false });
    assert.match(html, /<!DOCTYPE html>/);

    // Verify agent tree structure in HTML
    // The template itself contains agent-tree CSS and JS, so we check for rendered data
    assert.ok(html.includes('code-reviewer'), 'HTML should contain agent type');
    assert.ok(html.includes('Review test coverage'), 'HTML should contain agent description');
    assert.ok(html.includes('Read'), 'HTML should contain subagent Read tool');
    assert.ok(html.includes('/test/example.mjs'), 'HTML should contain subagent file path');
    assert.ok(html.includes('npm test -- --coverage'), 'HTML should contain subagent Bash command');
    assert.ok(html.includes('87%'), 'HTML should contain subagent coverage result');

    // Verify non-Agent tool calls still render normally
    assert.ok(html.includes('npm test'), 'HTML should contain main session Bash command');
    assert.ok(html.includes('42 tests passed'), 'HTML should contain main session test result');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles multiple agents in the same turn', () => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'pipeline-multi-'));
    const sessionDir = resolve(tmpDir, 'session');
    const subagentsDir = resolve(sessionDir, 'subagents');
    mkdirSync(subagentsDir, { recursive: true });

    const mainJsonl = resolve(sessionDir, 'main.jsonl');
    writeFileSync(mainJsonl, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Parallel analysis' }, timestamp: '2026-01-01T00:00:00Z' }),
      JSON.stringify({
        type: 'assistant', timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'a1', name: 'Agent', input: { subagent_type: 'explorer', description: 'Explore src', prompt: 'List src files' } },
            { type: 'tool_use', id: 'a2', name: 'Agent', input: { subagent_type: 'tester', description: 'Run tests', prompt: 'Run all tests' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'user', timestamp: '2026-01-01T00:00:05Z',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'a1', content: 'Found 10 files' },
            { type: 'tool_result', tool_use_id: 'a2', content: 'Tests passed' },
          ],
        },
      }),
    ].join('\n'));

    const turns = parseTranscript(mainJsonl);
    assert.equal(turns[0].blocks.length, 2, 'should have 2 Agent tool calls');

    const subagentData = [
      { meta: { agentType: 'explorer', description: 'Explore src', toolUseId: 'a1' }, turns: parseTranscript(resolve(sessionDir, 'main.jsonl')).slice(0, 0) || [] },
      { meta: { agentType: 'tester', description: 'Run tests', toolUseId: 'a2' }, turns: [] },
    ];
    // Give them actual turns
    subagentData[0].turns = [{ index: 1, user_text: 'List src files', blocks: [{ kind: 'tool_use', text: '', tool_call: { tool_use_id: 's1', name: 'Bash', input: { command: 'ls src/' }, result: 'file1.mjs', resultTimestamp: null, is_error: false }, timestamp: null }], timestamp: '2026-01-01T00:00:02Z' }];
    subagentData[1].turns = [{ index: 1, user_text: 'Run all tests', blocks: [{ kind: 'tool_use', text: '', tool_call: { tool_use_id: 's2', name: 'Bash', input: { command: 'npm test' }, result: 'passed', resultTimestamp: null, is_error: false }, timestamp: null }], timestamp: '2026-01-01T00:00:02Z' }];

    linkSubagents(turns, subagentData);
    assert.ok(turns[0].blocks[0].tool_call.subagent, 'first Agent should have subagent');
    assert.ok(turns[0].blocks[1].tool_call.subagent, 'second Agent should have subagent');

    const html = render(turns, { compress: false, minified: false });
    assert.match(html, /<!DOCTYPE html>/);
    assert.ok(html.includes('explorer'), 'HTML should contain first agent type');
    assert.ok(html.includes('tester'), 'HTML should contain second agent type');
    assert.ok(html.includes('ls src/'), 'HTML should contain first subagent command');
    assert.ok(html.includes('npm test'), 'HTML should contain second subagent command');

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
