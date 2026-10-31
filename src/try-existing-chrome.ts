import { readFileSync } from 'node:fs';
import { connectAuthorizedChrome } from './browser-session.js';
import { fillNaverEditor } from './editor-input.js';

const path = process.argv[2];
if (!path) throw new Error('Usage: CHROME_CDP_URL=http://127.0.0.1:9222 npx tsx src/try-existing-chrome.ts posts/example.json');
const post = JSON.parse(readFileSync(path, 'utf8'));
const context = await connectAuthorizedChrome();
const page = context.pages().find(p => p.url().startsWith('https://blog.naver.com/'));
if (!page) throw new Error('Open the Naver blog editor in the authorized Chrome window before running this command.');
if (!page.url().includes('my-mysore')) throw new Error('Unexpected blog URL; refusing to enter content.');
await fillNaverEditor(page, post);
console.log('Filled only; verify the content manually. No save or publish action was taken.');
