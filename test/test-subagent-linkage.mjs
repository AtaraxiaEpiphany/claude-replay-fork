import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linkSubagents } from '../src/subagents.mjs';
import { buildTurnsFromEntries } from '../src/formats/shared.mjs';

describe('subagent linkage', () => {
  it('should attach subagent turns to matching Agent tool_call blocks', () => {
    // Sample main session entries with Agent tool calls
    const mainEntries = [
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Analyze this project'
        }
      },
      {
        type: 'assistant',
        timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_abc123',
              name: 'Agent',
              input: {
                subagent_type: 'project-analyzer',
                description: 'Analyze project structure',
                prompt: 'List all files in the project'
              }
            }
          ]
        }
      },
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:02Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_abc123',
              content: 'Analysis complete: 5 files found'
            }
          ]
        }
      }
    ];

    // Sample subagent data
    const subagentData = [
      {
        meta: {
          agentType: 'project-analyzer',
          description: 'Analyze project structure',
          toolUseId: 'call_abc123'
        },
        turns: buildTurnsFromEntries([
          {
            type: 'user',
            timestamp: '2026-01-01T00:00:01.5Z',
            message: {
              role: 'user',
              content: 'List all files in the project'
            }
          },
          {
            type: 'assistant',
            timestamp: '2026-01-01T00:00:01.6Z',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'call_sub1',
                  name: 'Bash',
                  input: {
                    command: 'ls -la'
                  }
                }
              ]
            }
          },
          {
            type: 'user',
            timestamp: '2026-01-01T00:00:01.7Z',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'call_sub1',
                  content: 'file1.js\nfile2.js\nfile3.js\nfile4.js\nfile5.js'
                }
              ]
            }
          }
        ])
      }
    ];

    // Parse main session
    const mainTurns = buildTurnsFromEntries(mainEntries);

    // Link subagents
    const linkedTurns = linkSubagents(mainTurns, subagentData);

    // Verify linkage
    assert.equal(linkedTurns.length, 1);
    assert.equal(linkedTurns[0].blocks.length, 1);
    assert.equal(linkedTurns[0].blocks[0].kind, 'tool_use');
    assert.equal(linkedTurns[0].blocks[0].tool_call.tool_use_id, 'call_abc123');
    assert.equal(linkedTurns[0].blocks[0].tool_call.name, 'Agent');
    assert.ok(linkedTurns[0].blocks[0].tool_call.subagent);
    assert.equal(linkedTurns[0].blocks[0].tool_call.subagent.length, 1);
    assert.equal(linkedTurns[0].blocks[0].tool_call.subagent[0].blocks.length, 1);
    assert.equal(linkedTurns[0].blocks[0].tool_call.subagent[0].blocks[0].tool_call.name, 'Bash');
  });

  it('should handle multiple subagents matching different tool calls', () => {
    const mainEntries = [
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Do two things'
        }
      },
      {
        type: 'assistant',
        timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'Agent',
              input: {
                subagent_type: 'type1',
                description: 'Task 1',
                prompt: 'Do task 1'
              }
            },
            {
              type: 'tool_use',
              id: 'call_2',
              name: 'Agent',
              input: {
                subagent_type: 'type2',
                description: 'Task 2',
                prompt: 'Do task 2'
              }
            }
          ]
        }
      }
    ];

    const subagentData = [
      {
        meta: {
          agentType: 'type1',
          description: 'Task 1',
          toolUseId: 'call_1'
        },
        turns: [{ index: 1, user_text: 'Task 1', blocks: [], timestamp: '2026-01-01T00:00:01Z' }]
      },
      {
        meta: {
          agentType: 'type2',
          description: 'Task 2',
          toolUseId: 'call_2'
        },
        turns: [{ index: 1, user_text: 'Task 2', blocks: [], timestamp: '2026-01-01T00:00:02Z' }]
      }
    ];

    const mainTurns = buildTurnsFromEntries(mainEntries);
    const linkedTurns = linkSubagents(mainTurns, subagentData);

    assert.equal(linkedTurns[0].blocks.length, 2);
    assert.equal(linkedTurns[0].blocks[0].tool_call.subagent[0].user_text, 'Task 1');
    assert.equal(linkedTurns[0].blocks[1].tool_call.subagent[0].user_text, 'Task 2');
  });

  it('should silently ignore subagents with no matching tool call', () => {
    const mainEntries = [
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Hello'
        }
      },
      {
        type: 'assistant',
        timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_exists',
              name: 'Bash',
              input: { command: 'echo hello' }
            }
          ]
        }
      }
    ];

    const subagentData = [
      {
        meta: {
          agentType: 'type1',
          description: 'Orphaned agent',
          toolUseId: 'call_nonexistent'
        },
        turns: []
      }
    ];

    const mainTurns = buildTurnsFromEntries(mainEntries);
    const linkedTurns = linkSubagents(mainTurns, subagentData);

    assert.equal(linkedTurns[0].blocks.length, 1);
    assert.equal(linkedTurns[0].blocks[0].tool_call.name, 'Bash');
    assert.equal(linkedTurns[0].blocks[0].tool_call.subagent, undefined);
  });

  it('should handle empty subagent data array gracefully', () => {
    const mainEntries = [
      {
        type: 'user',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Hello'
        }
      },
      {
        type: 'assistant',
        timestamp: '2026-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there' }]
        }
      }
    ];

    const mainTurns = buildTurnsFromEntries(mainEntries);
    const linkedTurns = linkSubagents(mainTurns, []);

    assert.equal(linkedTurns.length, 1);
    assert.equal(linkedTurns[0].blocks.length, 1);
  });
});
