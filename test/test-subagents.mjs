import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverSubagents } from '../src/subagents.mjs';

describe('subagent discovery', () => {
  let tempDir;
  let mainSessionPath;

  beforeEach(async () => {
    // Create temporary directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-replay-test-'));
    const sessionDir = path.join(tempDir, 'test-session');
    await fs.mkdir(sessionDir);

    // Create main session file
    mainSessionPath = path.join(sessionDir, 'session.jsonl');
    await fs.writeFile(mainSessionPath, '{}');

    // Create subagents directory
    const subagentsDir = path.join(sessionDir, 'subagents');
    await fs.mkdir(subagentsDir);

    // Create test subagent 1
    await fs.writeFile(
      path.join(subagentsDir, 'agent-abc123.meta.json'),
      JSON.stringify({
        agentType: 'explore',
        description: 'Explore codebase',
        toolUseId: 'tool_123',
        createdAt: '2024-01-01T00:00:00Z'
      })
    );
    await fs.writeFile(
      path.join(subagentsDir, 'agent-abc123.jsonl'),
      '[]'
    );

    // Create test subagent 2
    await fs.writeFile(
      path.join(subagentsDir, 'agent-def456.meta.json'),
      JSON.stringify({
        agentType: 'plan',
        description: 'Plan implementation',
        toolUseId: 'tool_456',
        createdAt: '2024-01-01T00:01:00Z'
      })
    );
    await fs.writeFile(
      path.join(subagentsDir, 'agent-def456.jsonl'),
      '[]'
    );

    // Create meta file without corresponding jsonl
    await fs.writeFile(
      path.join(subagentsDir, 'agent-missing789.meta.json'),
      JSON.stringify({
        agentType: 'execute',
        description: 'Run command',
        toolUseId: 'tool_789',
        createdAt: '2024-01-01T00:02:00Z'
      })
    );

    // Create non-meta files in subagents dir (should be ignored)
    await fs.writeFile(path.join(subagentsDir, 'not-a-meta-file.txt'), 'test');
    await fs.writeFile(path.join(subagentsDir, 'agent-xyz.meta.txt'), 'test');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should discover all valid subagents with both meta and jsonl files', async () => {
    const subagents = await discoverSubagents(mainSessionPath);

    assert.equal(subagents.length, 2);

    // Check first subagent
    const subagent1 = subagents.find(s => s.agentId === 'abc123');
    assert.ok(subagent1);
    assert.equal(subagent1.meta.agentType, 'explore');
    assert.equal(subagent1.meta.toolUseId, 'tool_123');
    assert.ok(subagent1.jsonlPath.includes('agent-abc123.jsonl'));

    // Check second subagent
    const subagent2 = subagents.find(s => s.agentId === 'def456');
    assert.ok(subagent2);
    assert.equal(subagent2.meta.agentType, 'plan');
    assert.equal(subagent2.meta.toolUseId, 'tool_456');
    assert.ok(subagent2.jsonlPath.includes('agent-def456.jsonl'));
  });

  it('should ignore meta files without corresponding jsonl files', async () => {
    const subagents = await discoverSubagents(mainSessionPath);
    const missingSubagent = subagents.find(s => s.agentId === 'missing789');
    assert.equal(missingSubagent, undefined);
  });

  it('should return empty array when subagents directory does not exist', async () => {
    // Remove subagents directory
    const sessionDir = path.dirname(mainSessionPath);
    await fs.rm(path.join(sessionDir, 'subagents'), { recursive: true, force: true });

    const subagents = await discoverSubagents(mainSessionPath);
    assert.deepEqual(subagents, []);
  });

  it('should return empty array when main session path is not in a session directory structure', async () => {
    // Create a standalone jsonl file outside any session directory
    const standalonePath = path.join(tempDir, 'standalone.jsonl');
    await fs.writeFile(standalonePath, '{}');

    const subagents = await discoverSubagents(standalonePath);
    assert.deepEqual(subagents, []);
  });

  it('should handle invalid meta files gracefully', async () => {
    // Create invalid meta file
    const sessionDir = path.dirname(mainSessionPath);
    await fs.writeFile(
      path.join(sessionDir, 'subagents', 'agent-invalid.meta.json'),
      'invalid json'
    );

    // Should not throw, just skip invalid file
    const subagents = await discoverSubagents(mainSessionPath);
    assert.equal(subagents.length, 2); // Only valid ones should be present
  });
});
