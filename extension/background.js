const activeFillTabs = new Set();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'fill-approved-post') return;
  (async () => {
    if (!chrome.scripting?.executeScript) {
      throw new Error('Chrome scripting API 사용 불가. 확장 프로그램을 제거 후 최신 extension 폴더로 다시 로드하세요.');
    }
    const post = message.post;
    if (!post || post.status !== 'approved' || typeof post.title !== 'string' ||
        typeof post.content !== 'string') throw new Error('승인 글 데이터가 올바르지 않습니다.');
    const [tab] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (!tab?.id) throw new Error('활성 탭을 찾지 못했습니다.');
    if (activeFillTabs.has(tab.id)) {
      sendResponse({ok:true,result:{status:'already-running'}});
      return;
    }
    activeFillTabs.add(tab.id);
    try {
    // First inspect the document, before injecting any editing code.
    const frames = await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},
      func:() => ({
        host:location.hostname,
        editor:!!document.querySelector('.se-title-text .se-text-paragraph') &&
               !!document.querySelector('.se-section-text .se-module-text .se-text-paragraph')
      })
    });
    const matches = frames.filter(frame => frame.result?.host === 'blog.naver.com' && frame.result.editor);
    if (matches.length !== 1) throw new Error('네이버 에디터 프레임 감지 실패 (' + matches.length + '개).');
    const frameId = matches[0].frameId;
    // Selectors and wait times are data, never remote executable code.
    let config = {title:'.se-title-text .se-text-paragraph',body:'.se-section-text .se-module-text .se-text-paragraph',waitMs:1500};
    try {
      const response = await fetch('https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/extension/editor-config.json',{cache:'no-store'});
      if (response.ok) {
        const remote = await response.json();
        if (remote.schemaVersion === 1 && typeof remote.title === 'string' &&
            typeof remote.body === 'string' && remote.title.length < 200 && remote.body.length < 200) {
          config = {title:remote.title,body:remote.body,waitMs:Math.min(5000,Math.max(250,Number(remote.waitMs)||1500))};
        }
      }
    } catch (_) { /* keep bundled defaults */ }
    const target = {tabId:tab.id,frameIds:[frameId]};
    const prepare = async (field) => {
      const results = await chrome.scripting.executeScript({
        target,
        func:(selector,otherSelector) => {
          const element = document.querySelector(selector);
          const other = document.querySelector(otherSelector);
          if (!element || !other) return {status:'selector-missing'};
          const value = element.textContent?.trim() || '';
          if (value && value !== '제목' && value !== '글감과 함께 나의 일상을 기록해보세요!') {
            return {status:'not-empty',value:value.slice(0,70)};
          }
          const region = element.closest('.se-title') || element.closest('.se-section-text') || element;
          region.scrollIntoView({block:'center'});
          const rect = element.getBoundingClientRect();
          return {status:rect.width && rect.height ? 'ready' : 'not-visible',
            x:rect.left+Math.min(rect.width/2,80),y:rect.top+rect.height/2};
        },
        args:[field === 'title' ? config.title : config.body,field === 'title' ? config.body : config.title]
      });
      return results[0]?.result || {status:'no-result'};
    };
    const confirm = async (field,value) => {
      const end = Date.now() + Math.max(config.waitMs,2500);
      do {
        const results = await chrome.scripting.executeScript({
          target,
          func:(field,expected) => {
            const selector = field === 'title'
              ? '.se-title-text .se-text-paragraph'
              : '.se-section-text .se-module-text .se-text-paragraph';
            const first = document.querySelector(selector);
            if (!first) return {ok:false,reason:'selector-missing',selector};
            const paragraphs = field === 'title'
              ? [(first.textContent || '').trim()]
              : [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                  .map(el => (el.textContent || '').trim());
            if (field === 'title') return {ok:paragraphs.join(' ').includes(expected),paragraphs};
            const expectedLines = expected.split('\n').filter(Boolean);
            const visible = paragraphs.join(' ');
            const matched = expectedLines.every(line => visible.includes(line));
            const hasSeparateDateAndLink = paragraphs.some(p => p.startsWith(expectedLines[0])) &&
              paragraphs.some(p => p === expectedLines[1]);
            return {ok:matched && hasSeparateDateAndLink,paragraphCount:paragraphs.length,
              matched,hasSeparateDateAndLink,preview:paragraphs.slice(0,5)};
          },
          args:[field,value]
        });
        if (results[0]?.result?.ok) return {ok:true};
        if (Date.now() >= end) return results[0]?.result || {ok:false};
        await new Promise(resolve=>setTimeout(resolve,200));
      } while (true);
    };
    const [year,month,day] = post.practiceDate.split('-').map(Number);
    const body = year+'년 '+month+'월 '+day+'일 · '+post.practiceType+
      '\n'+post.storeUrl+'\n\n'+post.content;
    const waitForLinkCard = async () => {
      const deadline = Date.now() + 12000;
      let last = null;
      while (Date.now() < deadline) {
        const checks = await chrome.scripting.executeScript({
          target,
          func:(url) => {
            const body = document.querySelector('.se-section-text');
            const link = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
              .find(p => (p.textContent || '').trim() === url);
            const cards = [...document.querySelectorAll('.se-section-oglink, .se-module-oglink, .se-component.se-oglink, .se-component-oglink')];
            const card = cards.find(el => (el.textContent || '').includes('smartstore.naver.com')) || cards[0];
            if (!link || !card) return {ready:false,link:!!link,card:!!card};
            const position = link.compareDocumentPosition(card);
            const afterLink = !!(position & Node.DOCUMENT_POSITION_FOLLOWING);
            const paragraphs = [...document.querySelectorAll('.se-section-text .se-text-paragraph')];
            const firstProse = paragraphs.find(p => {
              const value = (p.textContent || '').trim();
              return value && value !== url && !/^\\d{4}년 /.test(value);
            });
            const beforeProse = !firstProse || !!(card.compareDocumentPosition(firstProse) & Node.DOCUMENT_POSITION_FOLLOWING);
            return {ready:afterLink && beforeProse,afterLink,beforeProse,cardCount:cards.length};
          },
          args:[post.storeUrl]
        });
        last = checks[0]?.result || {ready:false};
        if (last.ready) return last;
        await new Promise(resolve => setTimeout(resolve,300));
      }
      return {...last,ready:false};
    };
    const debuggerTarget = {tabId:tab.id};
    let attached = false;
    let result;
    try {
      await chrome.debugger.attach(debuggerTarget,'1.3');
      attached = true;
      for (const [field,value] of [['title',post.title],['body',body]]) {
        const prepared = await prepare(field);
        if (field === 'title' && prepared.status === 'not-empty' && prepared.value === post.title) {
          continue; // Already inserted by a prior run; never duplicate it.
        }
        if (prepared.status !== 'ready' && !(field === 'body' && prepared.status === 'not-empty')) {
          result = {status:field+'-'+prepared.status,diagnostics:prepared};
          break;
        }
        // Use a real browser mouse event in the correct nested editor frame.
        // CDP mouse coordinates are top-level viewport coordinates.
        const frameOffset = await chrome.scripting.executeScript({
          target:{tabId:tab.id},
          func:() => {
            const iframe = document.querySelector('iframe#mainFrame') ||
              [...document.querySelectorAll('iframe')].find(f => (f.src || '').includes('PostWriteForm.naver'));
            if (!iframe) return null;
            const r = iframe.getBoundingClientRect();
            return {x:r.left,y:r.top};
          }
        });
        const offset = frameOffset[0]?.result;
        if (!offset) {
          result = {status:field+'-frame-offset-missing'};
          break;
        }
        let resumeBody = false;
        if (field === 'body' && prepared.status === 'not-empty') {
          const state = await chrome.scripting.executeScript({
            target,
            func:(date,url,content) => {
              const paragraphs = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                .map(p => (p.textContent || '').trim()).filter(Boolean);
              const hasDate = paragraphs.some(p => p === date);
              const hasUrl = paragraphs.some(p => p === url);
              const prose = content.split('\\n').find(Boolean);
              const hasProse = paragraphs.some(p => p.includes(prose));
              const card = document.querySelector('.se-section-oglink, .se-module-oglink, .se-component.se-oglink, .se-component-oglink');
              if (!hasDate || !hasUrl || hasProse || !card) return {safe:false,hasDate,hasUrl,hasProse,card:!!card};
              card.scrollIntoView({block:'center'});
              const rect = card.getBoundingClientRect();
              return {safe:true,x:rect.left+Math.min(rect.width/2,70),y:rect.bottom+14};
            },
            args:[body.split('\\n')[0],post.storeUrl,post.content]
          });
          const stateResult = state[0]?.result;
          if (!stateResult?.safe) {
            result = {status:'body-resume-unsafe',diagnostics:stateResult};
            break;
          }
          prepared.x = stateResult.x;
          prepared.y = stateResult.y;
          resumeBody = true;
        }
        const x = offset.x+prepared.x, y = offset.y+prepared.y;
        await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
        await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
        if (field === 'title') {
          await chrome.debugger.sendCommand(debuggerTarget,'Input.insertText',{text:value});
        } else {
          // SmartEditor treats embedded newlines in Input.insertText as plain
          // characters. Send each line separately and use real Enter events.
          const lines = resumeBody ? post.content.split('\n') : value.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13
              });
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13
              });
            }
            if (lines[i]) await chrome.debugger.sendCommand(debuggerTarget,'Input.insertText',{text:lines[i]});
            // The store preview is created asynchronously. Wait before typing
            // the prose, otherwise SmartEditor may append the card at the end.
            if (!resumeBody && i === 2 && lines[1] === post.storeUrl) {
              const cardState = await waitForLinkCard();
              if (!cardState.ready) {
                result = {status:'link-card-not-confirmed',diagnostics:cardState};
                break;
              }
            }
          }
        }
        if (result) break;
        const checked = await confirm(field,value);
        if (!checked.ok) {
          result = {status:field+'-not-confirmed',diagnostics:{method:'debugger-Input.insertText',field,...checked}};
          break;
        }
      }
      if (!result) result = {status:'input-visible',method:'debugger-Input.insertText'};
    } finally {
      if (attached) await chrome.debugger.detach(debuggerTarget).catch(()=>{});
    }
    sendResponse({ok:true,result});
    } finally { activeFillTabs.delete(tab.id); }
  })().catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});
