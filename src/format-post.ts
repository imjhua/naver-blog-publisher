import type { z } from 'zod';
import { Post } from './schema.js';

type ApprovedPost = z.infer<typeof Post>;

/** Produces the exact editor text without changing the author's wording. */
export function formatPost(input: unknown): { title: string; body: string } {
  const post: ApprovedPost = Post.parse(input);
  const [year, month, day] = post.practiceDate.split('-').map(Number);
  const dateLine = `${year}년 ${month}월 ${day}일 · ${post.practiceType}`;
  const body = [dateLine, post.storeUrl, post.content.trim()].join('\n\n');
  return { title: post.title, body };
}
