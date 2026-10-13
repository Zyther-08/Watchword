/* Watchword: background worker (service worker in Chrome/Edge, event page in Firefox). */
'use strict';

if (typeof importScripts === 'function' && typeof Watchword === 'undefined') {
  importScripts('core.js');
}
const SG = globalThis.Watchword;

// ---------- Settings cache ----------
let statePromise = null;
function getState() {
  if (!statePromise) {
    statePromise = SG.loadSettings().then(settings => ({
      settings,
      compiled: SG.compileWords(settings.words),
      allowed: SG.helpCompiled(settings.options)
    }));
    statePromise.catch(() => { statePromise = null; });
  }
  return statePromise;
}

// ---------- Closing tabs ----------
const closing = new Set();

async function closeTab(tabId) {
  if (typeof tabId !== 'number' || tabId < 0 || closing.has(tabId)) return;
  closing.add(tabId);
  setTimeout(() => closing.delete(tabId), 3000);
  try {
    const { settings } = await getState();
    if (settings.options.keepWindow) {
      const tab = await chrome.tabs.get(tabId);
      const tabsInWindow = await chrome.tabs.query({ windowId: tab.windowId });
      if (tabsInWindow.length <= 1) await chrome.tabs.create({ windowId: tab.windowId });
    }
  } catch (e) { /* the tab may already be gone */ }
  try { await chrome.tabs.remove(tabId); } catch (e) { /* already closed */ }
}

// Image search turned off: send the tab to the normal results for the same search.
const redirecting = new Map();
async function redirectTab(tabId, url) {
  const last = redirecting.get(tabId);
  if (last === url) return;
  redirecting.set(tabId, url);
  setTimeout(() => { if (redirecting.get(tabId) === url) redirecting.delete(tabId); }, 3000);
  try { await chrome.tabs.update(tabId, { url }); } catch (e) { /* tab closed */ }
}

async function inspect(tabId, url, frameId) {
  if (frameId !== 0 || typeof tabId !== 'number' || tabId < 0) return;
  if (!url || !/^https?:/i.test(url)) return;
  try {
    const { settings, compiled, allowed } = await getState();
    if (SG.checkUrl(url, compiled, settings, allowed)) { closeTab(tabId); return; }
    if (settings.options.noImageSearch) {
      const target = SG.imageSearchRedirect(url, settings.options, await SG.loadImagePass());
      if (target) redirectTab(tabId, target);
    }
  } catch (e) {
    console.error('Watchword:', e);
  }
}

async function sweepOpenTabs() {
  try {
    const { settings, compiled, allowed } = await getState();
    if (!compiled.length && !settings.sites.length) return;
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && SG.checkUrl(tab.url, compiled, settings, allowed)) await closeTab(tab.id);
    }
  } catch (e) {
    console.error('Watchword:', e);
  }
}

// Catch the search as early as possible: before the page loads, and also when
// sites like YouTube change the address without loading a new page.
chrome.webNavigation.onBeforeNavigate.addListener(d => inspect(d.tabId, d.url, d.frameId));
chrome.webNavigation.onHistoryStateUpdated.addListener(d => inspect(d.tabId, d.url, d.frameId));
chrome.webNavigation.onReferenceFragmentUpdated.addListener(d => inspect(d.tabId, d.url, d.frameId));
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.url) inspect(tabId, info.url, 0); });

// The content script asks for its tab to be closed when a blocked word is typed.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'ww-close' && sender.tab) closeTab(sender.tab.id);
});

// ---------- SafeSearch / YouTube Restricted Mode ----------
const SAFE_RULE_IDS = [1, 2, 3, 4, 5, 6, 7];

// Adds key=value to matching search URLs, unless it's already there.
function forceParamRules(allowId, redirectId, urlRegex, key, value) {
  return [
    {
      id: allowId,
      priority: 2,
      action: { type: 'allow' },
      condition: { regexFilter: `${urlRegex}(.*&)?${key}=${value}(&|$)`, resourceTypes: ['main_frame'] }
    },
    {
      id: redirectId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { transform: { queryTransform: { addOrReplaceParams: [{ key, value }] } } }
      },
      condition: { regexFilter: urlRegex, resourceTypes: ['main_frame'] }
    }
  ];
}

function safeSearchRules() {
  return [
    ...forceParamRules(1, 2, '^https?://(www\\.)?google\\.[a-z.]+/search\\?', 'safe', 'active'),
    ...forceParamRules(3, 4, '^https?://(www\\.|cn\\.)?bing\\.com/(images/|videos/)?search\\?', 'adlt', 'strict'),
    ...forceParamRules(5, 6, '^https?://(html\\.|lite\\.)?duckduckgo\\.com/(html/?|lite/?)?\\?', 'kp', '1'),
    {
      id: 7,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'YouTube-Restrict', operation: 'set', value: 'Strict' }]
      },
      condition: {
        requestDomains: ['youtube.com', 'youtube-nocookie.com', 'youtubei.googleapis.com', 'youtube.googleapis.com'],
        resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
      }
    }
  ];
}

let ruleQueue = Promise.resolve();
function applySafeSearch() {
  ruleQueue = ruleQueue.then(async () => {
    let settings;
    try { ({ settings } = await getState()); } catch (e) { return; }
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: SAFE_RULE_IDS });
    } catch (e) { /* nothing to remove */ }
    if (!settings.options.safeSearch) return;
    // One at a time, so a rule one browser doesn't support can't block the others.
    for (const rule of safeSearchRules()) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
      } catch (e) {
        console.warn('Watchword: this browser rejected SafeSearch rule', rule.id, e);
      }
    }
  });
  return ruleQueue;
}

// ---------- Lifecycle ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  statePromise = null;
  applySafeSearch();
  sweepOpenTabs();
});

chrome.runtime.onInstalled.addListener(details => {
  applySafeSearch();
  sweepOpenTabs();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(() => {
  applySafeSearch();
  sweepOpenTabs();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
