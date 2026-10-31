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
    const tab = message.tabId
      ? await chrome.tabs.get(message.tabId)
      : (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0];
    if (!tab?.id || !tab.url?.startsWith('https://blog.naver.com/'))
      throw new Error('네이버 블로그 탭을 찾지 못했습니다.');
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
            const expectedLines = expected.split('\n').filter(Boolean).map(line => line.replace(/\\*\\*([^*]+)\\*\\*/g,'$1'));
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
            const link = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
              .find(p => (p.textContent || '').trim() === url);
            const cards = [...document.querySelectorAll('.se-component.se-oglink, .se-component-oglink, .se-section-oglink')]
              .filter(el => !el.parentElement?.closest('.se-component.se-oglink, .se-component-oglink, .se-section-oglink'));
            const card = cards.find(el => (el.textContent || '').includes('smartstore.naver.com')) || cards[0];
            if (!link || !card) return {ready:false,link:!!link,card:!!card};
            const afterLink = !!(link.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);
            return {ready:afterLink,afterLink,cardCount:cards.length};
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
              const prose = content.split('\n').find(Boolean);
              const hasProse = paragraphs.some(p => p.includes(prose));
              const card = document.querySelector('.se-section-oglink, .se-module-oglink, .se-component.se-oglink, .se-component-oglink');
              if (!hasDate || !hasUrl || hasProse || !card) return {safe:false,hasDate,hasUrl,hasProse,card:!!card};
              card.scrollIntoView({block:'center'});
              const rect = card.getBoundingClientRect();
              return {safe:true,x:rect.left+Math.min(rect.width/2,70),y:rect.bottom+14};
            },
            args:[body.split('\n')[0],post.storeUrl,post.content]
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
          // Set bold BEFORE typing the first date paragraph. SmartEditor
          // preserves typing-format state more reliably than retroactive
          // selection of its split text nodes.
          let preBold = false;
          const clickBold = async () => {
            const hit = (await chrome.scripting.executeScript({
              target,
              func:() => {
                const buttons = [...document.querySelectorAll('button')];
                const el = buttons.find(b => /se-bold-toolbar-button/.test(b.className) &&
                  b.getClientRects().length);
                if (!el) return null;
                const r=el.getBoundingClientRect();
                return {x:r.left+r.width/2,y:r.top+r.height/2};
              }
            }))[0]?.result;
            if (!hit) return false;
            await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
              type:'mousePressed',x:offset.x+hit.x,y:offset.y+hit.y,button:'left',clickCount:1
            });
            await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
              type:'mouseReleased',x:offset.x+hit.x,y:offset.y+hit.y,button:'left',clickCount:1
            });
            return true;
          };
          if (!resumeBody) preBold = await clickBold();
          const lines = resumeBody ? post.content.split('\n') : value.split('\n');
          let nextParagraphPrepared = false;
          for (let i = 0; i < lines.length; i++) {
            const skipEnter = i === 1 && nextParagraphPrepared;
            if (skipEnter) nextParagraphPrepared = false;
            if (i > 0 && !skipEnter) {
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13
              });
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13
              });
            }
            if (lines[i]) await chrome.debugger.sendCommand(debuggerTarget,'Input.insertText',{text:lines[i].replace(/\*\*([^*]+)\*\*/g,'$1')});
            // Safety gate: verify the first date line before entering the URL or prose.
            // Never retry insertion into a partially populated SmartEditor document.
            if (!resumeBody && i === 0) {
              let dateCheck = {present:false,bold:false};
              for (let attempt = 0; attempt < 8; attempt++) {
                dateCheck = (await chrome.scripting.executeScript({
                  target,
                  func:(date) => {
                    const p = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                      .find(el => (el.textContent || '').trim() === date);
                    if (!p) return {present:false,bold:false};
                    const spans = [...p.querySelectorAll('span.__se-node')];
                    const boldForNode = el => {
                      // SmartEditor can place its bold class on a wrapping span,
                      // rather than on the __se-node itself.
                      for (let node = el; node && node !== p.parentElement; node = node.parentElement) {
                        if (node.nodeType !== 1) continue;
                        if (node.matches('b,strong') || /(?:^|\\s)se-bold(?:\\s|$)/.test(node.className || ''))
                          return true;
                        const weight = getComputedStyle(node).fontWeight;
                        if (Number.parseInt(weight,10) >= 600) return true;
                      }
                      return false;
                    };
                    const bold = spans.length > 0 && spans.every(boldForNode);
                    return {present:true,bold};
                  },
                  args:[lines[0]]
                }))[0]?.result || {present:false,bold:false};
                if (dateCheck.present && dateCheck.bold) break;
                await new Promise(resolve => setTimeout(resolve,200));
              }
              // Repair a date that was inserted without bold, before any URL/prose.
              // Select the exact date DOM text and apply the editor's native Bold
              // command once; never toggle bold on already-bold text.
              if (dateCheck.present && !dateCheck.bold) {
                const selection = (await chrome.scripting.executeScript({
                  target,world:'MAIN',
                  func:(date)=>{
                    const p=[...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                      .find(el=>(el.textContent||'').trim()===date);
                    if(!p)return false;
                    const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
                    let first=null,last=null;
                    while(walker.nextNode()){
                      const n=walker.currentNode;
                      if(!n.textContent)continue;
                      if(!first)first=n;
                      last=n;
                    }
                    if(!first||!last)return false;
                    const range=document.createRange();
                    range.setStart(first,0);
                    range.setEnd(last,last.textContent.length);
                    const sel=window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return sel.toString().trim()===date;
                  },
                  args:[lines[0]]
                }))[0]?.result;
                if (selection) {
                  await clickBold();
                  await new Promise(resolve=>setTimeout(resolve,250));
                  dateCheck = (await chrome.scripting.executeScript({
                    target,
                    func:(date)=>{
                      const p=[...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                        .find(el=>(el.textContent||'').trim()===date);
                      if(!p)return {present:false,bold:false};
                      const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
                      const parts=[];
                      while(walker.nextNode()){
                        const n=walker.currentNode;
                        if(!n.textContent.trim())continue;
                        let e=n.parentElement,bold=false;
                        while(e&&e!==p.parentElement){
                          if(e.matches('b,strong')||Number.parseInt(getComputedStyle(e).fontWeight,10)>=600){bold=true;break;}
                          e=e.parentElement;
                        }
                        parts.push(bold);
                      }
                      return {present:true,bold:parts.length>0&&parts.every(Boolean)};
                    },
                    args:[lines[0]]
                  }))[0]?.result||{present:false,bold:false};
                }
                if (!dateCheck.bold) {
                  result={status:'date-bold-repair-failed',
                    diagnostics:{stage:'before-link-insertion',selectionMatched:!!selection}};
                  break;
                }
              }
              // Date presence is a hard gate. Bold is a diagnostic only:
              // SmartEditor's toolbar/typing state can be correct even when
              // computed DOM weight is not observable through this frame.
              if (!dateCheck.present) {
                result = {status:'date-not-confirmed',
                  diagnostics:{stage:'before-link-insertion',...dateCheck}};
                break;
              }
            }
            if (!resumeBody && i === 0 && preBold) {
              // Create the URL paragraph while the date editor still owns focus.
              // Clicking the toolbar can steal focus; after toggling bold off,
              // explicitly focus the new empty paragraph before inserting the URL.
              const enter = async type => chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13
              });
              await enter('keyDown');
              await enter('keyUp');
              await clickBold();
              const next = (await chrome.scripting.executeScript({
                target,
                func:(date) => {
                  const ps=[...document.querySelectorAll('.se-section-text .se-text-paragraph')];
                  const idx=ps.findIndex(p=>(p.textContent||'').trim()===date);
                  const p=idx>=0 ? ps[idx+1] : null;
                  if(!p || (p.textContent||'').trim()) return null;
                  p.scrollIntoView({block:'center'});
                  const r=p.getBoundingClientRect();
                  return r.width && r.height ? {x:r.left+Math.min(12,r.width/2),y:r.top+r.height/2} : null;
                },
                args:[lines[0]]
              }))[0]?.result;
              if(!next) {
                result={status:'url-paragraph-not-ready',diagnostics:{stage:'after-date'}};
                break;
              }
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
                type:'mousePressed',x:offset.x+next.x,y:offset.y+next.y,button:'left',clickCount:1
              });
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
                type:'mouseReleased',x:offset.x+next.x,y:offset.y+next.y,button:'left',clickCount:1
              });
              nextParagraphPrepared=true;
            }
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
      if (!result) {
        const alreadyBold = (await chrome.scripting.executeScript({
          target,
          func:(date) => {
            const p=[...document.querySelectorAll('.se-section-text .se-text-paragraph')]
              .find(el=>(el.textContent||'').trim()===date);
            if (!p) return false;
            // SmartEditor nests <b> inside span.__se-node and may split
            // the date across multiple spans. Check the rendered text nodes,
            // not the unstyled wrapping spans or a single full-date <b>.
            const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
            const parts=[];
            while(walker.nextNode()){
              const node=walker.currentNode;
              if(!node.textContent.trim()) continue;
              let el=node.parentElement;
              let bold=false;
              while(el && el!==p.parentElement){
                if(el.matches('b,strong') ||
                   /(?:^|\s)(?:se-bold|se-text-format-bold)(?:\s|$)/.test(el.className||'') ||
                   Number.parseInt(getComputedStyle(el).fontWeight,10)>=600){
                  bold=true;break;
                }
                el=el.parentElement;
              }
              parts.push({text:node.textContent,bold});
            }
            return parts.length>0 && parts.map(x=>x.text).join('').trim()===date &&
              parts.every(x=>x.bold);
          },
          args:[body.split('\n')[0]]
        }))[0]?.result;

        if (alreadyBold) {
          result={status:'input-visible',formatting:'date-bold-confirmed'};
        }
      }
      if (!result) {
        // Select the first paragraph with keyboard navigation after clicking
        // its text. Drag selection across SmartEditor iframe is unreliable.
        const date = body.split('\n')[0];
        const info = (await chrome.scripting.executeScript({
          target,
          func:(date) => {
            const matches = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
              .filter(p => (p.textContent || '').trim() === date);
            if (matches.length !== 1) return {ok:false,reason:'date-not-unique',count:matches.length};
            const p = matches[0];
            p.scrollIntoView({block:'center'});
            const r = p.getBoundingClientRect();
            return {ok:true,x:r.left+Math.min(r.width/2,40),y:r.top+r.height/2};
          },
          args:[date]
        }))[0]?.result;
        let dateBold = false;
        let formattingDiagnostics = null;
        let selectionText = '';
        let selectionMethod = 'keyboard-home-shift-end';
        if (info?.ok) {
          const offset = (await chrome.scripting.executeScript({
            target:{tabId:tab.id},
            func:() => {
              const iframe = document.querySelector('iframe#mainFrame') ||
                [...document.querySelectorAll('iframe')].find(f => (f.src || '').includes('PostWriteForm.naver'));
              if (!iframe) return null;
              const r = iframe.getBoundingClientRect();
              return {x:r.left,y:r.top};
            }
          }))[0]?.result;
          if (offset) {
            const x=offset.x+info.x,y=offset.y+info.y;
            await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
              type:'mousePressed',x,y,button:'left',clickCount:1
            });
            await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
              type:'mouseReleased',x,y,button:'left',clickCount:1
            });
            const key = async (name,code,modifiers=0) => {
              const virtual = name==='Home'?36:name==='End'?35:66;
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'rawKeyDown',key:name,code,modifiers,windowsVirtualKeyCode:virtual
              });
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchKeyEvent',{
                type:'keyUp',key:name,code,modifiers,windowsVirtualKeyCode:virtual
              });
            };
            await key('Home','Home');
            await key('End','End',8);
            // SmartEditor stores the active text selection inside a nested
            // same-origin editing iframe, not necessarily in this frame's window.
            const selectionState = (await chrome.scripting.executeScript({
              target,
              func:() => {
                const selections = [];
                const visit = (win,depth) => {
                  if (depth > 4) return;
                  try {
                    const selected = win.getSelection()?.toString() || '';
                    if (selected) selections.push(selected);
                    for (const frame of win.document.querySelectorAll('iframe')) {
                      if (frame.contentWindow) visit(frame.contentWindow,depth+1);
                    }
                  } catch (_) { /* cross-origin frame */ }
                };
                visit(window,0);
                return selections;
              }
            }))[0]?.result || [];
            selectionText = selectionState.find(s => s.trim() === date) || selectionState[0] || '';
            // Chrome's isolated extension world may report an empty selection
            // even when SmartEditor's floating toolbar shows the selected text.
            // Home + Shift+End targets only the date paragraph. Apply bold once,
            // then verify the actual rendered formatting rather than trusting
            // window.getSelection() across execution worlds.
            const mac = (await chrome.scripting.executeScript({
              target,func:() => /Mac/i.test(navigator.platform)
            }))[0]?.result;
            // Use the native SmartEditor floating toolbar. On macOS, the
            // debugger's synthetic Cmd+B can leave selection intact without
            // applying the command. A real mouse click on the visible B button
            // uses the editor's own formatting handler.
            const toolbar = (await chrome.scripting.executeScript({
              target,
              func:() => {
                const p = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                  .find(el => el.classList.contains('se-is-text-paragraph-block-selected'));
                const buttons = [...document.querySelectorAll('button,[role="button"]')];
                const candidates = buttons.filter(el => {
                  const label = [el.getAttribute('aria-label'),el.getAttribute('title'),
                    el.className,el.textContent].filter(Boolean).join(' ').toLowerCase();
                  return /bold|굵게|se-toolbar-button-bold|se-button-bold/.test(label);
                }).filter(el => {
                  const r = el.getBoundingClientRect();
                  return r.width > 0 && r.height > 0;
                });
                const el = candidates.sort((a,b) => {
                  const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
                  return Math.abs(ra.top-(p?.getBoundingClientRect().top||0))-
                    Math.abs(rb.top-(p?.getBoundingClientRect().top||0));
                })[0];
                if (!el) return {ok:false,candidateCount:0};
                const r = el.getBoundingClientRect();
                return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,
                  label:el.getAttribute('aria-label')||el.getAttribute('title')||el.className};
              }
            }))[0]?.result;
            if (toolbar?.ok) {
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
                type:'mousePressed',x:offset.x+toolbar.x,y:offset.y+toolbar.y,button:'left',clickCount:1
              });
              await chrome.debugger.sendCommand(debuggerTarget,'Input.dispatchMouseEvent',{
                type:'mouseReleased',x:offset.x+toolbar.x,y:offset.y+toolbar.y,button:'left',clickCount:1
              });
            } else {
              await key('b','KeyB',mac?4:2);
            }
            const verified = (await chrome.scripting.executeScript({
              target,
              func:(date) => {
                const p = [...document.querySelectorAll('.se-section-text .se-text-paragraph')]
                  .find(el => (el.textContent || '').trim() === date);
                if (!p) return {bold:false,reason:'date-missing'};
                const descendants = [p,...p.querySelectorAll('*')];
                const styled = descendants.map(el => ({
                  tag:el.tagName,
                  className:typeof el.className === 'string' ? el.className.slice(0,180) : '',
                  weight:getComputedStyle(el).fontWeight,
                  text:(el.textContent||'').trim().slice(0,65)
                }));
                const strong = styled.filter(x => Number.parseInt(x.weight,10)>=600 ||
                  /(?:^|\\s)(?:se-bold|se-text-format-bold)(?:\\s|$)/.test(x.className) ||
                  x.tag==='STRONG' || x.tag==='B');
                return {bold:strong.some(x => x.text===date),
                  paragraphWeight:getComputedStyle(p).fontWeight,
                  strong,structure:styled.slice(0,15),
                  html:p.innerHTML.slice(0,1800)};

              },
              args:[date]
            }))[0]?.result;
            dateBold = !!verified?.bold;
            formattingDiagnostics = {...verified,toolbar};
          }
        }
        result = dateBold
          ? {status:'input-visible',method:'debugger-Input.insertText',formatting:'date-bold-confirmed'}
          : {status:'formatting-unconfirmed',diagnostics:{
              info,selectedText:selectionText.slice(0,100),selectionMethod,formattingDiagnostics,
              reason:'Date bold was not confirmed'
            }};
      }
    } finally {
      if (attached) await chrome.debugger.detach(debuggerTarget).catch(()=>{});
    }
    sendResponse({ok:true,result});
    } finally { activeFillTabs.delete(tab.id); }
  })().catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});
