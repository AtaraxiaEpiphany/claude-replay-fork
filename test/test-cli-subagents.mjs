import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'bin', 'claude-replay.mjs');
const FIXTURE = resolve(__dirname, 'e2e', 'fixture.jsonl');

function run(args, timeout = 10000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('CLI timed out')), timeout);
    execFile(process.execPath, [CLI, ...args], (err, stdout, stderr) => {
      clearTimeout(timer);
      res({ code: err ? err.code : 0, stdout, stderr });
    });
  });
}

function createClaudeCodeSession(tmpDir) {
  const mainJsonl = resolve(tmpDir, 'session.jsonl');
  const subagentsDir = resolve(tmpDir, 'subagents');

  mkdirSync(subagentsDir, { recursive: true });

  // Main session with an Agent tool call
  const mainContent = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Analyze this project' }, timestamp: '2026-01-01T00:00:00Z' }),
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will analyze the project for you.' },
          { type: 'tool_use', id: 'agent_call_001', name: 'Agent', input: { subagent_type: 'project-analyzer', description: 'Analyze project structure', prompt: 'List all files' } },
        ],
      },
      timestamp: '2026-01-01T00:00:01Z',
    }),
    JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'agent_call_001', content: 'Analysis complete' }],
      },
      timestamp: '2026-01-01T00:00:10Z',
    }),
  ].join('\n');
  writeFileSync(mainJsonl, mainContent);

  // Subagent meta file
  const meta = { agentType: 'project-analyzer', description: 'Analyze project structure', toolUseId: 'agent_call_001' };
  writeFileSync(resolve(subagentsDir, 'agent-abc123.meta.json'), JSON.stringify(meta));

  // Subagent JSONL file
  const agentJsonl = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'List all files' }, timestamp: '2026-01-01T00:00:02Z' }),
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'sub_bash_001', name: 'Bash', input: { command: 'find . -type f' } },
        ],
      },
      timestamp: '2026-01-01T00:00:03Z',
    }),
    JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'sub_bash_001', content: 'file1.js\nfile2.js\nfile3.js' }],
      },
      timestamp: '2026-01-01T00:00:04Z',
    }),
  ].join('\n');
  writeFileSync(resolve(subagentsDir, 'agent-abc123.jsonl'), agentJsonl);

  return mainJsonl;
}

describe('CLI subagent integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'cli-subagent-test-'));
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('generates HTML from Claude Code session with subagents without error', async () => {
    const mainJsonl = createClaudeCodeSession(tmpDir);
    const { code, stdout, stderr } = await run([mainJsonl, '--no-compress']);
    assert.equal(code, 0, `CLI failed: ${stderr}`);
    assert.match(stdout, /<!DOCTYPE html>/);

    // Agent tool call should appear in the output
    assert.ok(stdout.includes('Agent'), 'HTML should contain Agent tool name');
    assert.ok(stdout.includes('project-analyzer'), 'HTML should contain subagent type from tool input');
    // Note: subagent internal tools won't appear in HTML until Phase 4 (renderer serialization)
  });

  it('generates HTML without subagent discovery when no subagents directory exists', async () => {
    const mainJsonl = createClaudeCodeSession(tmpDir);
    // Remove subagents directory
    rmSync(resolve(tmpDir, 'subagents'), { recursive: true, force: true });

    const { code, stdout, stderr } = await run([mainJsonl, '--no-compress']);
    assert.equal(code, 0, `CLI failed: ${stderr}`);
    assert.match(stdout, /<!DOCTYPE html>/);
    // Agent tool call should still appear (as a regular tool block without subagent data)
    assert.ok(stdout.includes('Agent'), 'HTML should contain Agent tool name');
  });

  it('non-Claude-Code format sessions are unaffected', async () => {
    // The e2e fixture uses custom tool names (ble_scan_start, etc.) which is not claude-code
    const { code, stdout, stderr } = await run([FIXTURE, '--no-compress']);
    assert.equal(code, 0, `CLI failed: ${stderr}`);
    assert.match(stdout, /<!DOCTYPE html>/);
    // Should not contain any subagent-related data
    assert.ok(!stdout.includes('subagent'), 'Non-Claude-Code sessions should not reference subagents');
  });

  it('handles corrupted subagent meta files gracefully', async () => {
    const mainJsonl = createClaudeCodeSession(tmpDir);
    const metaPath = resolve(tmpDir, 'subagents', 'agent-abc123.meta.json');
    writeFileSync(metaPath, 'not valid json{');

    const { code, stdout, stderr } = await run([mainJsonl, '--no-compress']);
    assert.equal(code, 0, `CLI should not crash on bad meta: ${stderr}`);
    assert.match(stdout, /<!DOCTYPE html>/);
  });
});
