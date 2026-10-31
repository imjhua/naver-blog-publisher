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
    const range = document.createRange();
    const node = el.querySelector('span.__se-node') || el;
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return document.execCommand('insertText',false,value);
  }
  // Input only. The SmartEditor may reject synthetic editing commands.
  if (!typeInto(title,post.title)) return {status:'title-command-failed'};
  if (!title.textContent.includes(post.title)) return {status:'title-not-confirmed'};
  if (!typeInto(body,content)) return {status:'body-command-failed'};
  const bodyText = document.querySelector('.se-section-text .se-module-text')?.textContent || '';
  return {status:bodyText.includes(post.content.slice(0,25)) ? 'input-visible' : 'body-not-confirmed',
    titleVisible:title.textContent.includes(post.title)};
}
