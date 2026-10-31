// Read-only discovery of Naver publish settings across frames and panels.
// Never clicks Save, Publish, or changes the editor.
(() => {
  const button=document.getElementById('inspectPublishDialog');
  const output=document.getElementById('publishDialogStatus');
  if(!button||!output)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.textContent='발행 설정 화면을 확인하는 중...';
    try {
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab?.id||!tab.url?.startsWith('https://blog.naver.com/'))
        throw new Error('네이버 블로그 글쓰기 화면에서 실행하세요.');
      const frames=await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:()=>{
          const visible=el=>{
            const r=el.getBoundingClientRect(),s=getComputedStyle(el);
            return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
          };
          const label=el=>(el.innerText||el.getAttribute('aria-label')||el.title||el.value||'').trim().slice(0,100);
          const detail=el=>({
            tag:el.tagName.toLowerCase(),
            className:typeof el.className==='string'?el.className.slice(0,180):'',
            role:el.getAttribute('role')||'',
            label:label(el),
            checked:el.checked??el.getAttribute('aria-checked')??null,
            disabled:!!el.disabled
          });
          const selectors=[
            '[role="dialog"]','[aria-modal="true"]','.layer_popup','.se-popup',
            '.publish_layer','[class*="publish" i]','[class*="Publish"]',
            '[class*="layer"]','[class*="modal"]','[class*="setting"]'
          ];
          const candidates=[...document.querySelectorAll(selectors.join(','))]
            .filter(visible).filter(el=>{
              const t=(el.innerText||'').slice(0,2500);
              return /발행|공개|비공개|예약|카테고리|태그/.test(t) &&
                t.length<5000;
            }).sort((a,b)=>(a.innerText||'').length-(b.innerText||'').length)
            .slice(0,8).map(el=>({
              ...detail(el),text:(el.innerText||'').trim().slice(0,1400),
              controls:[...el.querySelectorAll('button,input,select,label,[role="button"],[role="radio"],[role="checkbox"]')]
                .filter(visible).slice(0,35).map(detail)
            }));
          const actions=[...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')]
            .filter(visible).filter(el=>/발행|공개|예약|저장|취소|다음/.test(label(el)))
            .slice(0,25).map(detail);
          return {url:location.href,frameName:window.name||'',candidates,actions};
        }
      });
      const report=frames.map((frame,index)=>({frame:index,...frame.result}))
        .filter(x=>x.candidates?.length||x.actions?.length);
      output.textContent=report.length
        ? '발행 설정 UI 탐색 결과 (읽기 전용)\n'+JSON.stringify(report,null,2)+'\n실제 발행: 실행하지 않음'
        : '발행 설정 UI가 감지되지 않았습니다. 현재 화면에서 발행 설정이 열려 있는지 확인하세요.\n실제 발행: 실행하지 않음';
    }catch(error){output.textContent='확인 실패: '+error.message;}
    finally{button.disabled=false;}
  });
})();
