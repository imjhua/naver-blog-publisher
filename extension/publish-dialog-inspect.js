// Read-only inspection of Naver's publish settings dialog.
// Does not click the Publish button or change the editor.
(() => {
  const button=document.getElementById('inspectPublishDialog');
  const output=document.getElementById('publishDialogStatus');
  if(!button || !output)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.textContent='발행 설정 화면을 확인하는 중...';
    try{
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab?.id || !tab.url?.startsWith('https://blog.naver.com/'))
        throw new Error('네이버 블로그 글쓰기 화면에서 실행하세요.');
      const frames=await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:()=>{
          const visible=el=>!!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
          const dialogs=[...document.querySelectorAll('[role="dialog"],[aria-modal="true"],.layer_popup,.se-popup,.publish_layer')]
            .filter(visible).map(el=>({
              text:(el.innerText||'').trim().slice(0,1200),
              controls:[...el.querySelectorAll('button,input,select,[role="button"],[role="radio"],[role="checkbox"]')]
                .filter(visible).map(node=>({
                  type:node.tagName.toLowerCase(),
                  label:(node.innerText||node.getAttribute('aria-label')||node.title||'').trim().slice(0,80),
                  checked:node.checked??node.getAttribute('aria-checked')??null,
                  disabled:!!node.disabled
                })).slice(0,30)
            })).slice(0,4);
          const actions=[...document.querySelectorAll('button,[role="button"]')].filter(visible)
            .map(el=>({label:(el.innerText||el.getAttribute('aria-label')||el.title||'').trim().slice(0,80),
              disabled:!!el.disabled})).filter(x=>/발행|공개|예약|저장/.test(x.label)).slice(0,15);
          return {dialogs,actions};
        }
      });
      const dialogs=frames.flatMap(x=>x.result?.dialogs||[]);
      const actions=frames.flatMap(x=>x.result?.actions||[]);
      output.textContent=dialogs.length
        ? '발행 설정 대화상자 '+dialogs.length+'개 감지\n'+JSON.stringify(dialogs,null,2)+'\n실제 발행: 실행하지 않음'
        : '현재 열린 발행 설정 대화상자가 없습니다.\n화면에서 발행 설정을 연 다음 다시 확인해 주세요.\n감지된 버튼: '+(actions.map(x=>x.label).filter(Boolean).join(', ')||'없음')+'\n실제 발행: 실행하지 않음';
    }catch(error){output.textContent='확인 실패: '+error.message;}
    finally{button.disabled=false;}
  });
})();
