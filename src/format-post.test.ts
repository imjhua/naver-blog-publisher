import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPost } from './format-post.js';

test('formats approved post with Korean date and store link', () => {
  const result = formatPost({
    id: '2026-10-31', status: 'approved',
    title: '[요가 수련일지] 오늘의 수련',
    practiceDate: '2026-10-31', practiceType: '아쉬탕가',
    storeUrl: 'https://smartstore.naver.com/my-mysore/products/13836041036',
    content: '원문을 그대로 유지한다.',
  });
  assert.equal(result.title, '[요가 수련일지] 오늘의 수련');
  assert.equal(result.body, '2026년 10월 31일 · 아쉬탕가\\n\\nhttps://smartstore.naver.com/my-mysore/products/13836041036\\n\\n원문을 그대로 유지한다.'.replaceAll('\\n', '\n'));
});

test('rejects unapproved posts', () => {
  assert.throws(() => formatPost({ status: 'draft' }));
});
