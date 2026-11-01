/* Shows whether Watchword can be removed from this browser. Nothing is sent anywhere.
   How the browser installed Watchword decides it: copies installed by the computer's policy settings
   ("admin") have no Remove button. management.getSelf needs no permission. */
'use strict';
(function () {
  const STATES = {
    open: {
      title: 'Watchword can be removed in two clicks',
      text: "Every extension can, and browsers don't let an extension stop it. On Windows you can lock it in place so the Remove button disappears.",
      more: 'Show me how'
    },
    test: {
      title: 'This is a test copy',
      text: "Copies loaded from a folder can be removed any time and can't be locked in place. Install Watchword from the store, then lock that copy.",
      more: 'Show me how'
    },
    locked: {
      title: "Watchword can't be removed",
      text: "The computer's settings keep it installed and switched on in this browser.",
      more: 'How this works'
    }
  };

  async function removalState() {
    try {
      const api = (globalThis.browser || globalThis.chrome).management;
      const info = await api.getSelf();
      if (info.installType === 'admin') return 'locked';
      if (info.installType === 'development') return 'test';
    } catch (e) { /* no answer: assume the usual, removable install */ }
    return 'open';
  }

  async function render() {
    const cards = document.querySelectorAll('[data-removal]');
    if (!cards.length) return;
    const state = await removalState();
    const s = STATES[state];
    for (const card of cards) {
      card.replaceChildren();
      card.classList.toggle('locked', state === 'locked');
      card.dataset.state = state;
      const title = document.createElement('strong');
      title.textContent = s.title;
      const text = document.createElement('span');
      text.textContent = s.text;
      card.append(title, text);
      if (card.tagName === 'A') {
        const more = document.createElement('span');
        more.className = 'more';
        more.textContent = s.more;
        text.append(' ', more);
      }
      card.hidden = false;
    }
  }

  globalThis.watchwordRemovalState = removalState;
  render();
})();
