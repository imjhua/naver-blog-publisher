# Testing with an owner-authenticated Chrome session

The separate Playwright browser triggered a Naver security challenge and returned to login. Do not automate CAPTCHA solving, transfer cookies, or attempt to bypass security controls.

## Supported experiment

1. The owner may launch a **separate, dedicated Chrome instance** with remote debugging enabled on **localhost only**, using a new non-sensitive profile directory.
2. The owner signs into Naver manually and completes all security checks, if allowed by Naver.
3. Open the my-mysore blog editor in that Chrome instance.
4. Run `CHROME_CDP_URL=http://127.0.0.1:9222 npx tsx src/try-existing-chrome.ts posts/example.json`.
5. Verify the entered title and body. This script does **not** save or publish.

Do not expose port 9222 to the network. Do not use your everyday Chrome profile or commit browser data. If Naver blocks this method too, stop and use a manual publication workflow instead.

## Important limitation

An existing ordinary Chrome session cannot generally be attached to after the fact: it must have been started with remote debugging enabled. Connecting over CDP does not guarantee Naver will accept the session, and a local session is not automatically usable by GitHub-hosted Actions.
