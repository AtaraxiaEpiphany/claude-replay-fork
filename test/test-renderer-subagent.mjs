import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/renderer.mjs';
import { buildTurnsFromEntries } from '../src/formats/shared.mjs';

function makeTurnsWithSubagent() {
  const mainEntries = [
    { type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Analyze project' } },
    {
      type: 'assistant', timestamp: '2026-01-01T00:00:01Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'agent_001', name: 'Agent', input: { subagent_type: 'explorer', description: 'Explore code', prompt: 'Find files' } }],
      },
    },
    {
      type: 'user', timestamp: '2026-01-01T00:00:05Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'agent_001', content: 'Exploration done' }] },
    },
  ];

  const mainTurns = buildTurnsFromEntries(mainEntries);

  const subagentTurns = buildTurnsFromEntries([
    { type: 'user', timestamp: '2026-01-01T00:00:02Z', message: { role: 'user', content: 'Find files' } },
    {
      type: 'assistant', timestamp: '2026-01-01T00:00:03Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'bash_001', name: 'Bash', input: { command: 'find . -type f' } }],
      },
    },
    {
      type: 'user', timestamp: '2026-01-01T00:00:04Z',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'bash_001', content: 'file1.js\nfile2.js' }] },
    },
  ]);

  mainTurns[0].blocks[0].tool_call.subagent = subagentTurns;
  return mainTurns;
}

describe('renderer subagent serialization', () => {
  it('serializes subagent data in rendered HTML', () => {
    const turns = makeTurnsWithSubagent();
    const html = render(turns, { compress: false, minified: false });
    assert.match(html, /<!DOCTYPE html>/);
    assert.ok(html.includes('Agent'), 'HTML should contain Agent tool name');
    assert.ok(html.includes('explorer'), 'HTML should contain subagent type');
    assert.ok(html.includes('Bash'), 'HTML should contain subagent internal Bash tool');
    assert.ok(html.includes('find . -type f'), 'HTML should contain subagent Bash command');
    assert.ok(html.includes('file1.js'), 'HTML should contain subagent tool result');
  });

  it('applies secret redaction to subagent data', () => {
    const mainEntries = [
      { type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Check keys' } },
      {
        type: 'assistant', timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'agent_002', name: 'Agent', input: { subagent_type: 'general', description: 'Show keys', prompt: 'Print env' } }],
        },
      },
      {
        type: 'user', timestamp: '2026-01-01T00:00:03Z',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'agent_002', content: 'done' }] },
      },
    ];

    const mainTurns = buildTurnsFromEntries(mainEntries);

    const subagentTurns = buildTurnsFromEntries([
      { type: 'user', timestamp: '2026-01-01T00:00:01.5Z', message: { role: 'user', content: 'Print env' } },
      {
        type: 'assistant', timestamp: '2026-01-01T00:00:02Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'bash_env', name: 'Bash', input: { command: 'echo sk-ant-api03-longapikeyvalue1234567890abcdef' } }],
        },
      },
      {
        type: 'user', timestamp: '2026-01-01T00:00:02.5Z',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'bash_env', content: 'sk-ant-api03-longapikeyvalue1234567890abcdef' }] },
      },
    ]);

    mainTurns[0].blocks[0].tool_call.subagent = subagentTurns;
    const html = render(mainTurns, { compress: false, minified: false, redactSecrets: true });
    assert.ok(!html.includes('sk-ant-api03-longapikeyvalue1234567890abcdef'), 'Secret in subagent data should be redacted');
  });

  it('renders correctly when subagent is empty array', () => {
    const mainEntries = [
      { type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Hello' } },
      {
        type: 'assistant', timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'agent_003', name: 'Agent', input: { subagent_type: 'general', description: 'Empty agent', prompt: 'Do nothing' } }],
        },
      },
      {
        type: 'user', timestamp: '2026-01-01T00:00:02Z',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'agent_003', content: 'No output' }] },
      },
    ];

    const mainTurns = buildTurnsFromEntries(mainEntries);
    mainTurns[0].blocks[0].tool_call.subagent = [];
    const html = render(mainTurns, { compress: false, minified: false });
    assert.match(html, /<!DOCTYPE html>/);
    assert.ok(html.includes('Agent'), 'HTML should still contain Agent tool');
  });
});
