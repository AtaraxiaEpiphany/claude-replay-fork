import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Discover subagents in the subagents/ directory adjacent to a main session file
 * @param {string} mainSessionPath - Path to the main session JSONL file
 * @returns {Promise<Array<{ agentId: string, meta: object, jsonlPath: string }>>}
 */
export async function discoverSubagents(mainSessionPath) {
  const subagents = [];

  try {
    // Get the session directory (parent of main session file)
    const sessionDir = path.dirname(mainSessionPath);
    const subagentsDir = path.join(sessionDir, 'subagents');

    // Check if subagents directory exists
    try {
      await fs.access(subagentsDir);
    } catch {
      // Subagents directory doesn't exist, return empty array
      return [];
    }

    // Read all files in subagents directory
    const files = await fs.readdir(subagentsDir);

    // Filter meta files
    const metaFiles = files.filter(file => /^agent-.+\.meta\.json$/.test(file));

    for (const metaFile of metaFiles) {
      try {
        // Extract agent ID from meta filename (agent-<agentId>.meta.json)
        const agentId = metaFile.match(/^agent-(.+)\.meta\.json$/)[1];

        // Check if corresponding JSONL file exists
        const jsonlFile = `agent-${agentId}.jsonl`;
        const jsonlPath = path.join(subagentsDir, jsonlFile);

        try {
          await fs.access(jsonlPath);
        } catch {
          // JSONL file doesn't exist, skip this subagent
          continue;
        }

        // Read and parse meta file
        const metaPath = path.join(subagentsDir, metaFile);
        const metaContent = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaContent);

        subagents.push({
          agentId,
          meta,
          jsonlPath
        });
      } catch (error) {
        // Skip invalid or corrupted meta files
        console.warn(`Skipping invalid subagent meta file ${metaFile}:`, error.message);
        continue;
      }
    }
  } catch (error) {
    // Any unexpected error during discovery, return empty array
    console.warn('Error discovering subagents:', error.message);
    return [];
  }

  return subagents;
}

/**
 * Parse subagent meta file
 * @param {string} metaFilePath - Path to agent-*.meta.json file
 * @returns {Promise<{ agentType: string, description: string, toolUseId: string }>}
 */
export async function parseSubagentMeta(metaFilePath) {
  const content = await fs.readFile(metaFilePath, 'utf8');
  const meta = JSON.parse(content);
  return {
    agentType: meta.agentType || 'unknown',
    description: meta.description || '',
    toolUseId: meta.toolUseId
  };
}

/**
 * @typedef {import('./formats/shared.mjs').Turn} Turn
 * @typedef {import('./formats/shared.mjs').ToolCall} ToolCall
 */

/**
 * @typedef {Object} SubagentData
 * @property {{ agentType: string, description: string, toolUseId: string }} meta - Subagent metadata
 * @property {Turn[]} turns - Parsed subagent session turns
 */

/**
 * Attaches parsed subagent turns to matching Agent tool_call blocks in the main session turns.
 * Links via toolUseId from subagent metadata to tool_call.tool_use_id.
 *
 * @param {Turn[]} turns - Main session turns
 * @param {SubagentData[]} subagentData - Array of subagent metadata and parsed turns
 * @returns {Turn[]} Modified turns with subagents attached (original array is mutated)
 */
export function linkSubagents(turns, subagentData) {
  // Create a map of toolUseId to subagent turns for fast lookup
  const subagentMap = new Map();
  for (const subagent of subagentData) {
    if (subagent.meta?.toolUseId && subagent.turns) {
      subagentMap.set(subagent.meta.toolUseId, subagent.turns);
    }
  }

  if (subagentMap.size === 0) {
    return turns;
  }

  // Iterate through all blocks in all turns to find matching Agent tool calls
  for (const turn of turns) {
    for (const block of turn.blocks) {
      if (block.kind === 'tool_use' && block.tool_call) {
        const toolCall = block.tool_call;
        if (subagentMap.has(toolCall.tool_use_id)) {
          // Attach subagent turns to the tool call
          toolCall.subagent = subagentMap.get(toolCall.tool_use_id);
        }
      }
    }
  }

  return turns;
}
