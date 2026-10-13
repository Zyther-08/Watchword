'use strict';
const SG = globalThis.Watchword;

// Word packs live in packs.js, shared with the self-test.
const WORD_PACKS = globalThis.WORD_PACKS;
const packChoice = Object.fromEntries(WORD_PACKS.map(p => [p.id, p.checked]));

let settings = SG.mergeSettings(null);
let unlocked = false;
let changingLock = false;
let challenge = null;

const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

const isLocked = () => !!settings.lock && !unlocked;
const lockType = () => (settings.lock && settings.lock.type === 'typing' ? 'typing' : 'password');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function save() {
  await chrome.storage.local.set({ settings });
  render();
}

const noteTimers = {};
function note(id, text, isError = false, ms = 4000) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
  clearTimeout(noteTimers[id]);
  if (text && id !== 'lock-note') noteTimers[id] = setTimeout(() => { el.textContent = ''; }, ms);
}

// Called before anything that loosens protection. Returns true if it has to stop.
function needsUnlock() {
  if (!isLocked()) return false;
  const area = $('lock-area');
  area.classList.remove('nudge');
  void area.offsetWidth;
  area.classList.add('nudge');
  area.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  if (lockType() === 'typing') {
    note('lock-note', 'That change needs unlocking first. Start the typing challenge here.', true);
    const start = $('unlock-start');
    if (start) start.focus({ preventScroll: true });
  } else {
    note('lock-note', 'That change needs the password. Enter it here first.', true);
    const input = $('unlock-input');
    if (input) input.focus({ preventScroll: true });
  }
  return true;
}

// ---------- Words ----------
function addWords(text) {
  let added = 0;
  let skipped = 0;
  for (const part of String(text).split(/[,\n]/)) {
    const raw = part.trim();
    if (!raw) continue;
    const key = SG.wordKey(raw);
    if (!key) { skipped++; continue; }
    const index = settings.words.findIndex(w => SG.wordKey(w) === key);
    if (index === -1) {
      settings.words.push(raw);
      added++;
    } else if (fuzzyActive(raw) && !fuzzyActive(settings.words[index])) {
      settings.words[index] = prefixOf(raw) + SG.parseWord(settings.words[index]).text;
      added++;
    } else {
      skipped++;
    }
  }
  return { added, skipped };
}

$('word-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('word-input');
  const { added, skipped } = addWords(input.value);
  if (added) {
    input.value = '';
    note('word-note', `Blocked ${plural(added, 'word', 'words')}.`);
    await save();
  } else if (skipped) {
    note('word-note', 'That word is already blocked, or has no letters in it.', true);
  }
});

// ---------- Word packs ----------
function packStatus(pack) {
  // A pack word is "new" if it's missing, or if the pack would switch its ≈ on.
  const have = new Map(settings.words.map(w => [SG.wordKey(w), fuzzyActive(w)]));
  const newWords = pack.words.filter(w => {
    const key = SG.wordKey(w);
    return !have.has(key) || (fuzzyActive(w) && !have.get(key));
  }).length;
  const newSites = (pack.sites || []).filter(site => !settings.sites.includes(site)).length;
  return { newWords, newSites, done: newWords === 0 && newSites === 0 };
}

function renderPacks() {
  const list = $('pack-list');
  list.replaceChildren();
  for (const pack of WORD_PACKS) {
    const { newWords, newSites, done } = packStatus(pack);
    const id = `pack-${pack.id}`;
    const total = pack.words.length;
    let count = newWords === total ? plural(total, 'word', 'words') : `${newWords} of ${total} words new`;
    if (pack.sites) count += `, ${newSites === pack.sites.length ? plural(pack.sites.length, 'site', 'sites') : `${newSites} sites new`}`;
    if (done) count = 'Already added';

    const box = h('input', {
      type: 'checkbox', id, disabled: done,
      onchange: e => { packChoice[pack.id] = e.target.checked; updatePackButton(); }
    });
    box.checked = !done && packChoice[pack.id];

    list.append(h('div', { class: 'pack' + (pack.warn ? ' warn' : '') + (done ? ' is-done' : '') },
      box,
      h('div', {},
        h('label', { for: id }, h('strong', {}, pack.title)),
        h('span', { class: 'pack-count' }, count),
        h('p', { class: 'pack-about' }, pack.about),
        h('details', {},
          h('summary', {}, 'Show words'),
          h('p', {}, pack.words.map(w => SG.parseWord(w).fuzzy ? `${SG.parseWord(w).text} ≈` : SG.parseWord(w).text).join(', ') + (pack.sites ? `. Sites: ${pack.sites.join(', ')}` : ''))
        )
      )
    ));
  }
  updatePackButton();
}

