/* Protect every device: device tabs and copy buttons. Nothing is sent anywhere. */
'use strict';
(function () {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const KEY = 'watchword-guide-tab';

  function select(tab, focus) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
    try { localStorage.setItem(KEY, tab.id); } catch (e) { /* storage blocked: fine */ }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step) {
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        select(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true);
      }
    });
  });

  // Open on the device chosen last time, or the one in the address (guide.html#iphone).
  let start = null;
  try { start = document.getElementById(localStorage.getItem(KEY)); } catch (e) { /* fine */ }
  const fromHash = document.getElementById('tab-' + location.hash.slice(1));
  if (fromHash) start = fromHash;
  if (start && tabs.includes(start)) select(start, false);
  window.addEventListener('hashchange', () => {
    const tab = document.getElementById('tab-' + location.hash.slice(1));
    if (tab && tabs.includes(tab)) select(tab, false);
  });

  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', async () => {
      const text = button.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* clipboard blocked */ }
      if (!ok) {
        // Fallback: select the value so Ctrl+C works.
        const code = button.parentElement.querySelector('code');
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      button.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      button.classList.toggle('done', ok);
      setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('done'); }, 2000);
    });
  }
})();
