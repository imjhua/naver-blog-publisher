const status = document.getElementById('status');
(async () => {
  try {
    status.textContent = 'GitHub에서 최신 승인 글을 불러오는 중...';
    const response = await fetch(
      'https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/posts/latest.json',
      {cache:'no-store'}
    );
    if (!response.ok) throw new Error('GitHub 요청 실패 (HTTP '+response.status+')');
    const post = await response.json();
    if (post.status !== 'approved' ||
        typeof post.title !== 'string' || !post.title.startsWith('[요가 수련일지]') ||
        typeof post.content !== 'string' || !post.content.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(post.practiceDate) ||
        typeof post.practiceType !== 'string' ||
        typeof post.storeUrl !== 'string' || !post.storeUrl.startsWith('https://')) {
      throw new Error('승인된 글 형식이 올바르지 않습니다.');
    }
    const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (!tab?.id || !tab.url?.startsWith('https://blog.naver.com/')) {
      throw new Error('네이버 블로그 글쓰기 탭에서 실행하세요.');
    }
    // Only inspect the actual SmartEditor writing frame. Ignore unrelated
    // frames and placeholders; never overwrite a partially written draft.
    const existing = await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},
      func:()=>{
        if(!location.pathname.includes('PostWriteForm.naver'))return null;
        const titleEl=document.querySelector('.se-title-text .se-text-paragraph');
        const body=document.querySelector('.se-section-text');
        if(!titleEl||!body)return null;
        const title=(titleEl.textContent||'').trim();
        const paragraphs=[...body.querySelectorAll('.se-text-paragraph')];
        const bodyText=paragraphs.map(p=>(p.textContent||'').trim()).filter(Boolean).join('\\n');
        const hasCard=!!document.querySelector('.se-section-oglink,.se-module-oglink,.se-component-oglink,.se-component.se-oglink');
        return {title,bodyText,hasCard};
      }
    });
    const drafts=existing.map(x=>x.result).filter(Boolean);
    // A second empty/inactive editor frame must not cause a false positive.
    const populated=drafts.filter(x=>x.title||x.bodyText||x.hasCard);
    if(populated.some(x=>x.title===post.title&&
        x.bodyText.includes('smartstore.naver.com')&&x.hasCard)){
      status.textContent='이미 입력된 글이 확인됐습니다. 재입력하지 않았습니다. 발행 전 검토를 진행하세요.';
      return;
    }
    if(populated.length){
      status.textContent='실제 글쓰기 영역에 기존 작성 내용이 있어 자동 입력을 중단했습니다. 현재 글을 확인하세요.';
      return;
    }
    status.textContent = '제목과 본문을 자동 입력하는 중...';
    const result = await chrome.runtime.sendMessage({type:'fill-approved-post',post});
    if (!result?.ok) throw new Error(result?.error || '입력 요청 실패');
    if (result.result?.status === 'already-running') {
      status.textContent = '이미 자동 입력이 진행 중입니다. 다시 실행하지 않았습니다.';
      return;
    }
    if (result.result?.status !== 'input-visible') {
      throw new Error('입력 미완료 ('+(result.result?.status || 'unknown')+
        ') '+JSON.stringify(result.result?.diagnostics || {}));
    }
    status.textContent = '입력 완료. 제목, 문단, 서식을 확인하세요. 저장·발행하지 않았습니다.';
  } catch (error) {
    status.textContent = '자동 입력 실패: '+error.message;
  }
})();
