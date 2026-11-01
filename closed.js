/* The page shown when Watchword closes a search: the user's own note. Nothing is sent anywhere. */
'use strict';
(async () => {
  let text = '';
  try {
    const data = await chrome.storage.local.get('settings');
    const note = data.settings && data.settings.note;
    text = typeof note === 'string' ? note.trim() : '';
  } catch (e) { /* storage unavailable: show the empty state */ }

  const noteEl = document.getElementById('note');
  if (text) {
    noteEl.textContent = text;
    noteEl.hidden = false;
  } else {
    document.getElementById('empty').hidden = false;
  }

  // Closing this page never closes the window: a new tab opens first if this is the last one.
  document.getElementById('close').addEventListener('click', async () => {
    try {
      const me = await chrome.tabs.getCurrent();
      const inWindow = await chrome.tabs.query({ windowId: me.windowId });
      if (inWindow.length <= 1) await chrome.tabs.create({ windowId: me.windowId });
      await chrome.tabs.remove(me.id);
    } catch (e) {
      window.close();
    }
  });
})();
