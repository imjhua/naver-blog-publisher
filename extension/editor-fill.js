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
    el.click();
    el.focus();
    const active = document.activeElement;
    const selection = window.getSelection();
    const node = el.querySelector('span.__se-node') || el;
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    const before = {
      activeTag: active?.tagName || null,
      activeEditable: active?.getAttribute('contenteditable') || null,
      elementEditable: el.isContentEditable,
      nodeEditable: node.isContentEditable,
      selectionCount: selection.rangeCount,
      selectionInside: !!selection.anchorNode && el.contains(selection.anchorNode),
      nodeTag: node.tagName,
      frameUrlPath: location.pathname
    };
    const textResult = document.execCommand('insertText',false,value);
    if (el.textContent?.includes(value)) return {ok:true,method:'insertText'};
    const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const html = value.split('\\n').map(escapeHtml).join('<br>');
    const htmlResult = document.execCommand('insertHTML',false,html);
    if (el.textContent?.includes(value.split('\\n')[0])) return {ok:true,method:'insertHTML'};
    return {ok:false,diagnostics:{...before,textResult,htmlResult,
      activeAfter:document.activeElement?.tagName || null,
      selectedText:selection.toString().slice(0,60)}};
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
