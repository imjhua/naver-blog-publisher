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
