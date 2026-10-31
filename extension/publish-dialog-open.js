// Open only the first-stage publish settings panel; never submit a post.
(() => {
  const button=document.getElementById('openPublishSettings');
  const output=document.getElementById('publishDialogStatus');
  if(!button||!output)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.textContent='발행 설정 화면을 여는 중...';
    try{
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab?.id||!tab.url?.startsWith('https://blog.naver.com/'))
        throw new Error('네이버 블로그 글쓰기 화면에서 실행하세요.');
      const frames=await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:()=>{
          if(window.name!=='mainFrame'&&!location.pathname.includes('PostWriteForm.naver'))
            return {status:'not-editor-frame'};
          const visible=el=>{
            const r=el.getBoundingClientRect(),s=getComputedStyle(el);
            return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
          };
          const launch=[...document.querySelectorAll('button[class*="publish_btn__"]')]
            .filter(visible).filter(el=>el.textContent.trim()==='발행');
          if(launch.length!==1)return {status:'launch-button-ambiguous',count:launch.length};
          // The launcher is identified by the known header class and is not
          // inside a dialog. Refuse to click if the settings UI is already open.
          const trigger=launch[0];
          if(trigger.closest('[role="dialog"],[aria-modal="true"],[class*="modal"],[class*="layer"]'))
            return {status:'unsafe-launch-context'};
          if(document.querySelector('[role="dialog"][aria-modal="true"]'))
            return {status:'dialog-already-open'};
          trigger.click();
          return {status:'launcher-clicked',frame:window.name||location.pathname};
        }
      });
      const result=frames.map(x=>x.result).find(x=>x?.status==='launcher-clicked');
      if(result){
        output.textContent='발행 설정 열기 버튼을 클릭했습니다.\n발행 설정 UI를 확인하려면 아래 「발행 설정 화면 확인」을 누르세요.\n실제 발행: 실행하지 않음';
      }else{
        output.textContent='발행 설정을 열지 않았습니다.\n'+JSON.stringify(frames.map(x=>x.result).filter(x=>x?.status!=='not-editor-frame'))+'\n실제 발행: 실행하지 않음';
      }
    }catch(error){output.textContent='발행 설정 열기 실패: '+error.message;}
    finally{button.disabled=false;}
  });
})();
