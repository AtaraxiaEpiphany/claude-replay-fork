import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnsFromEntries } from '../src/formats/shared.mjs';

describe('ToolCall subagent field', () => {
  it('should support optional subagent field in ToolCall type', () => {
    const entries = [
      {
        type: 'user',
        timestamp: '2024-01-01T00:00:00Z',
        message: {
          role: 'user',
          content: 'Test subagent tool calls'
        }
      },
      {
        type: 'assistant',
        timestamp: '2024-01-01T00:00:01Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool1',
              name: 'Bash',
              input: {
                command: 'echo "parent command"'
              }
            }
          ]
        }
      },
      {
        type: 'user',
        timestamp: '2024-01-01T00:00:02Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool1',
              content: 'parent output'
            }
          ]
        }
      }
    ];

    const turns = buildTurnsFromEntries(entries);

    // Add subagent field to the tool call
    const toolCall = turns[0].blocks[0].tool_call;
    toolCall.subagent = [
      {
        tool_use_id: 'subtool1',
        name: 'Read',
        input: { file_path: '/test.txt' },
        result: 'subagent result',
        resultTimestamp: '2024-01-01T00:00:03Z',
        is_error: false
      }
    ];

    // Verify the subagent field exists and is correctly typed
    assert.ok(toolCall.subagent);
    assert.equal(Array.isArray(toolCall.subagent), true);
    assert.equal(toolCall.subagent.length, 1);
    assert.equal(toolCall.subagent[0].tool_use_id, 'subtool1');
    assert.equal(toolCall.subagent[0].name, 'Read');
    assert.equal(toolCall.subagent[0].input.file_path, '/test.txt');
    assert.equal(toolCall.subagent[0].result, 'subagent result');
    assert.equal(toolCall.subagent[0].is_error, false);

    // Verify that subagent field is optional (can be undefined)
    const toolCall2 = {
      tool_use_id: 'tool2',
      name: 'Write',
      input: { file_path: '/test2.txt', content: 'test' },
      result: null,
      resultTimestamp: null,
      is_error: false
    };
    assert.equal(toolCall2.subagent, undefined);
  });

  it('should handle nested subagent tool calls', () => {
    const toolCall = {
      tool_use_id: 'parent',
      name: 'Bash',
      input: { command: 'parent' },
      result: 'parent result',
      resultTimestamp: '2024-01-01T00:00:00Z',
      is_error: false,
      subagent: [
        {
          tool_use_id: 'child1',
          name: 'Read',
          input: { file_path: '/a.txt' },
          result: 'child1 result',
          resultTimestamp: '2024-01-01T00:00:01Z',
          is_error: false,
          subagent: [
            {
              tool_use_id: 'grandchild1',
              name: 'Grep',
              input: { pattern: 'test', path: '/a.txt' },
              result: 'grandchild1 result',
              resultTimestamp: '2024-01-01T00:00:02Z',
              is_error: false
            }
          ]
        },
        {
          tool_use_id: 'child2',
          name: 'Write',
          input: { file_path: '/b.txt', content: 'test' },
          result: 'child2 result',
          resultTimestamp: '2024-01-01T00:00:03Z',
          is_error: false
        }
      ]
    };

    assert.equal(toolCall.subagent.length, 2);
    assert.equal(toolCall.subagent[0].subagent.length, 1);
    assert.equal(toolCall.subagent[0].subagent[0].tool_use_id, 'grandchild1');
    assert.equal(toolCall.subagent[1].tool_use_id, 'child2');
  });
});