function updatePackButton() {
  const any = [...document.querySelectorAll('#pack-list input:checked')].length > 0;
  $('add-packs').disabled = !any;
}

function setPacksOpen(open) {
  $('packs').hidden = !open;
  $('starter').setAttribute('aria-expanded', String(open));
  $('starter').textContent = open ? 'Close word packs' : 'Add word packs';
  if (open) renderPacks();
}

$('starter').addEventListener('click', () => setPacksOpen($('packs').hidden));
$('close-packs').addEventListener('click', () => setPacksOpen(false));

$('add-packs').addEventListener('click', async () => {
  let words = 0;
  let sites = 0;
  for (const pack of WORD_PACKS) {
    const box = $(`pack-${pack.id}`);
    if (!box || !box.checked) continue;
    words += addWords(pack.words.join(',')).added;
    for (const site of pack.sites || []) {
      if (!settings.sites.includes(site)) { settings.sites.push(site); sites++; }
    }
  }
  if (!words && !sites) return;
  await save();
  setPacksOpen(false);
  note('word-note', `Added ${plural(words, 'word', 'words')}${sites ? ` and ${plural(sites, 'site', 'sites')}` : ''}.`, false, 8000);
});

$('toggle-hide').addEventListener('click', async () => {
  settings.options.hideList = !settings.options.hideList;
  await save();
});

function renderWords() {
  const list = $('word-list');
  list.replaceChildren();
  list.classList.toggle('locked', isLocked());
  const count = settings.words.length;
  $('word-count').textContent = count
    ? `${plural(count, 'word', 'words')} blocked${settings.options.hideList ? ', list hidden' : ''}`
    : 'No words blocked yet.';
  $('toggle-hide').textContent = settings.options.hideList ? 'Show list' : 'Hide list';
  $('toggle-hide').hidden = count === 0;
  $('fuzzy-all-on').hidden = !settings.words.some(w => !fuzzyActive(w));
  $('fuzzy-all-off').hidden = !settings.words.some(w => fuzzyActive(w));
  if (settings.options.hideList) return;

  settings.words.forEach((stored, i) => {
    const { text } = SG.parseWord(stored);
    const active = fuzzyActive(stored);
    const what = fuzzyCatches(text);
    list.append(h('li', { class: active ? 'is-fuzzy' : '' },
      h('button', {
        type: 'button',
        class: 'chip-fuzzy',
        'aria-pressed': active ? 'true' : 'false',
        'aria-label': `Also catch ${what} for ${text}`,
        title: active ? `Catching ${what}. Click to turn off.` : `Also catch ${what}`,
        onclick: async () => {
          if (active && needsUnlock()) return;   // turning it off loosens
          settings.words[i] = active ? text : fuzzyPrefixFor(text) + text;
          await save();
        }
      }, '≈'),
      h('span', {}, text),
      h('button', {
        type: 'button',
        class: 'chip-x',
        'aria-label': `Unblock ${text}`,
        title: 'Unblock',
        onclick: async () => {
          if (needsUnlock()) return;
          settings.words.splice(i, 1);
          await save();
        }
      }, '×')
    ));
  });
}

// ---------- Misspellings for all words ----------
// Every word catches at least repeated letters, so "≈ on for all" covers them all.
// Pack phrases marked repeats-only ("+") would match normal phrases if misspellings were
// allowed ("eat ass" -> "eat asks"), so they catch repeated letters only, both when added
// by the pack and when re-enabled here.
const repeatsOnlyKeys = new Set(
  (WORD_PACKS || []).flatMap(p => p.words)
    .filter(w => SG.parseWord(w).repeatsOnly)
    .map(w => SG.wordKey(w))
);
function fuzzyActive(stored) {
  const p = SG.parseWord(stored);
  return p.fuzzy || p.repeatsOnly;
}
function prefixOf(raw) {
  const p = SG.parseWord(raw);
  return p.fuzzy ? SG.FUZZY_PREFIX : p.repeatsOnly ? SG.REPEAT_PREFIX : '';
}
function fuzzyPrefixFor(text) {
  return repeatsOnlyKeys.has(SG.wordKey(text)) ? SG.REPEAT_PREFIX : SG.FUZZY_PREFIX;
}
function fuzzyCatches(text) {
  if (fuzzyPrefixFor(text) === SG.REPEAT_PREFIX) {
    return 'repeated letters (a changed letter would catch normal words, so misspellings stay off)';
  }
  const c = SG.compileWord(text);
  const typos = c ? SG.typoBudget(c.letters.length) : 0;
  return typos
    ? `misspellings (up to ${typos} wrong ${typos === 1 ? 'letter' : 'letters'}) and repeated letters`
    : 'repeated letters, like nsfww for nsfw';
}

