const status = document.getElementById('status');
let post = null;
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