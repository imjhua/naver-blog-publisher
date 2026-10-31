const status = document.getElementById('status');
(async () => {
  try {
    status.textContent = 'GitHub에서 최신 승인 글을 불러오는 중...';
    // GitHub Contents API avoids stale raw.githubusercontent.com edge caches.
    const response = await fetch(
      'https://api.github.com/repos/imjhua/naver-blog-publisher/contents/posts/latest.json?ref=main&t='+Date.now(),
      {cache:'no-store',headers:{Accept:'application/vnd.github+json'}}
    );
    if (!response.ok) throw new Error('GitHub 요청 실패 (HTTP '+response.status+')');
    const file = await response.json();
    if (file.encoding !== 'base64' || typeof file.content !== 'string')
      throw new Error('GitHub 게시물 데이터 형식 오류');
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
    const post = JSON.parse(new TextDecoder().decode(bytes));
    status.textContent = 'GitHub 승인 글 확인: '+post.id+' / '+post.title;
    if (post.status !== 'approved' ||
        typeof post.title !== 'string' || !post.title.startsWith('[요가 수련일지]') ||
        typeof post.content !== 'string' || !post.content.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(post.practiceDate) ||
        typeof post.practiceType !== 'string' ||
        typeof post.storeUrl !== 'string' || !post.storeUrl.startsWith('https://')) {
      throw new Error('승인된 글 형식이 올바르지 않습니다.');
    }
    const {lastPublished}=await chrome.storage.local.get('lastPublished');
    if((lastPublished?.id && lastPublished.id===post.id) || (!lastPublished?.id && lastPublished?.title===post.title)){
      status.textContent='이 브라우저에서 발행 완료를 확인한 글입니다 ('+post.id+'). 재입력을 차단했습니다.\n게시 URL: '+lastPublished.blogUrl;
      return;
    }
    // GitHub is the durable publication ledger. A published marker blocks
    // another autofill even when the editor itself is empty.
    const publishedResponse=await fetch(
      'https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/posts/published/'+encodeURIComponent(post.id)+'.json?ts='+Date.now(),
      {cache:'no-store'}
    );
    if(publishedResponse.ok){
      const published=await publishedResponse.json();
      if(published.status==='published'&&published.id===post.id){
        status.textContent='이미 발행된 글입니다. 중복 입력을 차단했습니다.\\n게시 URL: '+published.blogUrl;
        return;
      }
    }else if(publishedResponse.status!==404){
      throw new Error('발행 이력을 확인할 수 없어 중복 입력을 차단했습니다 (HTTP '+publishedResponse.status+')');
    }
    const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (!tab?.id || !tab.url?.startsWith('https://blog.naver.com/')) {
      throw new Error('네이버 블로그 글쓰기 탭에서 실행하세요.');
    }
    status.textContent = '새 글 확인 ('+post.id+'): '+post.title+'\n제목과 본문을 자동 입력하는 중...';
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
    status.textContent = '자동 입력 완료. 발행 설정 검증과 게시를 자동 진행합니다...';
    window.dispatchEvent(new Event('mysore-autopublish'));
  } catch (error) {
    status.textContent = '자동 입력 실패: '+error.message;
  }
})();