$('fuzzy-all-on').addEventListener('click', async () => {
  let changed = 0;
  settings.words = settings.words.map(w => {
    if (fuzzyActive(w)) return w;
    changed++;
    return fuzzyPrefixFor(SG.parseWord(w).text) + SG.parseWord(w).text;
  });
  if (!changed) return;
  note('word-note',
    `Now catching misspellings for ${plural(changed, 'more word', 'more words')}. Try a few normal searches in Try it below, since one wrong letter can turn a blocked word into an ordinary one, like “naked” and “baked”.`,
    false, 12000);
  await save();
});

$('fuzzy-all-off').addEventListener('click', async () => {
  if (needsUnlock()) return;
  let changed = 0;
  settings.words = settings.words.map(w => {
    if (!fuzzyActive(w)) return w;
    changed++;
    return SG.parseWord(w).text;
  });
  if (!changed) return;
  note('word-note', `Stopped catching misspellings for ${plural(changed, 'word', 'words')}.`);
  await save();
});

// ---------- Sites ----------
$('site-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('site-input');
  const site = SG.cleanSite(input.value);
  if (!site) { note('site-note', 'Enter a site like example.com.', true); return; }
  if (settings.sites.includes(site)) { note('site-note', `${site} is already blocked.`, true); return; }
  settings.sites.push(site);
  input.value = '';
  note('site-note', `Blocked ${site}.`);
  await save();
});

function renderSites() {
  const list = $('site-list');
  list.replaceChildren();
  list.classList.toggle('locked', isLocked());
  settings.sites.forEach((site, i) => {
    list.append(h('li', {},
      h('span', {}, site),
      h('button', {
        type: 'button',
        class: 'chip-x',
        'aria-label': `Unblock ${site}`,
        title: 'Unblock',
        onclick: async () => {
          if (needsUnlock()) return;
          settings.sites.splice(i, 1);
          await save();
        }
      }, '×')
    ));
  });
}

// ---------- Help searches (fixed list) ----------
function renderHelp() {
  const list = $('help-list');
  list.replaceChildren(...SG.HELP_PHRASES.map(p => h('li', {}, p)));
  list.classList.toggle('is-off', !settings.options.helpPhrases);
}

// ---------- Tester ----------
function highlighted(hit) {
  const from = Math.max(0, hit.start - 30);
  const to = Math.min(hit.chars.length, hit.end + 30);
  return h('span', {},
    from > 0 ? '…' : '',
    hit.chars.slice(from, hit.start).join(''),
    h('mark', {}, hit.chars.slice(hit.start, hit.end).join('')),
    hit.chars.slice(hit.end, to).join(''),
    to < hit.chars.length ? '…' : ''
  );
}

