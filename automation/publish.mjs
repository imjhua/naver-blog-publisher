import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const post=JSON.parse(fs.readFileSync('posts/latest.json','utf8'));
const requested=process.env.PUBLISH==='true'||process.argv.includes('--publish');
if(post.status!=='approved'||!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(post.id)||
  !post.title?.startsWith('[요가 수련일지]')||!post.content?.trim()||
  !/^\d{4}-\d{2}-\d{2}$/.test(post.practiceDate)||
  !post.practiceType||!/^https:\/\/smartstore\.naver\.com\//.test(post.storeUrl))
  throw Error('Approved post schema is invalid');
const receipt=path.join('posts/published',post.id+'.json');
if(fs.existsSync(receipt)){console.log('Already published:',post.id);process.exit(0);}
if(!requested){console.log('Dry run OK:',post.id,post.title);process.exit(0);}
if(!process.env.NAVER_STORAGE_STATE)throw Error('NAVER_STORAGE_STATE secret required');
let state;
try{state=JSON.parse(process.env.NAVER_STORAGE_STATE);}catch{throw Error('Invalid session JSON');}
if(!Array.isArray(state.cookies)||!state.cookies.some(c=>/\.?naver\.com$/.test(c.domain||'')))
  throw Error('Naver session cookies missing');

const browser=await chromium.launch({headless:true});
let submissionAttempted=false;
try{
  const context=await browser.newContext({storageState:state});
  const page=await context.newPage();
  await page.goto('https://blog.naver.com/PostWriteForm.naver?blogId=my-mysore',{waitUntil:'domcontentloaded',timeout:30000});
  if(/nid\.naver\.com|login/i.test(page.url()))throw Error('Naver login required');
  const frame=page.frameLocator('iframe#mainFrame');
  const title=frame.locator('.se-title-text .se-text-paragraph');
  const body=frame.locator('.se-section-text .se-module-text .se-text-paragraph').first();
  await title.waitFor({state:'visible',timeout:15000});
  await body.waitFor({state:'visible',timeout:15000});
  const existingTitle=(await title.innerText()).trim();
  const existingBody=(await body.innerText()).trim();
  if(existingTitle&&!['제목'].includes(existingTitle))throw Error('Editor title is not empty');
  if(existingBody&&!['글감과 함께 나의 일상을 기록해보세요!'].includes(existingBody))
    throw Error('Editor body is not empty');
  // Use real keyboard input, not DOM text injection. Each paragraph is a separate Enter.
  await title.click();
  await page.keyboard.insertText(post.title);
  const dateParts=post.practiceDate.split('-').map(Number);
  const date=dateParts[0]+'년 '+dateParts[1]+'월 '+dateParts[2]+'일 · '+post.practiceType;
  await body.click();
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.insertText(date);
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(post.storeUrl);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  for(const line of post.content.split('\n')){
    if(line)await page.keyboard.insertText(line);
    await page.keyboard.press('Enter');
  }
  const editor=frame.locator('body');
  await frame.locator('.se-section-oglink,.se-component-oglink,.se-component.se-oglink').first()
    .waitFor({state:'visible',timeout:15000});
  const paragraphs=frame.locator('.se-section-text .se-text-paragraph');
  const allText=await paragraphs.allTextContents();
  const text=allText.join('\n');
  if((await title.innerText()).trim()!==post.title||!text.includes(date)||
     !text.includes(post.storeUrl)||!post.content.split('\n').filter(Boolean).every(s=>text.includes(s)))
    throw Error('Editor content verification failed');
  const dateParagraph=paragraphs.filter({hasText:date}).first();
  const bold=await dateParagraph.evaluate(el=>{
    const nodes=[...el.querySelectorAll('span.__se-node')];
    return nodes.length>0&&nodes.every(n=>{
      for(let p=n;p&&p!==el.parentElement;p=p.parentElement){
        if(p.matches('b,strong')||parseInt(getComputedStyle(p).fontWeight,10)>=600)return true;
      }
      return false;
    });
  });
  if(!bold)throw Error('Date bold formatting not verified');
  const launch=frame.locator('button[class*="publish_btn__"]').filter({hasText:/^발행$/});
  if(await launch.count()!==1)throw Error('Publish launcher ambiguous');
  await launch.click();
  const confirm=frame.locator('button[class*="confirm_btn__"]').filter({hasText:/^발행$/});
  await confirm.waitFor({state:'visible',timeout:10000});
  if(await confirm.count()!==1||!(await confirm.isEnabled()))throw Error('Final publish button ambiguous');
  // No retries after this point: a timeout can mean a successful remote publish.
  submissionAttempted=true;
  await confirm.click({noWaitAfter:true});
  let url=null;
  try{
    await page.waitForURL(u=>/^https:\/\/blog\.naver\.com\/my-mysore\/\d+\/?$/.test(u.href),{timeout:20000});
    url=page.url();
  }catch{
    const link=page.locator('a[href*="/my-mysore/"]').filter({hasText:post.title}).first();
    if(await link.count())url=await link.getAttribute('href');
  }
  if(!url||!/^https:\/\/blog\.naver\.com\/my-mysore\/\d+\/?$/.test(new URL(url,page.url()).href))
    throw Error('Publish attempted; result unknown. Do not retry until manually checked.');
  const finalUrl=new URL(url,page.url()).href;
  await page.goto(finalUrl,{waitUntil:'domcontentloaded'});
  const visibleText=await page.locator('body').innerText();
  if(!visibleText.includes(post.title))throw Error('Publish URL found but title not verified; do not retry');
  fs.mkdirSync(path.dirname(receipt),{recursive:true});
  fs.writeFileSync(receipt,JSON.stringify({id:post.id,title:post.title,status:'published',
    blogUrl:finalUrl,postId:finalUrl.match(/\d+\/?$/)[0].replace('/',''),
    verifiedAt:new Date().toISOString()},null,2)+'\n');
  console.log('Verified publication:',finalUrl);
}catch(error){
  if(submissionAttempted)console.error('SUBMISSION MAY HAVE SUCCEEDED. DO NOT RETRY AUTOMATICALLY.');
  throw error;
}finally{await browser.close();}
