// Explicit, user-initiated publish review and final approval.
// No editor content is modified. The final submit requires two distinct clicks.
(() => {
  const review=document.getElementById('reviewFinalPublish');
  const submit=document.getElementById('confirmFinalPublish');
  const output=document.getElementById('finalPublishStatus');
  if(!review||!submit||!output)return;
  let approvedSnapshot=null;
  const inspect=async(tabId)=>{
    const frames=await chrome.scripting.executeScript({
      target:{tabId,allFrames:true},
      func:()=>{
        if(!location.pathname.includes('PostWriteForm.naver'))return null;
        const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
        const title=(document.querySelector('.se-title-text .se-text-paragraph')?.textContent||'').trim();
        const ps=[...document.querySelectorAll('.se-section-text .se-text-paragraph')];
        const date=ps.find(p=>/^\d{4}년\s+\d{1,2}월\s+\d{1,2}일/.test((p.textContent||'').trim()));
        const bold=!!date&&[...date.querySelectorAll('b,strong')].some(visible);
        const url=ps.some(p=>(p.textContent||'').includes('smartstore.naver.com'));
        const card=!!document.querySelector('.se-section-oglink,.se-module-oglink,.se-component-oglink,.se-component.se-oglink');
        const final=[...document.querySelectorAll('button[class*="confirm_btn__"]')].filter(visible)
          .filter(el=>el.textContent.trim()==='발행'&&!el.disabled);
        const close=[...document.querySelectorAll('button[class*="publish_fold_btn__"]')].filter(visible);
        const settings=[...document.querySelectorAll('input[type="radio"],input[type="checkbox"],select')]
          .filter(visible).slice(0,25).map(el=>({
            type:el.type||el.tagName.toLowerCase(),checked:!!el.checked,
            label:(el.closest('label')?.innerText||el.getAttribute('aria-label')||el.name||'').trim().slice(0,100)
          }));
        return {title,date:date?.textContent.trim()||'',bold,url,card,
          paragraphCount:ps.length,finalCount:final.length,settingsOpen:final.length===1,settings};
      }
    });
    const results=frames.map(x=>x.result).filter(Boolean);
    const editor=results.find(x=>x.title&&x.date&&x.card)||
      results.find(x=>x.title);
    if(!editor)return null;
    // Editor content and publish controls may live in different frames.
    const panels=results.filter(x=>x.finalCount>0);
    const panel=panels.length===1?panels[0]:null;
    return {...editor,settingsOpen:!!panel,finalCount:panel?.finalCount||0,
      settings:panel?.settings||[],panelCount:panels.length};
  };
  const openSettings=async(tabId)=>{
    const frames=await chrome.scripting.executeScript({
      target:{tabId,allFrames:true},
      func:()=>{
        if(!location.pathname.includes('PostWriteForm.naver'))return null;
        const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
        const final=[...document.querySelectorAll('button[class*="confirm_btn__"]')]
          .filter(visible).filter(el=>el.textContent.trim()==='발행'&&!el.disabled);
        if(final.length===1)return {status:'already-open'};
        const launch=[...document.querySelectorAll('button[class*="publish_btn__"]')]
          .filter(visible).filter(el=>el.textContent.trim()==='발행'&&!el.disabled);
        if(launch.length!==1)return {status:'launcher-not-unique',count:launch.length};
        if(launch[0].closest('[role="dialog"],[aria-modal="true"],[class*="modal"],[class*="layer"]'))
          return {status:'unsafe-launch-context'};
        launch[0].click();
        return {status:'opened'};
      }
    });
    const results=frames.map(x=>x.result).filter(Boolean);
    const success=results.filter(x=>['opened','already-open'].includes(x.status));
    // Naver may have multiple PostWriteForm frames. Ignore non-editor frames
    // without a launcher; require exactly one successful editor frame.
    if(success.length!==1)
      throw Error('발행 설정을 안전하게 열지 못했습니다: '+JSON.stringify(results));
  };
  review.addEventListener('click',async()=>{
    submit.disabled=true;
    approvedSnapshot=null;
    output.textContent='발행 직전 상태를 확인하는 중...';
    try{
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab?.id||!tab.url?.startsWith('https://blog.naver.com/'))throw Error('네이버 블로그 글쓰기 탭이 필요합니다.');
      let state=await inspect(tab.id);
      if(state&&!state.settingsOpen){
        output.textContent='발행 설정을 자동으로 여는 중...';
        await openSettings(tab.id);
        state=await inspect(tab.id);
      }
      if(!state)throw Error('글쓰기 내용을 확인하지 못했습니다.');
      output.textContent='발행 직전 확인\n제목: '+state.title+
        '\n날짜: '+state.date+'\n날짜 볼드: '+(state.bold?'확인':'미확인')+
        '\n스토어 링크: '+(state.url?'확인':'미확인')+
        '\n미리보기 카드: '+(state.card?'확인':'미확인')+
        '\n본문 문단: '+state.paragraphCount+
        '\n발행 설정: '+(state.settingsOpen?'열림':'닫힘')+
        '\n최종 발행 버튼: '+state.finalCount+'개'+
        '\n선택 옵션: '+JSON.stringify(state.settings)+
        '\n아직 발행하지 않았습니다.';
      if(!state.title||!state.date||!state.bold||!state.url||!state.card||
         state.paragraphCount<4||!state.settingsOpen||state.finalCount!==1)
        throw Error('필수 검증을 통과하지 못했습니다. 발행은 차단했습니다.');
      approvedSnapshot={tabId:tab.id,title:state.title,date:state.date,paragraphCount:state.paragraphCount};
      submit.disabled=false;
    }catch(error){output.textContent+='\n발행 준비 실패: '+error.message;}
  });
  submit.addEventListener('click',async()=>{
    const snapshot=approvedSnapshot;
    approvedSnapshot=null;
    submit.disabled=true;
    if(!snapshot)return;
    if(!confirm('다음 글을 네이버 블로그에 실제로 발행할까요?\n\n'+snapshot.title+'\n\n확인을 누르면 공개 게시가 실행될 수 있습니다.'))return;
    try{
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(tab?.id!==snapshot.tabId)throw Error('글쓰기 탭이 변경됐습니다.');
      const current=await inspect(tab.id);
      if(!current||current.title!==snapshot.title||current.date!==snapshot.date||
        current.paragraphCount!==snapshot.paragraphCount||!current.bold||
        !current.url||!current.card||!current.settingsOpen||current.finalCount!==1)
        throw Error('발행 직전 상태가 변경됐습니다. 다시 검토해 주세요.');
      const frames=await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:()=>{
          if(!location.pathname.includes('PostWriteForm.naver'))return null;
          const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
          const buttons=[...document.querySelectorAll('button[class*="confirm_btn__"]')]
            .filter(visible).filter(el=>el.textContent.trim()==='발행'&&!el.disabled);
          if(buttons.length!==1)return {clicked:false};
          buttons[0].click();
          return {clicked:true};
        }
      });
      if(frames.filter(x=>x.result?.clicked).length!==1)throw Error('최종 발행 버튼이 고유하게 확인되지 않았습니다.');
      output.textContent='최종 발행 버튼을 클릭했습니다.\n게시 성공 여부는 네이버 블로그 화면에서 확인해야 합니다.\n중복 발행 방지를 위해 재시도 버튼은 비활성화했습니다.';
    }catch(error){output.textContent='발행 실행 안 됨 또는 결과 미확인: '+error.message+'\n중복 클릭하지 말고 네이버 블로그에서 게시 여부를 확인하세요.';}
  });
})();
