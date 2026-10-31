const status = document.getElementById('status');
const textarea = document.getElementById('post');
document.getElementById('file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  textarea.value = await file.text();
  status.textContent = '파일을 불러왔습니다. 테스트 버튼을 눌러주세요.';
});
document.getElementById('fill').addEventListener('click', async () => {
  try {
    const post = JSON.parse(textarea.value);
    if (post.status !== 'approved' || typeof post.title !== 'string' || !post.title.startsWith('[요가 수련일지]') || !/^\d{4}-\d{2}-\d{2}$/.test(post.practiceDate) || typeof post.practiceType !== 'string' || typeof post.storeUrl !== 'string' || typeof post.content !== 'string') throw Error('승인된 게시글 JSON 형식이 아닙니다.');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !tab.url?.startsWith('https://blog.naver.com/')) throw Error('네이버 블로그 글쓰기 탭에서 실행해 주세요.');
    const result = await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func: () => {
      if (location.hostname !== 'blog.naver.com') return {skip:true};
      const visible = e => !!e.getClientRects().length;
      const sample = (e) => ({tag:e.tagName.toLowerCase(),cls:String(e.className || '').slice(0,100),role:e.getAttribute('role'),editable:e.getAttribute('contenteditable'),placeholder:e.getAttribute('placeholder') || e.getAttribute('data-placeholder'),outer:e.outerHTML.slice(0,260)});
      const candidates = [...document.querySelectorAll('[contenteditable], [role="textbox"], textarea, input, .se-title-text, .se-main-container, .se-text-paragraph')].filter(visible);
      const title = [...document.querySelectorAll('.se-title-text [contenteditable="true"], .se-title-text .se-text-paragraph')].filter(visible);
      const body = [...document.querySelectorAll('.se-main-container .se-component.se-text [contenteditable="true"], .se-main-container .se-component.se-text .se-text-paragraph')].filter(visible);
      return {titleCount:title.length,bodyCount:body.length,framePath:location.pathname,documentReady:document.readyState,visibleCandidates:candidates.length,samples:candidates.slice(0,12).map(sample)};
    }});
    const details = result.map(x=>x.result).filter(x=>x&&!x.skip);
    status.textContent = '에디터 구조 진단 (입력·저장·발행 없음): '+JSON.stringify(details,null,2);

  } catch (e) {status.textContent = '오류: '+e.message;}
});
