import { readFileSync } from 'node:fs';
import { Post } from './schema.js';
const path = process.argv[2];
if (!path) throw new Error('Usage: npm run publish -- posts/example.json');
const post = Post.parse(JSON.parse(readFileSync(path, 'utf8')));
console.log('DRY RUN — approved post:', post.id);
console.log('Publishing disabled until Naver editor and authentication are verified.');
