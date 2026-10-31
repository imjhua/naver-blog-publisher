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
    const probe = await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func: () => {
      const title=document.querySelector('.se-title-text .se-text-paragraph');
      const body=document.querySelector('.se-component.se-text .se-text-paragraph');
      if(!title||!body)return {match:false};
      const occupied=e=>!!e.querySelector('.__se-node')?.textContent?.trim();
      return {match:true,empty:!occupied(title)&&!occupied(body)};
    }});
    const matches=probe.filter(r=>r.result?.match);
    if(matches.length!==1||!matches[0].result.empty)throw Error('빈 글쓰기 에디터를 하나만 찾을 수 있어야 합니다.');
    const frameId=matches[0].frameId;
    const target={tabId:tab.id};
    await chrome.debugger.attach(target,'1.3');
    try {
      const focus=async kind=>{
        const results=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[frameId]},func:(which)=>{
          const selector=which==='title'?'.se-title-text .se-text-paragraph':'.se-component.se-text .se-text-paragraph';
          const el=document.querySelector(selector);
          if(!el)return false;
          el.click();
          const node=el.querySelector('.__se-node')||el;
          const range=document.createRange();
          range.selectNodeContents(node);range.collapse(false);
          const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
          return true;
        },args:[kind]});
        if(!results[0]?.result)throw Error('입력 위치를 선택하지 못했습니다: '+kind);
      };
      await focus('title');
      await chrome.debugger.sendCommand(target,'Input.insertText',{text:post.title});
      await focus('body');
      await chrome.debugger.sendCommand(target,'Input.insertText',{text:bodyText});
    } finally {
      await chrome.debugger.detach(target).catch(()=>{});
    }
    const check=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[frameId]},func:({titleText,bodyText})=>({
      titleVisible:document.querySelector('.se-title-text')?.innerText?.includes(titleText)||false,
      bodyVisible:document.querySelector('.se-component.se-text')?.innerText?.includes(bodyText.slice(0,12))||false
    }),args:[{titleText:post.title,bodyText}]});
    status.textContent='입력 결과 (저장·발행 없음): '+JSON.stringify(check[0]?.result||{},null,2)+'\\n실제 글쓰기 화면을 확인해 주세요.';

  } catch(e) {status.textContent='오류: '+e.message;}
});
