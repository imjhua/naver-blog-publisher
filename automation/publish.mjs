import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const post=JSON.parse(fs.readFileSync('posts/latest.json','utf8'));
const real=process.env.PUBLISH==='true'||process.argv.includes('--publish');
if(post.status!=='approved'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(post.id)||!post.title?.startsWith('[요가 수련일지]')||!post.content?.trim())
  throw Error('Approved post is invalid');
const receipt=path.join('posts/published',post.id+'.json');
if(fs.existsSync(receipt)){
  console.log('Already published; refusing duplicate:',post.id);
  process.exit(0);
}
if(!real){
  console.log('Dry run: approved, unpublished post found:',post.id,post.title);
  process.exit(0);
}
if(!process.env.NAVER_STORAGE_STATE)throw Error('NAVER_STORAGE_STATE secret is required');
let state;
try{state=JSON.parse(process.env.NAVER_STORAGE_STATE);}catch{throw Error('Invalid storage state JSON');}
if(!Array.isArray(state.cookies)||!state.cookies.some(c=>c.domain?.includes('naver.com')))
  throw Error('Naver session cookies missing');
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({storageState:state});
  const page=await context.newPage();
  await page.goto('https://blog.naver.com/my-mysore',{waitUntil:'domcontentloaded'});
  // Fail closed: login challenges and unsupported editor DOM must not publish.
  if(/nid.naver.com|login/i.test(page.url()))throw Error('Naver login required; refresh the session securely');
  await page.goto('https://blog.naver.com/PostWriteForm.naver?blogId=my-mysore',{waitUntil:'domcontentloaded'});
  const frame=page.frames().find(f=>f.url().includes('PostWriteForm.naver')&&f.locator('.se-title-text .se-text-paragraph').count());
  // This runner deliberately does not submit until the SmartEditor interactions
  // have been validated independently in headless Chromium.
  throw Error('Safe stop: headless SmartEditor input and final publish are not validated. No post submitted.');
}finally{await browser.close();}
