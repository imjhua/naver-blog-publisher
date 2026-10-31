# Mobile publishing via GitHub Actions

The workflow is manually dispatched from GitHub Actions on mobile or desktop.
It defaults to a **dry run**. This validates the approved post and checks
`posts/published/<id>.json` for a duplicate.

Live mode uses Playwright Chromium with a Naver authenticated browser
storage-state secret named `NAVER_STORAGE_STATE`. The runner types into
SmartEditor, checks the date bold style, paragraphs, store URL and OG card,
opens the publish panel, submits once, and records the public URL only after
the published page title is verified.

**Important: The live flow has not been tested against a real Naver editor
session in GitHub Actions.** Login challenges, Naver editor changes and the
OG card may block it. Do not enable live mode before testing with a disposable
test post. If a submission times out, do not retry until you have manually
checked whether it was published.

To use: open GitHub > Actions > Mobile-approved Naver publishing > Run workflow.
Leave `publish=false` for validation; `publish=true` attempts a real post
and requires the secret. Store cookies only in encrypted Actions secrets,
never in the repository, logs, screenshots or chat.

The existing Chrome extension remains the proven publishing fallback.
