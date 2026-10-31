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
      const visible = (selectors) => [...new Set(selectors.flatMap(s => [...document.querySelectorAll(s)]))].filter(e => e.getClientRects().length);
      const title = visible(['.se-title-text [contenteditable="true"]','.se-title-text .se-text-paragraph']);
      const body = visible(['.se-main-container .se-component.se-text [contenteditable="true"]','.se-main-container .se-component.se-text .se-text-paragraph']);
      return {titleCount:title.length,bodyCount:body.length,frame:location.href};
    }});
    const details = result.map(x=>x.result).filter(x=>x&&!x.skip);
    status.textContent = '에디터 탐지 결과 (입력 전 안전 점검): '+JSON.stringify(details);
  } catch (e) {status.textContent = '오류: '+e.message;}
});
