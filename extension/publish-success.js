// Detect a published post after navigation. Does not write to GitHub or publish.
(async()=>{
  const match=location.pathname.match(/^\/my-mysore\/(\d+)\/?$/);
  if(!match)return;
  const {pendingPublish}=await chrome.storage.local.get('pendingPublish');
  if(!pendingPublish||Date.now()-pendingPublish.startedAt>10*60*1000)return;
  const title=pendingPublish.title;
  // Wait for the post page to render, then confirm the expected title.
  for(let attempt=0;attempt<20;attempt++){
    const visibleTitle=(document.querySelector('.se-title-text,.pcol1 .se-title-text,.htitle,.post_title')?.textContent||document.body?.innerText||'');
    if(visibleTitle.includes(title)){
      await chrome.storage.local.set({lastPublished:{
        title,postId:match[1],blogUrl:location.href,detectedAt:new Date().toISOString(),
        githubRecorded:false
      }});
      await chrome.storage.local.remove('pendingPublish');
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
})();
