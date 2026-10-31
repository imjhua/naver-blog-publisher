const status = document.getElementById('status');
let post = null;
document.getElementById('testBadge').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({type:'test-new-badge'});
    if (!result?.ok) throw new Error(result?.error || '알림 테스트 실패');
    status.textContent = '테스트 NEW 배지를 표시했어요. 팝업을 닫고 Chrome 툴바의 확장 아이콘을 확인하세요.';
  } catch(error) {status.textContent = '오류: ' + error.message;}
});
document.getElementById('file').addEventListener('change', async event => {
  post = null;
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    if (parsed.status !== 'approved' ||
        typeof parsed.title !== 'string' || !parsed.title.startsWith('[요가 수련일지]') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(parsed.practiceDate) ||
        typeof parsed.practiceType !== 'string' || !parsed.practiceType.trim() ||
        typeof parsed.storeUrl !== 'string' || !parsed.storeUrl.startsWith('https://') ||
        typeof parsed.content !== 'string' || !parsed.content.trim()) {
      throw new Error('승인된 게시글 JSON 형식이 아닙니다.');
    }
    post = parsed;
    status.textContent = '파일 준비 완료: ' + post.title;
  } catch (error) { status.textContent = '오류: ' + error.message; }
});
document.getElementById('loadGithub').addEventListener('click', async () => {
  try {
    post = null;
    status.textContent = 'GitHub에서 승인 글을 불러오는 중...';
    const url = 'https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/posts/latest.json';
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error('GitHub 불러오기 실패: HTTP ' + response.status);
    const parsed = await response.json();
    if (parsed.status !== 'approved' || typeof parsed.title !== 'string' ||
        !parsed.title.startsWith('[요가 수련일지]') ||
        typeof parsed.content !== 'string' || !parsed.content.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(parsed.practiceDate) ||
        typeof parsed.practiceType !== 'string' ||
        typeof parsed.storeUrl !== 'string' || !parsed.storeUrl.startsWith('https://')) {
      throw new Error('승인된 게시글 JSON 형식이 아닙니다.');
    }
    post = parsed;
    await chrome.runtime.sendMessage({type:'approved-post-loaded',post});
    status.textContent = '최신 승인 글 불러오기 완료: ' + post.title;
  } catch(error) {status.textContent = '오류: ' + error.message;}
});
document.getElementById('autoFill').addEventListener('click', async () => {
  try {
    ensurePost();
    // Chrome may omit tab.url in extension popups. Do not use URL as a gate;
    // the injected script verifies the Naver editor structure instead.
    const tabs = await chrome.tabs.query({active:true,currentWindow:true});
    const tab = tabs[0];
    if (!tab?.id) throw new Error('활성 탭을 찾지 못했습니다.');
    status.textContent = '빈 에디터인지 확인하고 입력하는 중...';
    await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},files:['editor-fill.js']
    });
    const results = await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},
      func:(approved) => fillApprovedPostInFrame(approved),
      args:[post]
    });
    const outcomes = results.map(item => item.result).filter(Boolean);
    const active = outcomes.filter(item => item.status !== 'not-editor-frame' && item.status !== 'not-visible');
    if (active.length !== 1) {
      throw new Error('편집기 인식 실패 또는 중복 감지: ' + JSON.stringify(active));
    }
    const result = active[0];
    if (result.status !== 'input-visible') {
      throw new Error('입력 미완료 (' + result.status + '). 화면을 확인하세요.');
    }
    status.textContent = '자동 입력 결과 확인 필요: 제목과 본문 텍스트가 감지됐습니다. 서식·링크 카드·줄바꿈을 직접 확인하세요. 저장·발행은 실행하지 않았습니다.';
  } catch(error) {
    status.textContent = '자동 입력 테스트 오류: ' + error.message + ' (기존 복사 기능 사용 가능)';
  }
});
const ensurePost = () => {
  if (!post) throw new Error('먼저 승인된 JSON 파일을 선택하세요.');
};
document.getElementById('copyTitle').addEventListener('click', async () => {
  try {
    ensurePost();
    await navigator.clipboard.writeText(post.title);
    status.textContent = '제목 복사 완료. 네이버 제목 칸에 ⌘V로 붙여넣으세요.';
  } catch (error) { status.textContent = '오류: ' + error.message; }
});
document.getElementById('copyBody').addEventListener('click', async () => {
  try {
    ensurePost();
    const [year,month,day] = post.practiceDate.split('-').map(Number);
    const body = `${year}년 ${month}월 ${day}일 · ${post.practiceType}\n${post.storeUrl}\n\n${post.content}`;
    await navigator.clipboard.writeText(body);
    status.textContent = '본문 복사 완료. 네이버 본문 칸에 ⌘V로 붙여넣으세요.';
  } catch (error) { status.textContent = '오류: ' + error.message; }
});
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[character]);
const boldHtml = value => value.split(/(\*\*[^*\n]+\*\*)/g).map(segment =>
  segment.startsWith('**') && segment.endsWith('**')
    ? '<strong>' + escapeHtml(segment.slice(2,-2)) + '</strong>'
    : escapeHtml(segment)
).join('');
const makeRichBody = data => {
  const [year,month,day] = data.practiceDate.split('-').map(Number);
  const dateLine = `${year}년 ${month}월 ${day}일 · ${data.practiceType}`;
  const paragraphs = data.content.split(/\n\s*\n/).map(p =>
    '<p>' + p.split('\n').map(boldHtml).join('<br>') + '</p>'
  ).join('');
  const html = '<html><body><p><em>' + escapeHtml(dateLine) +
    '</em></p><p><a href="' + escapeHtml(data.storeUrl) + '">' +
    escapeHtml(data.storeUrl) + '</a></p><p><br></p>' + paragraphs + '</body></html>';
  const plain = dateLine + '\n' + data.storeUrl + '\n\n' + data.content.replace(/\*\*([^*\n]+)\*\*/g,'$1');
  return {html,plain};
};
document.getElementById('copyRichBody').addEventListener('click', async () => {
  try {
    ensurePost();
    const {html,plain} = makeRichBody(post);
    if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('서식 클립보드를 지원하지 않는 브라우저입니다. 일반 본문 복사를 사용하세요.');
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':new Blob([html],{type:'text/html'}),
      'text/plain':new Blob([plain],{type:'text/plain'})
    })]);
    status.textContent = '서식 포함 본문 복사 완료. 네이버 본문에 ⌘V로 붙여넣고 날짜 Italic, 강조 Bold, 문단을 확인하세요. 링크 카드 생성은 별도 검증이 필요합니다.';
  } catch(error) { status.textContent='오류: '+error.message; }
});
