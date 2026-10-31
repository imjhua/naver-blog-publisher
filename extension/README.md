# My Mysore blog writing helper
The Naver SmartEditor ONE does not reliably accept scripted text entry in its title field. This safe fallback prepares an approved post for native paste into an ordinary signed-in Chrome session.

## Install and use
1. `git pull origin main` in the repository.
2. Open `chrome://extensions`, enable developer mode, and load the `extension` directory. If already installed, reload it.
3. Open a new Naver blog editor in the normal signed-in Chrome.
4. Select `posts/example.json` in the extension.
5. Click **① 제목 복사**, click the editor title field, and press ⌘V.
6. Reopen the extension, select the file again if necessary, click **② 본문 복사**, click the body field, and press ⌘V.
7. Check the title, paragraphs, and store URL. Save or publish manually only after verifying the preview.

The extension never clicks Save/Publish, reads credentials, or runs a debugger. Do not upload cookies or credentials.