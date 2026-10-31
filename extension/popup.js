const status = document.getElementById('status');
document.getElementById('fill').addEventListener('click', async () => {
  try {
    const post = JSON.parse(document.getElementById('post').value);
    if (post.status !== 'approved' || typeof post.title !== 'string' || !post.title.startsWith('[요가 수련일지]') || !/^\\d{4}-\\d{2}-\\d{2}$/.test(post.practiceDate) || typeof post.practiceType !== 'string' || typeof post.storeUrl !== 'string' || typeof post.content !== 'string') throw Error('승인된 게시글 JSON 형식이 아닙니다.');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !tab.url?.startsWith('https://blog.naver.com/')) throw Error('네이버 블로그 글쓰기 탭에서 실행해 주세요.');
    const result = await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func: (p) => {
      if (!location.hostname.endsWith('blog.naver.com')) return {skip:true};
      const candidates = (selectors) => selectors.flatMap(s => [...document.querySelectorAll(s)]).filter(e => e.getClientRects().length);
      const title = candidates(['.se-title-text [contenteditable="true"]','.se-title-text .se-text-paragraph']);
      const body = candidates(['.se-main-container .se-component.se-text [contenteditable="true"]','.se-main-container .se-component.se-text .se-text-paragraph']);
      return {titleCount:title.length,bodyCount:body.length,frame:location.href};
    },args:[post]});
    const details = result.map(x=>x.result).filter(x=>x&&!x.skip);
    status.textContent = '에디터 탐지 결과 (입력 전 안전 점검): '+JSON.stringify(details);
  } catch (e) {status.textContent = '오류: '+e.message;}
});