// Background automation runs only when an already-open Naver editor exists.
// A local per-post lock prevents repeated injection during alarm polling.
// Publishing remains manual until the publish flow is separately verified.
async function autoFillApprovedPost(post) {
  const signature = [post.id,post.title,post.content].join(':');
  const state = await chrome.storage.local.get(['autoFillDone','autoFillAttempted']);
  if (state.autoFillDone === signature || state.autoFillAttempted === signature) return;
  const tabs = await chrome.tabs.query({url:'https://blog.naver.com/*'});
  const editors = [];
  for (const tab of tabs) {
    try {
      const frames = await chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:() => !!document.querySelector('.se-title-text .se-text-paragraph') &&
          !!document.querySelector('.se-section-text .se-module-text .se-text-paragraph')
      });
      if (frames.some(f=>f.result)) editors.push(tab);
    } catch (_) { /* inaccessible or not ready */ }
  }
  if (editors.length !== 1) return;
  // Lock before execution; never automatically retry after an uncertain partial fill.
  await chrome.storage.local.set({autoFillAttempted:signature});
  try {
    const response = await chrome.runtime.sendMessage({
      type:'fill-approved-post',post,tabId:editors[0].id
    });
    if (response?.ok && response.result?.status === 'input-visible') {
      await chrome.storage.local.set({autoFillDone:signature});
      await chrome.action.setBadgeText({text:'OK'});
      await chrome.action.setBadgeBackgroundColor({color:'#246b46'});
    } else {
      console.warn('Automatic fill needs review',response);
      await chrome.action.setBadgeText({text:'!'});
      await chrome.action.setBadgeBackgroundColor({color:'#a04a2c'});
    }
  } catch(error) {
    console.warn('Automatic fill failed; manual review required',error);
    await chrome.action.setBadgeText({text:'!'});
  }
}
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
    await autoFillApprovedPost(post);
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
