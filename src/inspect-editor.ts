import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Local-only inspection. Never upload auth state or screenshots containing personal data.
const profileDir = process.env.NAVER_PROFILE_DIR ?? '.local/naver-profile';
await mkdir(profileDir, { recursive: true });
const context = await chromium.launchPersistentContext(profileDir, { headless: false });
const page = await context.newPage();
await page.goto('https://blog.naver.com/', { waitUntil: 'domcontentloaded' });
console.log('Log in manually, open the blog editor, then inspect its DOM with Playwright devtools.');
console.log('No content will be published by this script. Close the browser to finish.');
await page.waitForEvent('close').catch(() => {});
await context.close();
