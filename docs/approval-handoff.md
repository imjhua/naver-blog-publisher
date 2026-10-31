# ChatGPT approval handoff (current implementation)

## Workflow
1. User sends a draft to ChatGPT; ChatGPT minimally edits it and asks for explicit approval.
2. Only after user says **발행 승인**, ChatGPT validates the post JSON and commits a dated immutable copy under `posts/YYYY-MM-DD[-suffix].json` (when applicable), then updates `posts/latest.json` to the approved payload. Never put secrets into the repo.
3. The Chrome extension **최신 승인 글 불러오기** fetches `posts/latest.json` with cache disabled. The file currently contains the October 31 example.
4. The user may copy/paste title and formatted body into a normally authenticated Naver editor. Automatic input, link preview card, saving and publishing are **not yet implemented or verified**.

## Safety and release gate
- An approval does not imply the post is already published.
- Never publish without a separate confirmed capability and post-publication verification (URL and title), and avoid duplicate posting.
- Naver sessions stay local to Chrome; do not commit cookies, credentials, or authentication state.
- The extension loads only public GitHub data. The repository is currently public: do not include private content before approval.
- If the current editor contains text, do not overwrite it.

## Known limitation
The GitHub connector can update the handoff file, but the connected Chrome extension cannot be remotely commanded from this chat. The extension needs a supported execution channel in the user's browser, and actual publishing requires a verified Naver editor workflow. Do not describe this as end-to-end automation yet.
