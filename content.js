/* Watchword: watches search boxes and closes the tab as soon as a blocked word is typed. */
(() => {
  'use strict';
  const SG = globalThis.Watchword;
  if (!SG) return;

  let compiled = [];
  let allowed = [];
  let settingsNow = null;
  let imagePass = null;
  let passTimer = null;
  let options = SG.DEFAULT_OPTIONS;
  let enabled = false;
  // Blocked words this long close the moment they're typed: almost no everyday
  // word starts with one. Shorter ones ("ass", "ball") wait for a short pause,
  // so typing "assignment" or "balloon" doesn't close the tab halfway.
  const INSTANT_LETTERS = 5;
  const SHORT_WORD_PAUSE_MS = 600;
  // A blocked word that might be the start of a help search ("porn" → "porn addiction")
  // gets this long after the pause for the phrase to be finished, then it counts as blocked.
  const ALLOWED_PHRASE_WAIT_MS = 2000;
  let pauseTimer = null;
  let closeRequested = false;

  async function refresh() {
    try {
      const settings = await SG.loadSettings();
      settingsNow = settings;
      imagePass = await SG.loadImagePass();
      compiled = SG.compileWords(settings.words);
      allowed = SG.helpCompiled(settings.options) || [];
      options = settings.options;
      enabled = !!options.typing && compiled.length > 0;
      hideIfBlockedPage();
      leaveImageSearch();
    } catch (e) {
      enabled = false;
    }
  }
  // Backup for the background worker: if this page is itself a blocked search or site,
  // hide it at once so nothing shows while the tab is being closed.
  let pageChecked = false;
  function hideIfBlockedPage() {
    if (pageChecked || window !== window.top || !settingsNow) return;
    pageChecked = true;
    if (!SG.checkUrl(location.href, compiled, settingsNow, allowed)) return;
    try { document.documentElement.style.setProperty('visibility', 'hidden', 'important'); } catch (e) { /* no root yet */ }
    requestClose();
  }

  // Image search turned off: hide the page at once and go to the normal results.
  // While a pass is running, check again the moment it ends.
  function leaveImageSearch() {
    if (window !== window.top || !settingsNow) return;
    clearTimeout(passTimer);
    const target = SG.imageSearchRedirect(location.href, options, imagePass);
    if (target) {
      try { document.documentElement.style.setProperty('visibility', 'hidden', 'important'); } catch (e) { /* no root yet */ }
      location.replace(target);
      return;
    }
    if (options.noImageSearch && SG.imagePassActive(imagePass) && SG.normalResultsFor(location.href)) {
      passTimer = setTimeout(leaveImageSearch, Math.max(0, imagePass.until - Date.now()) + 250);
    }
  }

  refresh();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.imagePass)) refresh();
  });
  // Sites like Google switch tabs without loading a new page.
  window.addEventListener('popstate', () => leaveImageSearch());

  const SEARCH_NAMES = /^(q|query|search|search_query|searchterm|search_term|searchtext|keywords?|term|s|p|k|wd|text|_nkw|field-keywords)$/i;

  function isSearchField(el) {
    if (!el) return false;
    const isInput = el instanceof HTMLInputElement;
    if (!isInput && !(el instanceof HTMLTextAreaElement)) return false;
    if (isInput && !['search', 'text', ''].includes(el.type)) return false;
    if (isInput && el.type === 'search') return true;

    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'searchbox' || role === 'combobox') return true;
    if (SEARCH_NAMES.test(el.name || '')) return true;

    const hints = [
      el.id, el.name, el.placeholder,
      el.getAttribute('aria-label'), el.getAttribute('title'),
      typeof el.className === 'string' ? el.className : ''
    ].join(' ');
    if (/search|query/i.test(hints)) return true;

    const form = el.form || el.closest('form');
    if (form && (form.getAttribute('role') === 'search' || /search/i.test(form.getAttribute('action') || ''))) {
      return true;
    }
    return !!el.closest('[role="search"], search');
  }

  function requestClose() {
    if (closeRequested) return;
    closeRequested = true;
    setTimeout(() => { closeRequested = false; }, 3000);
    try {
      const sent = chrome.runtime.sendMessage({ type: 'ww-close' });
      if (sent && sent.catch) sent.catch(() => {});
    } catch (e) { /* extension was reloaded */ }
  }

  function closeFor(el) {
    try { el.value = ''; } catch (e) { /* read-only field */ }
    requestClose();
  }

  // mode: 'live' while typing, 'paused' after a short pause, false once the search is sent.
  function check(el, endIsBoundary, mode) {
    if (closeRequested || !enabled) return false;
    const hit = SG.findBlocked(el.value || '', compiled, options, endIsBoundary, allowed, mode);
    if (!hit) return false;
    closeFor(el);
    return true;
  }

  const targetOf = e => (e.composedPath ? e.composedPath()[0] : e.target);

  document.addEventListener('input', e => {
    if (!enabled) return;
    const el = targetOf(e);
    if (!isSearchField(el)) return;
    clearTimeout(pauseTimer);
    if (closeRequested) return;
    // A finished word ("ball ", "ball?") closes right away.
    if (check(el, false, 'live')) return;
    // A word still being typed: long blocked words close instantly; short ones wait
    // for a short pause, unless "Close instantly, even mid-word" is on. A word that might
    // be the start of an allowed phrase also gets the pause, to see if the phrase follows.
    const value = el.value || '';
    const hit = SG.findBlocked(value, compiled, options, true, allowed, 'live');
    if (hit && (options.instantTyping || (hit.lastWord || hit.length) >= INSTANT_LETTERS)) { closeFor(el); return; }
    // Wait-and-check whenever a blocked word is there and no help phrase is finished yet.
    if (hit || SG.findBlocked(value, compiled, options, true, allowed, false)) {
      pauseTimer = setTimeout(() => {
        if (check(el, true, 'paused')) return;
        pauseTimer = setTimeout(() => check(el, true, false), ALLOWED_PHRASE_WAIT_MS);
      }, SHORT_WORD_PAUSE_MS);
    }
  }, true);

  document.addEventListener('keydown', e => {
    if (!enabled || e.key !== 'Enter') return;
    const el = targetOf(e);
    if (!isSearchField(el)) return;
    if (check(el, true, false)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();
