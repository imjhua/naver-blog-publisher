// Executed by chrome.scripting in each frame. Never saves or publishes.
function fillApprovedPostInFrame(post) {
  const title = document.querySelector('.se-title-text .se-text-paragraph');
  const body = document.querySelector('.se-section-text .se-module-text .se-text-paragraph');
  if (!title || !body) return {status:'not-editor-frame'};
  const visible = el => !!(el.getClientRects().length);
  if (!visible(title) || !visible(body)) return {status:'not-visible'};
  const currentTitle = title.textContent?.replace(/제목\s*$/, '').trim() || '';
  const currentBody = body.textContent?.replace(/글감과 함께 나의 일상을 기록해보세요!/, '').trim() || '';
  if (currentTitle || currentBody) return {status:'not-empty',title:currentTitle.slice(0,60),body:currentBody.slice(0,60)};
  const [year,month,day] = post.practiceDate.split('-').map(Number);
  const content = year + '년 ' + month + '월 ' + day + '일 · ' + post.practiceType +
    '\n' + post.storeUrl + '\n\n' + post.content;
  function typeInto(el,value) {
    // SmartEditor ONE uses a separate editable iframe for keyboard input.
    // Clicking the visible paragraph transfers focus to that iframe.
    el.click();
    const active = document.activeElement;
    const inputFrame = active?.tagName === 'IFRAME' ? active : null;
    let inputDoc = null;
    let inputTarget = null;
    let frameError = null;
    try {
      inputDoc = inputFrame?.contentDocument || null;
      inputTarget = inputDoc?.querySelector('body[contenteditable="true"]') || null;
    } catch (error) {
      frameError = error.message;
    }
    const diagnostics = {
      activeTag: active?.tagName || null,
      elementEditable: el.isContentEditable,
      frameAccessible: !!inputDoc,
      frameError,
      frameEditable: !!inputTarget?.isContentEditable,
      frameBodyPresent: !!inputTarget,
      framePath: location.pathname
    };
    if (!inputTarget) return {ok:false,diagnostics};
    inputTarget.focus();
    const selection = inputDoc.getSelection();
    const range = inputDoc.createRange();
    range.selectNodeContents(inputTarget);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    const textResult = inputDoc.execCommand('insertText',false,value);
    if (el.textContent?.includes(value)) return {ok:true,method:'iframe-insertText'};
    // The editor may update its visible document asynchronously.
    // Report command acceptance separately; do not claim text was confirmed.
    return {ok:false,diagnostics:{
      ...diagnostics,textResult,
      iframeText:inputTarget.textContent?.slice(0,80) || '',
      visibleText:el.textContent?.slice(0,80) || '',
      selectionCount:selection.rangeCount,
      frameActiveTag:inputDoc.activeElement?.tagName || null
    }};
  }
  // Input only. The SmartEditor may reject synthetic editing commands.
  const titleResult = typeInto(title,post.title);
  if (!titleResult.ok) return {status:'title-command-failed',diagnostics:titleResult.diagnostics};
  if (!title.textContent.includes(post.title)) return {status:'title-not-confirmed'};
  const bodyResult = typeInto(body,content);
  if (!bodyResult.ok) return {status:'body-command-failed',diagnostics:bodyResult.diagnostics};
  const bodyText = document.querySelector('.se-section-text .se-module-text')?.textContent || '';
  return {status:bodyText.includes(post.content.slice(0,25)) ? 'input-visible' : 'body-not-confirmed',
    titleVisible:title.textContent.includes(post.title)};
}
