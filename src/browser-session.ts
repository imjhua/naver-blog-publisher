import { chromium, type BrowserContext } from 'playwright';

/**
 * Connect only to a Chrome instance explicitly started by the owner with remote debugging.
 * No cookies, passwords, or Chrome profile files are copied or uploaded.
 */
export async function connectAuthorizedChrome(): Promise<BrowserContext> {
  const endpoint = process.env.CHROME_CDP_URL;
  if (!endpoint) throw new Error('CHROME_CDP_URL is required. Start a dedicated Chrome debugging session after authenticating manually.');
  const parsed = new URL(endpoint);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Only localhost CDP endpoints are allowed.');
  }
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No Chrome browser context found.');
  return context;
}
