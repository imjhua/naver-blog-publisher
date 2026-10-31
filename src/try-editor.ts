import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fillNaverEditor } from './editor-input.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: npx tsx src/try-editor.ts posts/example.json');
const post = JSON.parse(readFileSync(file, 'utf8'));
const profile = process.env.NAVER_PROFILE_DIR ?? '.local/naver-profile';
const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: false });
try {
  const page = await context.newPage();
  await page.goto('https://blog.naver.com/my-mysore?Redirect=Write', { waitUntil: 'domcontentloaded' });
  console.log('Log in if necessary. Navigate to the editor, then press Enter in this terminal.');
  await new Promise<void>(resolve => process.stdin.once('data', () => resolve()));
  await fillNaverEditor(page, post);
  console.log('Review the filled editor. This script never clicks Save or Publish.');
  console.log('Press Enter to close the browser without submitting.');
  await new Promise<void>(resolve => process.stdin.once('data', () => resolve()));
} finally {
  await context.close();
}