function runTest() {
  const out = $('verdict');
  const panel = document.querySelector('.tester');
  out.replaceChildren();
  out.className = 'verdict';
  panel.classList.remove('is-blocked');

  const value = $('test-input').value.trim();
  if (!value) {
    out.append(h('p', { class: 'muted' }, 'The result shows here as you type.'));
    return;
  }

  const compiled = SG.compileWords(settings.words);
  const allowedCompiled = SG.helpCompiled(settings.options);
  const blocked = (detail) => {
    out.classList.add('blocked');
    panel.classList.add('is-blocked');
    out.append(h('p', { class: 'headline' }, 'Tab closes'), h('p', { class: 'detail' }, detail));
  };
  const allowed = (detail) => {
    out.classList.add('allowed');
    out.append(h('p', { class: 'headline' }, 'Allowed'), h('p', { class: 'detail' }, detail));
  };

  const isLink = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^www\./i.test(value);
  if (isLink) {
    const url = /^www\./i.test(value) ? 'https://' + value : value;
    const result = SG.checkUrl(url, compiled, settings, allowedCompiled);
    const terms = SG.extractSearchTerms(url);
    if (result && result.kind === 'site') {
      blocked(`${result.site} is on your blocked sites list.`);
    } else if (result) {
      blocked(h('span', {}, `This link searches for “${result.term}”, which ${result.hit.typos ? 'is a close spelling of' : 'contains'} “${result.hit.word}”: `, highlighted(result.hit)));
    } else if (!terms.length) {
      allowed('This link isn’t a search, so the words inside the address aren’t checked.');
    } else {
      allowed(`This link searches for “${terms.join(' ')}”, which has no blocked words.`);
    }
    return;
  }

  if (!compiled.length) {
    out.append(h('p', { class: 'muted' }, 'Add a blocked word above to try it.'));
    return;
  }
  const hit = SG.findBlocked(value, compiled, settings.options, true, allowedCompiled);
  if (hit) {
    const how = hit.pieces ? `Counts as “${hit.word}”, written in pieces: `
      : hit.typos ? `Close spelling of “${hit.word}”: ` : `Counts as “${hit.word}”: `;
    blocked(h('span', {}, how, highlighted(hit)));
  } else {
    const phrase = SG.findAllowed(value, allowedCompiled, settings.options);
    const excused = phrase && SG.findBlocked(value, compiled, settings.options, true);
    allowed(excused ? `“${phrase}” is on the help list, so this gets through.` : 'No blocked words in this.');
  }
}
$('test-input').addEventListener('input', runTest);

// ---------- Toggles ----------
document.querySelectorAll('[data-opt]').forEach(box => {
  box.addEventListener('change', async () => {
    const key = box.dataset.opt;
    // Loosening needs unlocking: switching a protection off, or switching the help list on.
    const loosening = (SG.PROTECTIVE_OPTIONS.includes(key) && !box.checked) ||
                      (SG.LOOSENING_OPTIONS.includes(key) && box.checked);
    if (loosening && needsUnlock()) { box.checked = !box.checked; return; }
    settings.options[key] = box.checked;
    await save();
  });
});

function renderToggles() {
  document.querySelectorAll('[data-opt]').forEach(box => {
    box.checked = !!settings.options[box.dataset.opt];
  });
}

// ---------- Short image search pass ----------
// Image search can be opened for a few minutes without unlocking, after a wait on this page.
// The pass always ends by itself, so it can't be left open by accident.
let imagePass = null;
let passWait = null;   // { endsAt, timer } while the wait is counting down
let passTick = null;

const clock = ms => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

async function loadPass() {
  imagePass = await SG.loadImagePass();
  renderImagePass();
}

function cancelPassWait() {
  if (passWait) clearInterval(passWait.timer);
  passWait = null;
}

function renderImagePass() {
  const box = $('image-pass');
  clearInterval(passTick);
  box.hidden = !settings.options.noImageSearch;
  if (box.hidden) { cancelPassWait(); return; }
  box.replaceChildren();

  if (SG.imagePassActive(imagePass)) {
    const left = h('span', { class: 'clock' }, clock(imagePass.until - Date.now()));
    box.append(
      h('p', {}, 'Image search is open for ', left, ' more. It closes again by itself.'),
      h('div', { class: 'lock-row' }, h('button', {
        type: 'button', class: 'btn',
        onclick: async () => { await chrome.storage.local.remove('imagePass'); }
      }, 'Close it now'))
    );
    passTick = setInterval(() => {
      if (!SG.imagePassActive(imagePass)) { renderImagePass(); return; }
      left.textContent = clock(imagePass.until - Date.now());
    }, 1000);
    return;
  }

  if (passWait) {
    const left = h('span', { class: 'clock' }, clock(passWait.endsAt - Date.now()));
    box.append(
      h('p', {}, 'Image search opens in ', left, '. Keep this page open; leaving it cancels the wait.'),
      h('div', { class: 'lock-row' }, h('button', {
        type: 'button', class: 'btn',
        onclick: () => { cancelPassWait(); renderImagePass(); }
      }, 'Cancel'))
    );
    passWait.label = left;
    return;
  }

  box.append(
    h('p', {}, `Need a picture? Open image search for ${SG.IMAGE_PASS_MINUTES} minutes after a ${SG.IMAGE_PASS_WAIT_SECONDS / 60}-minute wait. No unlocking needed.`),
    h('div', { class: 'lock-row' }, h('button', {
      type: 'button', class: 'btn',
      onclick: () => {
        const endsAt = Date.now() + SG.IMAGE_PASS_WAIT_SECONDS * 1000;
        passWait = { endsAt, timer: null, label: null };
        passWait.timer = setInterval(async () => {
          if (!passWait) return;
          const left = passWait.endsAt - Date.now();
          if (passWait.label) passWait.label.textContent = clock(left);
          if (left > 0) return;
          cancelPassWait();
          await chrome.storage.local.set({ imagePass: { until: Date.now() + SG.IMAGE_PASS_MINUTES * 60000 } });
        }, 250);
        renderImagePass();
      }
    }, `Open image search for ${SG.IMAGE_PASS_MINUTES} minutes`))
  );
}

