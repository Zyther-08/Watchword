/*
 * Watchword: shared logic.
 * Loaded by the background worker, the content script and the settings page.
 * Nothing here talks to the network; everything stays on this device.
 */
(function () {
  'use strict';

  const DEFAULT_OPTIONS = {
    spaces: true,      // "b all" counts as "ball"
    leet: true,        // "b4ll", "@ss", "$ex"
    plurals: true,     // blocking "ball" also blocks "balls"
    typing: true,      // close the tab while a blocked word is typed into a search box
    instantTyping: false, // short words close instantly too, even mid-word ("ass" in "assignment")
    safeSearch: true,  // strict SafeSearch on Google/Bing/DuckDuckGo + YouTube Restricted Mode
    noImageSearch: false, // send image search tabs to the normal results for the same search
    keepWindow: true,  // if the last tab is closed, open a new one so the window stays
    hideList: false,   // hide the word list on the settings page
    helpPhrases: true  // let the fixed list of help searches through ("how to quit porn")
  };

  // Searches that get through even though they contain a blocked word, so looking for help
  // isn't blocked. The list is fixed and shown on the settings page: nobody can add to it,
  // so it can't become a back door ("free porn"). Any other blocked word still closes the tab.
  const HELP_PHRASES = ['quit porn', 'stop watching porn', 'porn addiction', 'porn recovery', 'sex addiction',
    'sex education', 'masturbation addiction', 'stop masturbating', 'quit masturbating'];

  // Options that let more through while ON. Turning one ON needs unlocking.
  // Nothing here now: the help list is fixed and safe, so it can be turned on and off freely.
  const LOOSENING_OPTIONS = [];

  // Options that make blocking stricter while ON. Turning one OFF needs the password.
  const PROTECTIVE_OPTIONS = ['spaces', 'leet', 'plurals', 'typing', 'instantTyping', 'safeSearch', 'noImageSearch'];

  // ---------------------------------------------------------------------------
  // Image search. When it's turned off, an image search page is swapped for the
  // normal results of the same search, so the search itself still works. A short
  // pass (started from the settings page) allows it for a while, then it ends.
  // ---------------------------------------------------------------------------
  const IMAGE_PASS_MINUTES = 10;
  const IMAGE_PASS_WAIT_SECONDS = 120;

  /** If `urlString` is an image search, the address of the normal results for it; otherwise null. */
  function normalResultsFor(urlString) {
    let url;
    try { url = new URL(urlString); } catch (e) { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const p = url.searchParams;
    const path = url.pathname.toLowerCase();

    // Google: the Images tab is /search with tbm=isch or udm=2; images.google.* is the old home.
    if (/(^|\.)google\.[a-z.]+$/.test(host)) {
      const isImages = (path === '/search' && (p.get('tbm') === 'isch' || p.get('udm') === '2')) ||
                       /^images\.google\./.test(host) || path.startsWith('/imghp');
      if (!isImages) return null;
      const q = p.get('q');
      const base = `https://${host.replace(/^images\./, 'www.')}`;
      return q ? `${base}/search?q=${encodeURIComponent(q)}` : `${base}/`;
    }
    // Bing: /images/... ; DuckDuckGo: ia=images or iax=images.
    if (/(^|\.)bing\.com$/.test(host)) {
      if (!path.startsWith('/images')) return null;
      const q = p.get('q');
      return q ? `https://www.bing.com/search?q=${encodeURIComponent(q)}` : 'https://www.bing.com/';
    }
    if (/(^|\.)duckduckgo\.com$/.test(host)) {
      if (p.get('ia') !== 'images' && p.get('iax') !== 'images') return null;
      const q = p.get('q');
      return q ? `https://duckduckgo.com/?q=${encodeURIComponent(q)}` : 'https://duckduckgo.com/';
    }
    // Yahoo, Brave, Ecosia and Yandex image search.
    if (/^images\.search\.yahoo\.com$/.test(host)) {
      const q = p.get('p');
      return q ? `https://search.yahoo.com/search?p=${encodeURIComponent(q)}` : 'https://search.yahoo.com/';
    }
    if (host === 'search.brave.com' && path.startsWith('/images')) {
      const q = p.get('q');
      return q ? `https://search.brave.com/search?q=${encodeURIComponent(q)}` : 'https://search.brave.com/';
    }
    if (/(^|\.)ecosia\.org$/.test(host) && path.startsWith('/images')) {
      const q = p.get('q');
      return q ? `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` : 'https://www.ecosia.org/';
    }
    if (/(^|\.)yandex\.[a-z.]+$/.test(host) && path.startsWith('/images')) {
      const q = p.get('text');
      return q ? `https://${host}/search/?text=${encodeURIComponent(q)}` : `https://${host}/`;
    }
    return null;
  }

  function imagePassActive(pass, now = Date.now()) {
    return !!pass && Number.isFinite(pass.until) && pass.until > now;
  }

  /** Where an image search should go instead, or null if it's allowed right now. */
  function imageSearchRedirect(urlString, options, pass, now = Date.now()) {
    if (!options || !options.noImageSearch || imagePassActive(pass, now)) return null;
    return normalResultsFor(urlString);
  }

  async function loadImagePass() {
    try {
      const data = await chrome.storage.local.get('imagePass');
      return data.imagePass || null;
    } catch (e) {
      return null;
    }
  }

  function mergeSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
      words: Array.isArray(s.words) ? s.words.filter(w => typeof w === 'string') : [],
      sites: Array.isArray(s.sites) ? s.sites.filter(w => typeof w === 'string') : [],
      options: Object.assign({}, DEFAULT_OPTIONS, s.options),
      lock: validLock(s.lock)
    };
  }

  // Two kinds of lock: a password (someone else keeps it), or a typing challenge
  // (for people on their own: about 10, 20 or 30 minutes of typing random text).
  function validLock(l) {
    if (!l || typeof l !== 'object') return null;
    if (l.type === 'typing') {
      return Number.isFinite(l.chars) && l.chars > 0 ? { type: 'typing', minutes: l.minutes || 20, chars: l.chars } : null;
    }
    return l.hash && l.salt ? { type: 'password', salt: l.salt, hash: l.hash } : null;
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get('settings');
    return mergeSettings(data.settings);
  }

  // ---------------------------------------------------------------------------
  // Text clean-up: lower case, strip accents (bàll), undo full-width and fancy
  // letters (ｂａｌｌ, 𝐛𝐚𝐥𝐥) and swap common look-alike letters from other alphabets.
  // ---------------------------------------------------------------------------
  const LOOKALIKES = {
    // Cyrillic
    'а': 'a', 'в': 'b', 'е': 'e', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'к': 'k', 'м': 'm',
    'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'ԁ': 'd',
    'һ': 'h', 'ԛ': 'q', 'ԝ': 'w',
    // Greek
    'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o',
    'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ω': 'w',
    // Latin extras that don't decompose on their own
    'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ł': 'l', 'ı': 'i', 'ħ': 'h',
    'ŧ': 't', 'ɡ': 'g'
  };

  function normalize(text) {
    const base = String(text == null ? '' : text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '');
    let out = '';
    for (const ch of base) out += LOOKALIKES[ch] ?? ch;
    return out;
  }

  // Characters that can stand in for letters when "look-alike characters" is on.
  const LEET = {
    '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e', '€': 'e', '6': 'g', '9': 'g',
    '1': 'il', '!': 'i', '|': 'il', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't',
    '2': 'z'
  };

  const WORD_CHAR = /[\p{L}\p{N}]/u;
  const LETTER = /\p{L}/u;
  const SPACE = /\s/u;
  const APOSTROPHE = /['’ʼ‘`]/u;
  const MAX_CHARS = 1000;

  const isWordChar = c => c !== undefined && WORD_CHAR.test(c);

  function canBe(c, letter, o) {
    return c === letter || (o.leet && LEET[c] !== undefined && LEET[c].includes(letter));
  }

  // Anything that isn't a letter or digit can sit inside a word (b.all, b_all, b?all).
  // Spaces only count when "split by spaces" is on, or the blocked phrase has a space there.
  function isSeparator(c, phraseGap, o) {
    return !isWordChar(c) && (o.spaces || phraseGap || !SPACE.test(c));
  }

  // A blocked word may only start where a word starts: "ass" never matches inside "pass".
  // An apostrophe between letters keeps a word together, so "it's hit" doesn't read as "s hit".
  function startsWord(chars, i) {
    if (i === 0) return true;
    const prev = chars[i - 1];
    if (isWordChar(prev)) return false;
    if (APOSTROPHE.test(prev) && i >= 2 && LETTER.test(chars[i - 2])) return false;
    return true;
  }

  // Words saved with a leading "~" (shown as ≈) also catch repeated letters ("nsfww",
  // "poorn"), and if they have 5+ letters, misspellings too ("cuomshot"). Short words
  // only get repeated letters, because one changed letter turns "porn" into "pork".
  const FUZZY_PREFIX = '~';
  const MIN_FUZZY_LETTERS = 5;

  // Typos allowed: 1 for words of 5 to 8 letters, 2 for longer words and phrases.
  function typoBudget(letterCount) {
    if (letterCount >= 9) return 2;
    if (letterCount >= MIN_FUZZY_LETTERS) return 1;
    return 0;
  }

  // Words saved with a leading "+" catch repeated letters only ("her ahhh" for "her ahh"),
  // never misspellings. Used for short slang phrases, where one changed letter would
  // turn them into normal words ("her ask", "big boots").
  const REPEAT_PREFIX = '+';

  function parseWord(raw) {
    const text = String(raw == null ? '' : raw).trim();
    const fuzzy = text.startsWith(FUZZY_PREFIX);
    const repeatsOnly = !fuzzy && text.startsWith(REPEAT_PREFIX);
    return { text: fuzzy || repeatsOnly ? text.slice(1).trim() : text, fuzzy, repeatsOnly };
  }

  // Letters that are often written out: nyström → nystroem, åsa → aasa.
  const SPELLED_OUT = { 'ä': 'e', 'ö': 'e', 'ü': 'e', 'ø': 'e', 'å': 'a' };

  function hasLetter(chars, start, end) {
    for (let x = start; x < end; x++) if (LETTER.test(chars[x])) return true;
    return false;
  }

  function compileWord(raw) {
    const { text, fuzzy, repeatsOnly } = parseWord(raw);
    const letters = [];
    const gapAfter = [];
    const follow = [];
    let gap = false;
    for (const original of text.toLowerCase().normalize('NFC')) {
      for (const ch of normalize(original)) {
        if (isWordChar(ch)) {
          if (gap && letters.length) gapAfter[letters.length - 1] = true;
          letters.push(ch);
          gapAfter.push(false);
          follow.push(null);
          gap = false;
        } else {
          gap = true;
        }
      }
      if (SPELLED_OUT[original] && follow.length) follow[follow.length - 1] = SPELLED_OUT[original];
    }
    if (!letters.length) return null;
    const isPhrase = gapAfter.some(Boolean);
    // Each phrase word's ending (including a repeated last letter: both f's in "off") is
    // marked, so it can't go missing when the words are written separately ("jack of").
    const protectedEnd = letters.map(() => false);
    if (isPhrase) {
      for (let j = 0; j < letters.length; j++) {
        if (!gapAfter[j] && j !== letters.length - 1) continue;
        for (let m = j; m >= 0 && letters[m] === letters[j] && (m === j || !gapAfter[m]); m--) protectedEnd[m] = true;
      }
    }
    const key = letters.map((l, i) => l + (gapAfter[i] ? ' ' : '')).join('');
    return {
      word: text, letters, gapAfter, follow, key,
      typos: fuzzy ? typoBudget(letters.length) : 0,
      repeats: fuzzy || repeatsOnly,
      hasDouble: letters.some((l, i) => i > 0 && l === letters[i - 1]),
      // Letters in the last word: typing waits on short endings ("her ass" → "her assistant").
      lastWord: letters.length - 1 - Math.max(-1, gapAfter.lastIndexOf(true)),
      protectedEnd
    };
  }

  function wordKey(raw) {
    const c = compileWord(raw);
    return c ? c.key : '';
  }

  function compileWords(words) {
    const byKey = new Map();
    for (const w of words || []) {
      const c = compileWord(w);
      if (!c) continue;
      const prev = byKey.get(c.key);
      if (!prev) { byKey.set(c.key, c); continue; }
      prev.typos = Math.max(prev.typos, c.typos);
      prev.repeats = prev.repeats || c.repeats;
      c.follow.forEach((f, i) => { if (f) prev.follow[i] = f; });
    }
    return [...byKey.values()];
  }

  // Walks the text once, keeping every partial match alive at the same time
  // (no backtracking, so odd input can't slow the browser down).
  // States: 'm' = j letters matched, 'x' = two letters swapped (saw letter j+1, waiting
  // for letter j), 'E'/'S' = plural ending. e = typos used so far.
  // from: only look for matches starting at or after this position.
  // allowed: optional mask; a match lying entirely inside an allowed phrase doesn't count.
  // For each character: is it inside a word with a symbol in the middle ("a.s", "bu.t")?
  // Nobody writes "as" or "but" with a dot inside by accident.
  const symbolWordCache = new WeakMap();
  function symbolWords(chars) {
    let mask = symbolWordCache.get(chars);
    if (mask) return mask;
    mask = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length;) {
      if (SPACE.test(chars[i])) { i++; continue; }
      let j = i;
      let sawWord = false;
      let sawSymbolAfterWord = false;
      let flagged = false;
      while (j < chars.length && !SPACE.test(chars[j])) {
        if (isWordChar(chars[j])) {
          if (sawSymbolAfterWord) flagged = true;
          sawWord = true;
        } else if (sawWord) {
          sawSymbolAfterWord = true;
        }
        j++;
      }
      if (flagged) mask.fill(1, i, j);
      i = j;
    }
    symbolWordCache.set(chars, mask);
    return mask;
  }

  function matchOne(chars, kw, o, endIsBoundary, from = 0, allowed = null) {
    const n = kw.letters.length;
    const k = kw.typos || 0;
    let active = new Map();
    // A double letter may be written once ("a.s" for "ass") on ≈ and "+" words, but only in
    // a word with a symbol inside it, so "her as she walked" is left alone.
    const collapse = kw.repeats && kw.hasDouble ? symbolWords(chars) : null;
    const isDouble = j => j > 0 && j < n && kw.letters[j] === kw.letters[j - 1];

    // e = typos used, r = ≈ repeated letters used, sp = crossed a space that isn't part of the
    // blocked phrase itself ("b all"). Spacing and misspelling can't be combined: otherwise
    // separate everyday words glue together into a blocked one ("it jobs" → "tit job").
    // For phrases: g = written with a real space between its words ("jack off"),
    // d = a word's ending went missing. Both together is how "jack of all trades" would read
    // as "jack off", so it isn't allowed; written as one word ("blojob") it's fine.
    const put = (map, t, j, e, r, sp, g, d, start) => {
      const key = t + j + ':' + e + ':' + (r ? 1 : 0) + (sp ? 1 : 0) + (g ? 1 : 0) + (d ? 1 : 0);
      const prev = map.get(key);
      if (prev !== undefined && prev.start <= start) return;
      map.set(key, { t, j, e, r, sp, g, d, start });
      // A letter missing from the text ("nystrm") costs one typo. The first letter must be there.
      if (t === 'm' && j > 0 && j < n && e < k && !sp) {
        if (!kw.protectedEnd[j]) put(map, 'm', j + 1, e + 1, r, sp, g, d, start);
        else if (!g) put(map, 'm', j + 1, e + 1, r, sp, g, true, start);
      }
    };

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (i >= from && startsWord(chars, i)) put(active, 'm', 0, 0, false, false, false, false, i);
      if (active.size === 0) continue;

      if (collapse && collapse[i]) {
        for (const st of [...active.values()]) {
          if (st.t === 'm' && !st.sp && isDouble(st.j)) put(active, 'm', st.j + 1, st.e, true, st.sp, st.g, st.d, st.start);
        }
      }

      const isLetter = isWordChar(c);
      const isSpace = SPACE.test(c);
      // No misspellings right after a space either ("a mass hole" reading as "ass hole").
      const typoAllowed = !(i > 0 && SPACE.test(chars[i - 1]));
      const next = new Map();
      for (const { t, j, e, r, sp, g, d, start } of active.values()) {
        if (t === 'm') {
          if (j > 0 && isSeparator(c, kw.gapAfter[j - 1], o)) {
            if (!isSpace) put(next, 'm', j, e, r, sp, g, d, start);
            else if (kw.gapAfter[j - 1]) { if (!d) put(next, 'm', j, e, r, sp, true, d, start); }
            else if (e === 0 && !r) put(next, 'm', j, e, r, true, g, d, start);
          }
          if (j < n && canBe(c, kw.letters[j], o)) put(next, 'm', j + 1, e, r, sp, g, d, start);
          if (j > 0 && canBe(c, kw.letters[j - 1], o)) {
            // ≈ repeats only count right next to the letter ("ahhh"), not after a space ("thick kass").
            if (kw.repeats && !sp && !(i > 0 && SPACE.test(chars[i - 1]))) put(next, 'm', j, e, true, sp, g, d, start);
          }
          if (j > 0 && kw.follow[j - 1] && c === kw.follow[j - 1]) put(next, 'm', j, e, r, sp, g, d, start);
          if (j === n && o.plurals) {
            if (canBe(c, 's', o) || c === 'z') put(next, 'S', n, e, r, sp, g, d, start);   // "balls", "nudez"
            if (canBe(c, 'e', o)) put(next, 'E', n, e, r, sp, g, d, start);
          }
          if (j > 0 && e < k && isLetter && typoAllowed && !sp) {
            if (j < n) put(next, 'm', j + 1, e + 1, r, sp, g, d, start);      // wrong letter: "nystrum"
            put(next, 'm', j, e + 1, r, sp, g, d, start);                     // extra letter: "noystrom"
            if (j + 1 < n && canBe(c, kw.letters[j + 1], o)) {
              put(next, 'x', j, e, r, sp, g, d, start);                       // swapped letters: "nystorm"
            }
          }
        } else if (t === 'x') {
          if (canBe(c, kw.letters[j], o)) put(next, 'm', j + 2, e + 1, r, sp, g, d, start);
        } else if (t === 'E') {
          if (isSeparator(c, false, o) && !isSpace) put(next, 'E', n, e, r, sp, g, d, start);
          if (canBe(c, 's', o)) put(next, 'Z', n, e, r, sp, g, d, start);   // "-es" ending: no repeats after it ("assess")
        } else if (t === 'S') {
          if (kw.repeats && !sp && canBe(c, 's', o)) put(next, 'S', n, e, r, sp, g, d, start);
        }
      }

      active = next;
      if (active.size === 0) continue;

      const after = i + 1;
      const atBoundary = after < chars.length ? !isWordChar(chars[after]) : endIsBoundary;
      if (!atBoundary) continue;
      let best = null;
      for (const st of active.values()) {
        const collapsedEnd = collapse && collapse[i] && st.t === 'm' && !st.sp && st.j === n - 1 && isDouble(n - 1);
        if ((st.t === 'm' && st.j === n) || st.t === 'S' || st.t === 'Z' || collapsedEnd) {
          if (allowed && insideAllowed(allowed, st.start, after)) continue;
          // Numbers alone don't count ("8008", "455" in a product code or page number).
          if (!hasLetter(chars, st.start, after)) continue;
          if (!best || st.e < best.e) best = st;
        }
      }
      if (best) return { start: best.start, end: after, typos: best.e };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Allowed phrases: "quit porn" lets "how to quit porn" through. Only the blocked
  // word inside the allowed phrase is excused; any other blocked word still counts.
  // ---------------------------------------------------------------------------
  // The fixed help list, compiled, when the option is on.
  let helpCache = null;
  function helpCompiled(options) {
    if (!options || options.helpPhrases === false) return null;
    if (!helpCache) helpCache = compileAllowed(HELP_PHRASES);
    return helpCache;
  }

  function compileAllowed(phrases) {
    return compileWords((phrases || []).map(p => parseWord(p).text));
  }

  function insideAllowed(mask, start, end) {
    for (let x = start; x < end; x++) if (!mask[x]) return false;
    return true;
  }

  function allowedMask(chars, allowedCompiled, o, endIsBoundary) {
    if (!allowedCompiled || !allowedCompiled.length) return null;
    const mask = new Uint8Array(chars.length);
    let any = false;
    for (const kw of allowedCompiled) {
      let from = 0;
      for (;;) {
        const hit = matchOne(chars, kw, o, endIsBoundary, from);
        if (!hit) break;
        mask.fill(1, hit.start, hit.end);
        any = true;
        from = hit.start + 1;
      }
    }
    return any ? mask : null;
  }

  // While typing, "porn" on the way to the allowed "porn addiction" shouldn't close the tab.
  // After a pause, it only waits if the next word has actually been started ("porn ad").
  function startsAllowedPhrase(chars, start, end, allowedCompiled, paused) {
    if (paused && !chars.slice(end).some(isWordChar)) return false;
    const typed = chars.slice(start).filter(isWordChar).join('');
    return allowedCompiled.some(kw => {
      const full = kw.letters.join('');
      return full.startsWith(typed);
    });
  }

  // ---------------------------------------------------------------------------
  // Words broken into pieces on purpose. Spacing and misspelling normally can't
  // combine (or "it jobs" would read as "tit job"), but some spacing is never how
  // anyone writes a normal search: a lone dot or symbol between words ("as . yhole")
  // or two or more single letters in a row ("a s s y hole"). Those pieces are glued
  // back together, with their neighbours, and checked again with misspellings allowed.
  // ---------------------------------------------------------------------------
  const LONE_SYMBOL = /^[._*?!~^#=]+$/;

  function gluePieces(chars) {
    const tokens = chars.join('').split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;
    const isLoose = t => LONE_SYMBOL.test(t) || Array.from(t).length === 1;
    const out = [];
    let changed = false;
    let i = 0;
    while (i < tokens.length) {
      if (!isLoose(tokens[i])) { out.push(tokens[i]); i++; continue; }
      let j = i;
      while (j < tokens.length && isLoose(tokens[j])) j++;
      const run = tokens.slice(i, j);
      if (run.length >= 2 || run.some(t => LONE_SYMBOL.test(t))) {
        // Glue the run to the word before it and the word after it.
        let piece = run.join('');
        if (out.length) piece = out.pop() + piece;
        if (j < tokens.length) { piece += tokens[j]; j++; }
        out.push(piece);
        changed = true;
      } else {
        out.push(...run);
      }
      i = j;
    }
    return changed ? Array.from(out.join(' ')) : null;
  }

  function searchChars(chars, compiled, o, endIsBoundary, allowedCompiled, typing) {
    // An allowed phrase counts as soon as it's fully typed.
    const mask = allowedMask(chars, allowedCompiled, o, true);
    for (const kw of compiled) {
      let from = 0;
      for (;;) {
        const hit = matchOne(chars, kw, o, endIsBoundary, from, mask);
        if (!hit) break;
        if (typing && allowedCompiled && allowedCompiled.length &&
            startsAllowedPhrase(chars, hit.start, hit.end, allowedCompiled, typing === 'paused')) {
          from = hit.start + 1;
          continue;
        }
        return { word: kw.word, length: kw.letters.length, lastWord: kw.lastWord, chars, start: hit.start, end: hit.end, typos: hit.typos };
      }
    }
    return null;
  }

  /**
   * Looks for any blocked word in `text`.
   * endIsBoundary: whether the end of the text counts as the end of a word. It's false
   * while someone is still typing, so "ass" doesn't fire on the way to "assignment".
   * allowedCompiled: compiled allowed phrases (or null).
   * typing: false for a finished search, 'live' while keys are being pressed, 'paused' after a pause.
   * Returns { word, length, chars, start, end, typos, pieces } or null.
   */
  function findBlocked(text, compiled, options, endIsBoundary = true, allowedCompiled = null, typing = false) {
    if (!compiled || !compiled.length) return null;
    const o = Object.assign({}, DEFAULT_OPTIONS, options);
    const chars = Array.from(normalize(text)).slice(0, MAX_CHARS);
    const hit = searchChars(chars, compiled, o, endIsBoundary, allowedCompiled, typing);
    if (hit) return hit;
    const glued = gluePieces(chars);
    if (!glued) return null;
    const gluedHit = searchChars(glued, compiled, o, endIsBoundary, allowedCompiled, typing);
    return gluedHit ? Object.assign(gluedHit, { pieces: true }) : null;
  }

  /** Which allowed phrase (if any) appears in `text`. For the settings page. */
  function findAllowed(text, allowedCompiled, options) {
    if (!allowedCompiled || !allowedCompiled.length) return null;
    const o = Object.assign({}, DEFAULT_OPTIONS, options);
    const chars = Array.from(normalize(text)).slice(0, MAX_CHARS);
    for (const kw of allowedCompiled) if (matchOne(chars, kw, o, true)) return kw.word;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Pulling the search out of a link. Only what was searched for is checked,
  // never the rest of the address, so a link like .../provpass.pdf is left alone.
  // ---------------------------------------------------------------------------
  const SEARCH_PARAMS = new Set([
    'q', 'query', 'search', 'search_query', 'searchterm', 'search_term', 'searchtext',
    'keyword', 'keywords', 'term', 's'
  ]);
  const SITE_SEARCH_PARAMS = [
    [/(^|\.)yahoo\.[a-z.]+$/, ['p']],
    [/(^|\.)baidu\.com$/, ['wd', 'word']],
    [/(^|\.)yandex\.[a-z.]+$/, ['text']],
    [/(^|\.)amazon\.[a-z.]+$/, ['k', 'field-keywords']],
    [/(^|\.)ebay\.[a-z.]+$/, ['_nkw']]
  ];
  const PATH_SEARCH_MARKERS = new Set(['search', 'tag', 'tags', 'hashtag', 'hashtags']);

  function safeDecode(value) {
    let out = String(value);
    for (let i = 0; i < 2; i++) {
      if (!/%[0-9a-f]{2}/i.test(out)) break;
      try { out = decodeURIComponent(out); } catch (e) { break; }
    }
    return out;
  }

  function extractSearchTerms(urlString) {
    let url;
    try { url = new URL(urlString); } catch (e) { return []; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return [];

    const host = url.hostname.toLowerCase();
    const names = new Set(SEARCH_PARAMS);
    for (const [pattern, extra] of SITE_SEARCH_PARAMS) {
      if (pattern.test(host)) extra.forEach(p => names.add(p));
    }

    const terms = [];
    const collect = params => {
      for (const [key, value] of params) {
        if (value && names.has(key.toLowerCase())) terms.push(safeDecode(value));
      }
    };
    collect(url.searchParams);
    if (url.hash.length > 1) {
      try { collect(new URLSearchParams(url.hash.slice(1).replace(/^[!/?]+/, ''))); } catch (e) { /* not a query */ }
    }

    const segments = url.pathname.split('/').filter(Boolean);
    for (let i = 0; i < segments.length - 1; i++) {
      if (PATH_SEARCH_MARKERS.has(segments[i].toLowerCase())) terms.push(safeDecode(segments[i + 1]));
    }
    return terms;
  }

  // ---------------------------------------------------------------------------
  // Blocked sites
  // ---------------------------------------------------------------------------
  function cleanSite(input) {
    let s = String(input || '').trim().toLowerCase();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
    try {
      const host = new URL(s).hostname.replace(/^www\./, '').replace(/\.$/, '');
      return host.includes('.') ? host : '';
    } catch (e) {
      return '';
    }
  }

  function blockedSiteFor(urlString, sites) {
    let url;
    try { url = new URL(urlString); } catch (e) { return null; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    for (const site of sites || []) {
      if (site && (host === site || host.endsWith('.' + site))) return site;
    }
    return null;
  }

  /** Returns why a URL should be closed ({kind:'site'|'word', ...}) or null. */
  function checkUrl(urlString, compiled, settings, allowedCompiled = null) {
    const site = blockedSiteFor(urlString, settings.sites);
    if (site) return { kind: 'site', site };
    if (!compiled.length) return null;
    for (const term of extractSearchTerms(urlString)) {
      const hit = findBlocked(term, compiled, settings.options, true, allowedCompiled);
      if (hit) return { kind: 'word', term, hit };
    }
    return null;
  }

  globalThis.Watchword = {
    DEFAULT_OPTIONS,
    PROTECTIVE_OPTIONS,
    normalResultsFor,
    imageSearchRedirect,
    imagePassActive,
    loadImagePass,
    IMAGE_PASS_MINUTES,
    IMAGE_PASS_WAIT_SECONDS,
    mergeSettings,
    loadSettings,
    normalize,
    parseWord,
    typoBudget,
    FUZZY_PREFIX,
    REPEAT_PREFIX,
    MIN_FUZZY_LETTERS,
    compileWord,
    compileWords,
    wordKey,
    findBlocked,
    gluePieces,
    compileAllowed,
    findAllowed,
    helpCompiled,
    HELP_PHRASES,
    LOOSENING_OPTIONS,
    extractSearchTerms,
    cleanSite,
    blockedSiteFor,
    checkUrl
  };
})();
