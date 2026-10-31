# Publishing automation preparation (isolated branch)

## Frozen, user-verified baseline
- Main extension code restored byte-for-byte to commit `4bbdf87e20cbc9854121abd1a01844158700364d`.
- Do not change `extension/background.js` input or date-bold logic, `extension/popup.js`, `extension/popup.html`, or `extension/manifest.json` as part of publishing work without explicit approval and regression verification.
- Preserve approved post content and Naver SmartEditor formatting; never modify `posts/latest.json` for tests.

## Separate automation boundary
- Implement any publication flow as a separate module, e.g. `extension/publish-flow.js`, only after confirming Naver editor's publish-dialog behavior in a non-publishing inspection.
- Keep an explicit `approved` state separate from actual `published` state.
- Require explicit user opt-in before real publication. A readiness check must never click Save/Publish.
- Validate: exact title, date line bold in persisted editor DOM, store URL, preview card, complete prose, and intended visibility/settings.
- If a validation fails, stop without publishing, and surface a short actionable error.
- Prevent duplicate posting via a durable idempotency key derived from approved post identity and a published-URL receipt.
- Only report success after observing the final public blog URL; retain error/retry state otherwise.

## Rollout
1. Read-only inspection of publish dialog and options.
2. Dry-run checks and isolated tests without writing or publishing.
3. Explicitly authorized single-post publish test.
4. Add scheduled/triggered behavior only after the publish path is proven, accounting for Chrome needing to be running.

Do not merge this branch into main until verified.