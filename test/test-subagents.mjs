import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverSubagents, parseSubagentMeta, linkSubagents } from '../src/subagents.mjs';

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

describe('parseSubagentMeta', () => {
  let tempDir;
  let metaPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-replay-meta-test-'));
    metaPath = path.join(tempDir, 'agent-test.meta.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should parse valid meta file correctly', async () => {
    const testMeta = {
      agentType: 'conductor:explorer',
      description: 'Explore codebase structure',
      toolUseId: 'call_abc123def456',
      extraField: 'should be ignored'
    };
    await fs.writeFile(metaPath, JSON.stringify(testMeta));

    const result = await parseSubagentMeta(metaPath);
    assert.deepEqual(result, {
      agentType: 'conductor:explorer',
      description: 'Explore codebase structure',
      toolUseId: 'call_abc123def456'
    });
  });

  it('should handle missing optional fields gracefully', async () => {
    const minimalMeta = {
      toolUseId: 'call_abc123'
    };
    await fs.writeFile(metaPath, JSON.stringify(minimalMeta));

    const result = await parseSubagentMeta(metaPath);
    assert.deepEqual(result, {
      agentType: 'unknown',
      description: '',
      toolUseId: 'call_abc123'
    });
  });

  it('should throw error for invalid JSON', async () => {
    await fs.writeFile(metaPath, 'invalid json content');

    await assert.rejects(async () => {
      await parseSubagentMeta(metaPath);
    }, /SyntaxError/);
  });

  it('should throw error for non-existent file', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent.meta.json');

    await assert.rejects(async () => {
      await parseSubagentMeta(nonExistentPath);
    }, /ENOENT/);
  });
});

describe('linkSubagents', () => {
  const mainTurns = [
    {
      index: 0,
      user_text: "Run exploration",
      blocks: [
        {
          kind: "tool_use",
          tool_call: {
            tool_use_id: "call_abc123",
            name: "Agent",
            input: {
              subagent_type: "conductor:explorer",
              description: "Explore codebase"
            }
          }
        },
        {
          kind: "text",
          text: "I'll explore the codebase for you."
        }
      ]
    },
    {
      index: 1,
      user_text: "Run task",
      blocks: [
        {
          kind: "tool_use",
          tool_call: {
            tool_use_id: "call_def456",
            name: "Agent",
            input: {
              subagent_type: "conductor:task-executor",
              description: "Execute test task"
            }
          }
        }
      ]
    },
    {
      index: 2,
      user_text: "Read file",
      blocks: [
        {
          kind: "tool_use",
          tool_call: {
            tool_use_id: "call_ghi789",
            name: "Read",
            input: {
              path: "/test/file.txt"
            }
          }
        }
      ]
    }
  ];

  const subagentTurns1 = [
    {
      index: 0,
      user_text: "Explore the codebase",
      blocks: [
        { kind: "tool_use", tool_call: { tool_use_id: "call_sub1", name: "Bash", input: { command: "ls" } } }
      ]
    }
  ];

  const subagentTurns2 = [
    {
      index: 0,
      user_text: "Execute the task",
      blocks: [
        { kind: "tool_use", tool_call: { tool_use_id: "call_sub2", name: "Write", input: { path: "/test/output.txt" } } }
      ]
    }
  ];

  it("attaches subagent turns to matching tool calls", () => {
    const subagentData = [
      {
        meta: { toolUseId: "call_abc123", agentType: "conductor:explorer", description: "Explore codebase" },
        turns: subagentTurns1
      },
      {
        meta: { toolUseId: "call_def456", agentType: "conductor:task-executor", description: "Execute test task" },
        turns: subagentTurns2
      }
    ];

    // Deep clone turns to avoid mutating shared fixture
    const clonedTurns = JSON.parse(JSON.stringify(mainTurns));
    const result = linkSubagents(clonedTurns, subagentData);

    // Check first agent tool call has subagent
    assert.equal(result[0].blocks[0].tool_call.subagent, subagentTurns1);

    // Check second agent tool call has subagent
    assert.equal(result[1].blocks[0].tool_call.subagent, subagentTurns2);

    // Check non-Agent tool call has no subagent
    assert.equal(result[2].blocks[0].tool_call.subagent, undefined);
  });

  it("handles subagents with no matching tool calls", () => {
    const subagentData = [
      {
        meta: { toolUseId: "call_nonexistent", agentType: "Explore", description: "Non-existent" },
        turns: subagentTurns1
      }
    ];

    const clonedTurns = JSON.parse(JSON.stringify(mainTurns));
    const result = linkSubagents(clonedTurns, subagentData);

    // No subagents should be attached
    assert.equal(result[0].blocks[0].tool_call.subagent, undefined);
    assert.equal(result[1].blocks[0].tool_call.subagent, undefined);
  });

  it("returns turns unchanged when no subagent data provided", () => {
    const clonedTurns = JSON.parse(JSON.stringify(mainTurns));
    const result = linkSubagents(clonedTurns, []);

    // No subagents should be attached
    assert.equal(result[0].blocks[0].tool_call.subagent, undefined);
    assert.equal(result[1].blocks[0].tool_call.subagent, undefined);
    assert.equal(result[2].blocks[0].tool_call.subagent, undefined);
  });

  it("skips subagent data with missing toolUseId or turns", () => {
    const subagentData = [
      {
        meta: { toolUseId: "call_abc123", agentType: "conductor:explorer" },
        // Missing turns
      },
      {
        meta: { /* missing toolUseId */ agentType: "conductor:task-executor" },
        turns: subagentTurns2
      }
    ];

    const clonedTurns = JSON.parse(JSON.stringify(mainTurns));
    const result = linkSubagents(clonedTurns, subagentData);

    // No subagents should be attached
    assert.equal(result[0].blocks[0].tool_call.subagent, undefined);
    assert.equal(result[1].blocks[0].tool_call.subagent, undefined);
  });
});