const POST_URL = 'https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/posts/latest.json';
const ALARM_NAME = 'check-approved-post';
async function checkLatest() {
  try {
    const response = await fetch(POST_URL, {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const post = await response.json();
    if (post.status !== 'approved' || typeof post.id !== 'string' ||
        typeof post.title !== 'string' || typeof post.content !== 'string') return;
    const signature = post.id + ':' + post.title + ':' + post.content;
    const state = await chrome.storage.local.get(['lastSeenSignature','lastAvailableSignature']);
    if (!state.lastAvailableSignature) {
      await chrome.storage.local.set({lastAvailableSignature:signature,lastSeenSignature:signature});
      return;
    }
    await chrome.storage.local.set({lastAvailableSignature:signature});
    await chrome.action.setBadgeText({text:state.lastSeenSignature === signature ? '' : 'NEW'});
    await chrome.action.setBadgeBackgroundColor({color:'#246b46'});
  } catch (error) {
    console.warn('Could not check latest approved post:',error.message);
  }
}
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME,{periodInMinutes:5});
  await checkLatest();
});
chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME,{periodInMinutes:5});
  await checkLatest();
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) void checkLatest();
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
  if (message?.type === 'test-new-badge') {
    (async () => {
      const response = await fetch('https://raw.githubusercontent.com/imjhua/naver-blog-publisher/main/tests/notification-signal.json',{cache:'no-store'});
      if (!response.ok) throw new Error('테스트 데이터 요청 실패: ' + response.status);
      const fixture = await response.json();
      if (fixture.kind !== 'notification-test' || typeof fixture.id !== 'string') throw new Error('테스트 데이터 형식 오류');
      await chrome.action.setBadgeBackgroundColor({color:'#246b46'});
      await chrome.action.setBadgeText({text:'NEW'});
      sendResponse({ok:true,id:fixture.id});
    })().catch(error => sendResponse({ok:false,error:error.message}));
    return true;
  }
  if (message?.type !== 'approved-post-loaded') return;
  (async () => {
    const signature = message.post.id + ':' + message.post.title + ':' + message.post.content;
    await chrome.storage.local.set({lastSeenSignature:signature,lastAvailableSignature:signature});
    await chrome.action.setBadgeText({text:''});
    sendResponse({ok:true});
  })().catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});
