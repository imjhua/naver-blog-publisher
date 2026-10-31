# Mobile publishing workflow (safe scaffold)

From mobile GitHub, open **Actions → Mobile-approved Naver publishing → Run workflow**.
The default is a **dry run**. It validates `posts/latest.json` and refuses to
run when `posts/published/<id>.json` exists.

Actual publishing is **not yet enabled**: `automation/publish.mjs` intentionally
stops before editing or submitting anything. This prevents accidentally
publishing incomplete or duplicate posts while the Naver SmartEditor headless
flow remains untested.

Before enabling live publishing, validate Playwright input and OG-card
rendering in a test blog, handle Naver session expiry and login challenges,
verify the final public URL, and only then commit a receipt. Never store Naver
passwords, cookies, or storage-state files in the repository. If using a
storage-state secret, store it only in GitHub Actions Secrets.

The existing Chrome extension remains the working publishing fallback.
