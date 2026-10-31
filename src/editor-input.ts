import type { Page, Locator } from 'playwright';
import { formatPost } from './format-post.js';

/** Naver SmartEditor ONE. Selectors are candidates pending DOM verification. */
async function findUnique(page: Page, selectors: string[], name: string): Promise<Locator> {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    if (await matches.count() === 1 && await matches.first().isVisible()) return matches;
  }
  throw new Error(`Unable to identify unique ${name} editor. Inspect DOM before continuing.`);
}

export async function fillNaverEditor(page: Page, input: unknown): Promise<void> {
  const { title, body } = formatPost(input);
  const titleField = await findUnique(page, [
    '.se-title-text .se-text-paragraph',
    '.se-title-text [contenteditable="true"]',
  ], 'title');
  const bodyField = await findUnique(page, [
    '.se-main-container .se-component.se-text .se-text-paragraph',
    '.se-main-container [contenteditable="true"]',
  ], 'body');

  await titleField.click();
  await page.keyboard.insertText(title);
  await bodyField.click();
  await page.keyboard.insertText(body);
  console.log('Editor fields filled; publish/save buttons were not clicked.');
}
