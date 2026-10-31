# My Mysore editor probe (Chrome extension)

This extension runs in an ordinary owner-authenticated Chrome tab, without launching a Playwright-controlled browser or copying authentication data.

## Install

1. Pull the repository on your Mac: `git pull origin main`.
2. In your regular Chrome, open `chrome://extensions` and enable Developer mode.
3. Click **Load unpacked** and select the repository's `extension` folder.
4. Sign in to Naver normally, open the blog editor, click the extension, and paste the approved `posts/example.json` content.
5. Click the test button. The current version **only reports detected editor elements**. It does not type, save, or publish anything. Share only the counts shown, not session cookies or personal information.

## Why probe first?

SmartEditor ONE's selectors have not yet been verified. The extension will be upgraded to fill only after the DOM detection is confirmed. It never reads passwords or cookies.
