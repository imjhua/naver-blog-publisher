import { readFileSync } from 'node:fs';
import { Post } from './schema.js';
const path = process.argv[2];
if (!path) throw new Error('Usage: npm run validate -- posts/example.json');
const post = Post.parse(JSON.parse(readFileSync(path, 'utf8')));
console.log('Approved post validated:', post.id);
