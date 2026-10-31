# Implementation plan

## Current state
- GitHub Actions validates an approved JSON post and performs a dry run only.
- No Naver publishing action has been implemented or verified.
- ChatGPT approval is not yet connected to a workflow trigger.

## Stage 3: Naver editor validation
1. Review Naver terms and automation limitations.
2. Run local headed browser with a persistent profile and manually sign in.
3. Inspect the editor's frames, contenteditable elements and controls.
4. Implement draft-only input and verify content before any publish action.
5. Verify publishing on an explicitly approved test post, and capture the resulting URL.

## Stage 4: Cloud execution
Evaluate secure session handling and whether cloud logins trigger additional authentication. Do not commit browser profiles, cookies, or secrets.

## Stage 5: Approval bridge
Build an authenticated trigger that transmits an immutable approved post version and dispatches the GitHub workflow. A normal chat message alone does not automatically invoke external APIs.

## Stage 6: Reliability
Implement idempotency, post-publication verification, and failure reporting.
