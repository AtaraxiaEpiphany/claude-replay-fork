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
