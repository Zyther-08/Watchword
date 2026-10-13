/*
 * Watchword: typing-challenge unlock, for people with no one to hold a password.
 * To unlock, type fresh random text by hand, in one sitting:
 *   - nothing can be pasted, dropped or auto-filled (it isn't a text box at all)
 *   - the text is new every attempt, so there's nothing to prepare or memorize
 *   - a minute without typing, or leaving the page, starts over with new text
 *   - wrong characters aren't accepted, so a typo can't silently ruin the attempt
 *   - typing faster than any person can (an auto-typer) starts over too
 */
'use strict';
(function () {
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l, o, 0 or 1: too easy to mix up
  const GROUP = 5;
  const IDLE_MS = 60 * 1000;
  const FASTEST_HUMAN_GAP_MS = 70; // averaged over 20 keys; random text is much slower than that
  const MINUTES_TO_CHARS = { 10: 1000, 20: 2000, 30: 3000 };

  function randomText(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    const out = [];
    let b = 0;
    while (out.length < length) {
      if (out.length % (GROUP + 1) === GROUP) out.push(' ');
      else out.push(ALPHABET[bytes[b++] % ALPHABET.length]); // 256 is a multiple of 32: no bias
    }
    return out.join('').trimEnd();
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  }

  function create(container, { chars, onDone, onCancel }) {
    let text = randomText(chars);
    let pos = 0;
    let times = [];
    let idleTimer = null;
    let finished = false;
    let keepMessageUntil = 0; // restart messages stay up for the first characters of the new text

    const status = document.createElement('p');
    status.className = 'form-note';
    status.setAttribute('role', 'status');

    const progress = document.createElement('p');
    progress.className = 'challenge-progress';

    const canvas = document.createElement('canvas');
    canvas.className = 'challenge-text';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'textbox');
    canvas.setAttribute('aria-label', 'Typing challenge. Type the random text shown, by hand.');

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Click the box and type the text exactly, spaces included. Pasting doesn’t work, wrong characters aren’t accepted, and if you stop for a minute or leave this page, it starts again with new text.';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => { destroy(); if (onCancel) onCancel(); });

    const row = document.createElement('div');
    row.className = 'lock-row';
    row.append(cancel);

    const wrap = document.createElement('div');
    wrap.className = 'challenge';
    wrap.append(hint, canvas, progress, status, row);
    container.append(wrap);

    function say(message, isError = false) {
      status.textContent = message;
      status.classList.toggle('error', isError);
    }

    function restart(message) {
      text = randomText(chars);
      pos = 0;
      times = [];
      clearTimeout(idleTimer);
      keepMessageUntil = 15;
      say(message, true);
      draw();
    }

    function bumpIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => restart('A minute went by without typing, so it started again with new text.'), IDLE_MS);
    }

    function draw() {
      const width = Math.max(260, canvas.clientWidth || container.clientWidth || 600);
      const dpr = window.devicePixelRatio || 1;
      const fontSize = width < 420 ? 17 : 20;
      const ctx = canvas.getContext('2d');
      ctx.font = `${fontSize}px ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace`;
      const charW = ctx.measureText('m').width;
      const pad = 16;
      const groupsPerLine = Math.max(2, Math.floor((width - pad * 2 + charW) / (charW * (GROUP + 1))));
      const lineLen = groupsPerLine * (GROUP + 1);
      const lineH = Math.round(fontSize * 1.7);
      const visibleLines = 5;
      const height = pad * 2 + lineH * visibleLines;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = css('--paper');
      ctx.fillRect(0, 0, width, height);

      const currentLine = Math.floor(pos / lineLen);
      const firstLine = Math.max(0, currentLine - 1);
      for (let l = 0; l < visibleLines; l++) {
        const lineIndex = firstLine + l;
        const start = lineIndex * lineLen;
        if (start >= text.length) break;
        const y = pad + l * lineH + lineH / 2;
        for (let i = start; i < Math.min(start + lineLen, text.length); i++) {
          const x = pad + (i - start) * charW;
          if (i === pos) {
            ctx.fillStyle = css('--pine-soft');
            ctx.fillRect(x - 1, y - lineH / 2 + 3, charW + 2, lineH - 6);
            ctx.fillStyle = css('--pine');
            ctx.fillRect(x - 1, y + lineH / 2 - 6, charW + 2, 2);
          }
          if (text[i] === ' ') continue;
          ctx.fillStyle = i < pos ? css('--pine') : i === pos ? css('--ink') : css('--slate');
          ctx.globalAlpha = i < pos ? 0.55 : 1;
          ctx.fillText(text[i], x, y);
          ctx.globalAlpha = 1;
        }
      }
      progress.textContent = `${pos.toLocaleString('en')} of ${text.length.toLocaleString('en')} characters`;
    }

    function onKey(e) {
      if (finished) return;
      if (!e.isTrusted) return;                 // ignore anything a script tries to send
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key && e.key.toLowerCase() === 'v') say('Pasting doesn’t work here. Every character has to be typed.', true);
        return;
      }
      if (!e.key || e.key.length !== 1) return; // Shift, arrows, Backspace and so on
      e.preventDefault();
      bumpIdle();
      if (e.key !== text[pos]) {
        if (pos < keepMessageUntil) return;       // keep the restart explanation on screen
        const caps = e.getModifierState && e.getModifierState('CapsLock');
        say(caps ? 'Caps Lock is on: the text is all lower case.' : `Not quite: the next character is “${text[pos] === ' ' ? 'space' : text[pos]}”.`, true);
        return;
      }
      const now = performance.now();
      times.push(now);
      if (times.length > 20) times.shift();
      if (times.length === 20 && (times[19] - times[0]) / 19 < FASTEST_HUMAN_GAP_MS) {
        restart('That was faster than anyone types by hand, so it started again with new text.');
        return;
      }
      if (pos >= keepMessageUntil) say('');
      pos++;
      draw();
      if (pos >= text.length) {
        finished = true;
        destroy();
        onDone();
      }
    }

    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('paste', e => { e.preventDefault(); say('Pasting doesn’t work here. Every character has to be typed.', true); });
    canvas.addEventListener('drop', e => e.preventDefault());
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => { draw(); canvas.focus({ preventScroll: true }); });

    function destroy() {
      clearTimeout(idleTimer);
      window.removeEventListener('resize', onResize);
      wrap.remove();
    }

    return { destroy };
  }

  globalThis.WatchwordChallenge = { create, MINUTES_TO_CHARS };
})();
