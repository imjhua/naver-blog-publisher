// Publishing preparation only. Never modifies SmartEditor or clicks Publish.
(() => {
  const button=document.getElementById('inspectPublish');
  const output=document.getElementById('publishStatus');
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.textContent='발행 화면을 읽기 전용으로 확인하는 중...';
    try {
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
      if(!tab?.id || !tab.url?.startsWith('https://blog.naver.com/'))
        throw new Error('네이버 블로그 글쓰기 탭에서 실행하세요.');
      const frames=await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:()=>{
          const visible=el=>!!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
          const title=document.querySelector('.se-title-text .se-text-paragraph');
          const paragraphs=[...document.querySelectorAll('.se-section-text .se-text-paragraph')];
          const date=paragraphs.find(p=>/^\d{4}년\s+\d{1,2}월\s+\d{1,2}일/.test((p.textContent||'').trim()));
          // Match the verified autofill check: SmartEditor splits the date
          // across text nodes and places <b> inside __se-node spans.
          const isDateBold=p=>{
            if(!p)return false;
            const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
            const parts=[];
            while(walker.nextNode()){
              const node=walker.currentNode;
              if(!node.textContent.trim())continue;
              let el=node.parentElement;
              let bold=false;
              while(el && el!==p.parentElement){
                if(el.matches('b,strong') ||
                   /(?:^|\\s)(?:se-bold|se-text-format-bold)(?:\\s|$)/.test(el.className||'') ||
                   Number.parseInt(getComputedStyle(el).fontWeight,10)>=600){
                  bold=true;break;
                }
                el=el.parentElement;
              }
              parts.push({text:node.textContent,bold});
            }
            return parts.length>0 &&
              parts.map(x=>x.text).join('').trim()===(p.textContent||'').trim() &&
              parts.every(x=>x.bold);
          };
          const bold=isDateBold(date);
          const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(visible)
            .map(el=>({label:(el.innerText||el.getAttribute('aria-label')||el.title||'').trim().slice(0,50),
              tag:el.tagName,disabled:!!el.disabled}))
            .filter(x=>/발행|공개|저장|게시/.test(x.label)).slice(0,10);
          return {editor:!!title,title:(title?.textContent||'').trim(),
            hasDate:!!date,dateBold:bold,
            hasStoreUrl:paragraphs.some(p=>(p.textContent||'').includes('smartstore.naver.com')),
            hasCard:!!document.querySelector('.se-section-oglink,.se-module-oglink,.se-component-oglink,.se-component.se-oglink'),
            paragraphCount:paragraphs.length,buttons};
        }
      });
      const editor=frames.find(f=>f.result?.editor)?.result;
      const buttons=frames.flatMap(f=>f.result?.buttons||[]);
      if(!editor)throw new Error('글쓰기 화면을 찾지 못했습니다.');
      const lines=[
        '제목: '+(editor.title||'미확인'),
        '날짜: '+(editor.hasDate?'확인':'미확인'),
        '날짜 볼드: '+(editor.dateBold?'확인':'미확인'),
        '스토어 URL: '+(editor.hasStoreUrl?'확인':'미확인'),
        '미리보기 카드: '+(editor.hasCard?'확인':'미확인'),
        '본문 문단 수: '+editor.paragraphCount,
        '발행 관련 버튼: '+(buttons.map(b=>b.label).filter(Boolean).join(', ')||'미확인'),
        '발행: 실행하지 않음'
      ];
      output.textContent=lines.join('\n');
    } catch(error){output.textContent='확인 실패: '+error.message;}
    finally{button.disabled=false;}
  });
})();
