import { chromium, type Frame } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

/** Read-only probe: never types, clicks publish, or saves a draft. */
const profile = process.env.NAVER_PROFILE_DIR ?? '.local/naver-profile';
await mkdir(profile, { recursive: true });
const browser = await chromium.launchPersistentContext(profile, { headless: false });
const page = await browser.newPage();
const blogUrl = process.env.NAVER_BLOG_URL ?? 'https://blog.naver.com/my-mysore';
await page.goto(blogUrl, { waitUntil: 'domcontentloaded' });
console.log('Sign in yourself and navigate to your blog editor. Press Enter here when ready.');
await new Promise<void>(resolve => process.stdin.once('data', () => resolve()));

async function inspect(frame: Frame) {
  return {
    frame: frame === page.mainFrame() ? 'main' : 'child',
    editable: await frame.locator('[contenteditable="true"]').count(),
    textboxes: await frame.getByRole('textbox').count(),
    inputs: await frame.locator('input, textarea').count(),
    buttons: await frame.getByRole('button').allTextContents().then(x => x.map(s => s.trim()).filter(Boolean).slice(0, 30)),
  };
}
const report = [];
for (const frame of page.frames()) {
  try { report.push(await inspect(frame)); } catch { report.push({ frame: 'unavailable' }); }
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/editor-structure.json', JSON.stringify(report, null, 2));
console.log('Saved structural metadata only: artifacts/editor-structure.json');
console.log('Review the file before sharing; button labels can contain private information.');
await browser.close();
