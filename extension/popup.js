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
    const date = post.practiceDate.split('-').map(Number);
    const bodyText = `${date[0]}년 ${date[1]}월 ${date[2]}일 · ${post.practiceType}\n${post.storeUrl}\n\n${post.content}`;
    const results = await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},
      func: ({titleText,bodyText}) => {
        if (location.hostname !== 'blog.naver.com') return {skip:true};
        const title = document.querySelector('.se-title-text .se-text-paragraph');
        const body = document.querySelector('.se-component.se-text .se-text-paragraph');
        if (!title || !body) return {skip:true};
        const hasContent = element => !!element.querySelector('.__se-node')?.textContent?.trim();
        if (hasContent(title) || hasContent(body)) return {error:'이미 작성된 내용이 있어 입력하지 않았습니다.'};
        const type = (element,text) => {
          element.click();
          element.focus();
          const range = document.createRange();
          const node = element.querySelector('.__se-node') || element;
          range.selectNodeContents(node);
          range.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return document.execCommand('insertText',false,text);
        };
        const titleOK = type(title,titleText);
        const bodyOK = type(body,bodyText);
        return {titleCommand:titleOK,bodyCommand:bodyOK,titleVisible:document.querySelector('.se-title-text')?.innerText?.includes(titleText) || false,bodyVisible:document.querySelector('.se-component.se-text')?.innerText?.includes(bodyText.slice(0,12)) || false};
      },
      args:[{titleText:post.title,bodyText}]
    });
    const outcome = results.map(x=>x.result).filter(x=>x&&!x.skip);
    status.textContent = '입력 테스트 결과 (저장·발행 없음): '+JSON.stringify(outcome,null,2)+'\n실제 글쓰기 화면의 제목·본문도 확인해 주세요.';
  } catch(e) {status.textContent='오류: '+e.message;}
});
