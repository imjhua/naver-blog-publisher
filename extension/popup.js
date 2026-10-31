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

document.getElementById('inspectPublish').addEventListener('click',async()=>{
  const output=document.getElementById('publishStatus');
  output.textContent='발행 화면과 입력 상태를 확인하는 중...';
  try {
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(!tab?.id) throw new Error('활성 탭을 찾지 못했습니다.');
    const response=await chrome.runtime.sendMessage({type:'inspect-publish-readiness',tabId:tab.id});
    if(!response?.ok) throw new Error(response?.error||'상태 확인 실패');
    const r=response.result;
    output.textContent=[
      '제목: '+(r.title||'없음'),
      '날짜: '+(r.hasDate?'확인':'미확인'),
      '날짜 볼드: '+(r.dateBold?'확인':'미확인'),
      '스토어 URL: '+(r.hasStoreUrl?'확인':'미확인'),
      '미리보기 카드: '+(r.hasCard?'확인':'미확인'),
      '본문: '+(r.hasProse?'확인':'미확인'),
      '발행 관련 버튼: '+(r.publishControls.map(x=>x.label).join(', ')||'감지되지 않음'),
      '발행 준비: '+(r.title && r.hasDate && r.dateBold && r.hasStoreUrl && r.hasCard && r.hasProse ? '검증 통과' : '확인 필요'),
      '실제 발행: 실행하지 않음'
    ].join('\\n');
  } catch(error) {output.textContent='확인 실패: '+error.message;}
});
