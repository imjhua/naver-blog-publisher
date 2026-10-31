# Publishing automation plan

## Verified editor baseline
The existing SmartEditor input and date-bold implementation on main is user-verified. Do not change the formatting or text-insertion logic while developing publishing automation.

## Separate publishing responsibilities
1. Inspect Naver publish dialog and options without clicking Publish.
2. Verify exact title, date bold, complete prose, store link, preview card, and intended visibility.
3. Stop on any mismatch without publishing.
4. Require explicit approval for first live publication and avoid duplicate posts with a durable identity key.
5. Report publication only after obtaining the published blog URL.

Keep publishing logic separate from the existing editor-input implementation. Browser must be open and logged into Naver for Chrome-extension-driven execution.
