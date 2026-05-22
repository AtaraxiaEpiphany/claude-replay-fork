import { test, expect } from '@playwright/test';

test('agent prompt and result render with proper line breaks', async ({ page }) => {
  await page.goto('http://127.0.0.1:8765');
  await page.waitForSelector('.turn');

  // Reveal all blocks
  await page.evaluate(() => {
    document.querySelectorAll('.block-hidden').forEach(el => {
      el.classList.remove('block-hidden');
    });
  });

  // Find all agent trees
  const agentTrees = page.locator('.agent-tree');
  const count = await agentTrees.count();
  console.log(`Found ${count} agent trees`);
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < Math.min(count, 3); i++) {
    const tree = agentTrees.nth(i);
    const header = tree.locator('.agent-tree-header');
    await expect(header).toBeVisible();

    const toolName = header.locator('.tool-name');
    await expect(toolName).toHaveText('Agent');

    const typeBadge = header.locator('.agent-type');
    if (await typeBadge.count() > 0) {
      console.log(`Agent ${i} type: ${await typeBadge.first().textContent()}`);
    }

    const prompt = tree.locator('.agent-prompt');
    if (await prompt.count() > 0) {
      const promptText = await prompt.locator('.agent-prompt-text').textContent();
      console.log(`Agent ${i} prompt (${promptText.length} chars): ${promptText.slice(0, 80)}`);
      expect(promptText.length).toBeGreaterThan(10);
    }

    const result = tree.locator('.agent-result');
    if (await result.count() > 0) {
      const resultText = await result.locator('.agent-result-text').textContent();
      console.log(`Agent ${i} result (${resultText.length} chars): ${resultText.slice(0, 80)}`);
    }

    const childTools = tree.locator('.agent-children .tool-block');
    console.log(`Agent ${i} has ${await childTools.count()} child tools`);
  }

  const promptTotal = await page.locator('.agent-prompt').count();
  const resultTotal = await page.locator('.agent-result').count();
  console.log(`Total prompts: ${promptTotal}, Total results: ${resultTotal}`);
  expect(promptTotal).toBeGreaterThan(0);
  expect(resultTotal).toBeGreaterThan(0);

  // Collapse hides prompt and result
  const firstTree = agentTrees.first();
  await page.evaluate(el => el.classList.add('collapsed'), await firstTree.elementHandle());
  await page.waitForTimeout(100);
  expect(await firstTree.locator('.agent-prompt').isHidden()).toBeTruthy();
  expect(await firstTree.locator('.agent-result').isHidden()).toBeTruthy();

  // Toggle back
  await page.evaluate(el => el.classList.remove('collapsed'), await firstTree.elementHandle());
});