// ---------- Password ----------
const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150000 },
    key,
    256
  );
  return toHex(bits);
}

function newPasswordForm() {
  const pw1 = h('input', { type: 'password', id: 'pw1', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password' });
  return h('form', {
    class: 'lock-form',
    onsubmit: async e => {
      e.preventDefault();
      if (pw1.value.length < 4) { note('lock-note', 'Use at least 4 characters.', true); return; }
      if (pw1.value !== pw2.value) { note('lock-note', 'The two passwords don’t match.', true); return; }
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      settings.lock = { type: 'password', salt, hash: await hashPassword(pw1.value, salt) };
      unlocked = false;
      changingLock = false;
      await save();
      note('lock-note', 'Password set. Settings are locked.');
    }
  },
    h('label', { for: 'pw1' }, 'New password'), pw1,
    h('label', { for: 'pw2' }, 'Type it again'), pw2,
    h('div', { class: 'lock-row' },
      h('button', { type: 'submit', class: 'btn primary' }, 'Lock with a password')
    )
  );
}

function typingLockForm() {
  const select = h('select', { id: 'typing-minutes' },
    h('option', { value: '10' }, 'About 10 minutes'),
    h('option', { value: '20', selected: true }, 'About 20 minutes'),
    h('option', { value: '30' }, 'About 30 minutes')
  );
  return h('form', {
    class: 'lock-form',
    onsubmit: async e => {
      e.preventDefault();
      const minutes = Number(select.value);
      settings.lock = { type: 'typing', minutes, chars: WatchwordChallenge.MINUTES_TO_CHARS[minutes] };
      unlocked = false;
      changingLock = false;
      await save();
      note('lock-note', `Locked. Unlocking now takes about ${minutes} minutes of typing.`);
    }
  },
    h('label', { for: 'typing-minutes' }, 'How long unlocking should take'), select,
    h('div', { class: 'lock-row' }, h('button', { type: 'submit', class: 'btn primary' }, 'Lock with a typing challenge'))
  );
}

function renderLock() {
  const area = $('lock-area');
  const keepNote = $('lock-note') ? $('lock-note').textContent : '';
  if (challenge) { challenge.destroy(); challenge = null; }
  area.replaceChildren();

  if (!settings.lock || changingLock) {
    area.append(
      h('p', { class: 'hint' }, 'Lock your settings so nobody can remove blocked words or sites, turn off ≈, or switch off a protection without unlocking. Adding new words, sites and protections always works. Choose one way to lock:'),
      h('div', { class: 'lock-choice' },
        h('div', { class: 'lock-option' },
          h('h3', {}, 'Typing challenge'),
          h('span', { class: 'lock-tag' }, 'To lock yourself'),
          h('p', { class: 'hint' }, 'The right choice when you’re locking your own settings. To unlock, you type fresh random text by hand, in one sitting: no pasting, and no saving progress for later. There’s nothing to write down or keep, so there’s no way to let yourself back in early.'),
          typingLockForm()
        ),
        h('div', { class: 'lock-option' },
          h('h3', {}, 'Password'),
          h('span', { class: 'lock-tag' }, 'Only if someone else holds it'),
          h('p', { class: 'hint' }, 'Only use this if a person you trust sets the password and keeps it, so you never know it. A password you set yourself is not a real lock: you could write it down, copy it, or press Ctrl+Z to bring it back, and use it in a weak moment. To lock your own settings, use the typing challenge.'),
          newPasswordForm()
        )
      ),
      ...(changingLock ? [h('div', { class: 'lock-row' }, h('button', {
        type: 'button', class: 'btn', onclick: () => { changingLock = false; renderLock(); }
      }, 'Keep the current lock'))] : [])
    );
  } else if (!unlocked && lockType() === 'typing') {
    const holder = h('div', {});
    area.append(
      h('p', { class: 'lock-state' }, h('strong', {}, 'Locked with a typing challenge. '),
        `You can still add words and sites. To remove something or switch a protection off, type about ${settings.lock.minutes} minutes of random text.`),
      h('div', { class: 'lock-row' }, h('button', {
        type: 'button', class: 'btn primary', id: 'unlock-start',
        onclick: e => {
          e.target.hidden = true;
          challenge = WatchwordChallenge.create(holder, {
            chars: settings.lock.chars,
            onDone: () => { challenge = null; unlocked = true; render(); note('lock-note', 'Unlocked until this page is closed.'); },
            onCancel: () => { challenge = null; e.target.hidden = false; }
          });
        }
      }, 'Start the typing challenge')),
      holder
    );
  } else if (!unlocked) {
    const input = h('input', { type: 'password', id: 'unlock-input', autocomplete: 'current-password' });
    area.append(
      h('p', { class: 'lock-state' }, h('strong', {}, 'Locked with a password. '), 'You can still add words and sites. To remove something or switch a protection off, enter the password.'),
      h('form', {
        class: 'lock-form',
        onsubmit: async e => {
          e.preventDefault();
          const hash = await hashPassword(input.value, settings.lock.salt);
          if (hash !== settings.lock.hash) { note('lock-note', 'That password isn’t right.', true); input.select(); return; }
          unlocked = true;
          render();
          note('lock-note', 'Unlocked until this page is closed.');
        }
      },
        h('label', { for: 'unlock-input' }, 'Password'), input,
        h('div', { class: 'lock-row' }, h('button', { type: 'submit', class: 'btn primary' }, 'Unlock'))
      )
    );
  } else {
    area.append(
      h('p', { class: 'lock-state' }, h('strong', {}, 'Unlocked '), 'until this page is closed.'),
      h('div', { class: 'lock-row' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => { unlocked = false; render(); note('lock-note', 'Locked.'); } }, 'Lock now'),
        h('button', { type: 'button', class: 'btn', onclick: () => { changingLock = true; renderLock(); } }, 'Change how it’s locked'),
        h('button', {
          type: 'button', class: 'btn danger',
          onclick: async () => { settings.lock = null; unlocked = false; await save(); note('lock-note', 'Lock removed.'); }
        }, 'Remove the lock')
      )
    );
  }
  area.append(h('p', { id: 'lock-note', class: 'form-note', role: 'status' }, keepNote));
}

// ---------- Page ----------
function renderStatus() {
  const w = settings.words.length;
  const s = settings.sites.length;
  let text = w || s
    ? `Watching ${plural(w, 'word', 'words')} and ${plural(s, 'site', 'sites')}.`
    : 'Nothing blocked yet. Add a word below to start.';
  if (settings.lock) text += !isLocked() ? ' Unlocked for now.' : lockType() === 'typing' ? ' Locked with a typing challenge.' : ' Locked with a password.';
  $('status').textContent = text;
}

function render() {
  renderStatus();
  if (!$('packs').hidden) renderPacks();
  renderWords();
  renderSites();
  renderHelp();
  renderToggles();
  renderImagePass();
  renderLock();
  runTest();
}

// Only web pages matter; local files are a separate opt-in in Chrome and Edge.
const WEB_ORIGINS = ['http://*/*', 'https://*/*'];

async function checkPermission() {
  try {
    const ok = await chrome.permissions.contains({ origins: WEB_ORIGINS });
    $('permission-banner').hidden = ok;
  } catch (e) { /* older browser: assume granted */ }
}
$('grant').addEventListener('click', async () => {
  try { await chrome.permissions.request({ origins: WEB_ORIGINS }); } catch (e) { /* declined */ }
  checkPermission();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.imagePass) loadPass();
  if (area !== 'local' || !changes.settings) return;
  const incoming = SG.mergeSettings(changes.settings.newValue);
  if (JSON.stringify(incoming) === JSON.stringify(settings)) return;
  settings = incoming;
  render();
});

(async () => {
  settings = await SG.loadSettings();
  imagePass = await SG.loadImagePass();
  render();
  checkPermission();
})();
