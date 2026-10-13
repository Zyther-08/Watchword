/* Watchword self-test. Local only: not part of the extension package. */
'use strict';
(function () {
  const SG = globalThis.Watchword;
  const PACKS = globalThis.WORD_PACKS;
  const $ = id => document.getElementById(id);

  if (!SG || !PACKS) {
    $('summary').textContent = 'Could not load core.js or packs.js. Keep this file in the same folder as the extension.';
    $('summary').className = 'summary fail';
    return;
  }

  // The same words and sites the "Add word packs" button adds by default.
  const defaults = PACKS.filter(p => p.checked);
  const words = defaults.flatMap(p => p.words);
  const sites = defaults.flatMap(p => p.sites || []);
  const settings = { words, sites, options: SG.DEFAULT_OPTIONS };
  const compiled = SG.compileWords(words);
  const blocked = text => !!SG.findBlocked(text, compiled, settings.options, true);

  const LEET = { a: '4', e: '3', o: '0', s: '5', i: '1' };
  function disguises(word) {
    const letters = word.replace(/\s+/g, '');
    return [
      ['plain', word],
      ['capitals', word.toUpperCase()],
      ['dots', letters.split('').join('.')],
      ['underscores', letters.split('').join('_')],
      ['spaced out', letters.split('').join(' ')],
      ['look-alike characters', word.replace(/[aeosi]/g, c => LEET[c])],
      ['inside a sentence', `free ${word} videos`]
    ];
  }

  function misspellings(word) {
    const w = word.replace(/\s+/g, '');
    const out = [['repeated letter', w.slice(0, 2) + w[1] + w.slice(2)], ['z ending', w + 'z']];
    if (w.length >= SG.MIN_FUZZY_LETTERS) {
      const mid = Math.floor(w.length / 2);
      out.push(['missing letter', w.slice(0, mid) + w.slice(mid + 1)]);
      out.push(['swapped letters', w.slice(0, mid - 1) + w[mid] + w[mid - 1] + w.slice(mid + 1)]);
      out.push(['extra letter', w.slice(0, mid) + 'o' + w.slice(mid)]);
    }
    return out;
  }

  // Everyday searches that must stay open. Many are one letter away from a pack word,
  // to prove ≈ was only switched on where it's safe.
  const EVERYDAY = [
    'chicken breast recipe', 'breast cancer symptoms', 'essex weather', 'middlesex university', 'assassins creed',
    'classic cars for sale', 'cocktail recipes', 'charles dickens novels', 'scunthorpe united', 'cockpit simulator',
    'analysis of variance', 'assignment help', 'therapist near me', 'titanic movie', 'pass the exam', 'bass guitar',
    'cumin spice', 'cumulative frequency', 'vague meaning', 'pronunciation of words', 'booby trap', 'title page',
    'funny videos', 'exotic birds', 'spanish lessons', 'football scores', 'balloon animals', 'islamic history',
    'quran recitation', 'pork chops', 'corn soup', 'nudge theory', 'baked potatoes', 'named after', 'corny jokes',
    'top rated movies', 'settings menu', 'a tiresome day', 'fishing rod', 'quitting smoking', 'sepsis symptoms',
    'pinky promise', 'bandage for a cut', 'fandom wiki', 'spark plug', 'spanning tree', 'boogie woogie',
    'hello kitty', 'dog bones', 'pet hamster', 'anime list', 'tube map london', 'thick crust pizza',
    'things to do', 'tennis scores', 'election results', 'parties near me', 'biking trails', 'boots for winter',
    'tweak settings', 'ripple effect', 'egg begging', 'väder stockholm', 'recept kyckling', 'nyheter idag',
    'it jobs near me', 'jack of all trades', 'a school trip', 'such as holes', 'a mass hole', 'pro on demand',
    'how do i get a job', 'j k rowling', 'c . s . lewis', 'a b testing', 'u s open tennis', 'vitamin b 12',
    'wait ... what', 'dr . who', 'plan b movie', 'x y z coordinates',
    'goofy ahh sound', 'juicy burger recipe', 'juicy couture', 'her ashes', 'her assistant', 'nappy rash on her bum',
    'how to wipe her butt', 'big boots', 'her booth', 'nice asking price', 'eating out near me', 'smelling her perfume',
    'her bumper', 'eat assorted chocolates', 'kicked her butt',
    'smelling her as she walked', 'eat but', 'her as', 'u.s. army', 'her u.s. citizenship', 'a.s. roma', 'her bot',
    'why is my foundation caked up', 'mascara caked up', 'boots caked up with mud', 'snow caked up on the car',
    'thick gallbladder wall', 'thick gall bladder', 'thick chicken breast', 'thick hair women', 'slim fit jeans',
    'slim thin', 'curvy road', 'she cooked up a plan', 'girl thick hair',
    'spicy chicken wings', 'steamy shower', 'lemon cake recipe', 'lime juice', 'harley quinn', 'dipsea trail', 'dirty laundry',
    'the dirty story of oil', 'monster trucks', 'romance novels', 'manga recommendations', 'zimní bunda', 'resep bunda',
    'bunda dan anak', 'eat bundt cake', 'her bundle', 'exotisk frukt', 'omega 3 fish oil'
  ];

  // Disguises people have actually tried; kept here so they're re-checked on every run.
  const FOUND_IN_TESTING = ['assy hol', 'assyhole', 'fetih', 'fa.. r fetih', 'hentia', 'cuomshot', 'nudez',
    'mastrubation', 'masterbation', 'xvidoes', 'blojob', 'nsfww', 'p0rn', 'b.d.s.m',
    'gurl as . yhole', 'as . y hole', 'a s s y h o l e', 'a s s yhole', 'p o r n o o', 'f e t i h', 'hen . tia',
    'her juic.y ahh', 'smellin.g her ahh leggings', 'eating her bu.m', 'her ahhhh', 'juicy a h h', 'thicc b00ty', 'eat @ss',
    'smelling her a.s', 'eating her bu.t', 'her b.o.t.y', 'eat a_s', 'jack o.f',
    'caked up gurl', 'caked-up gurls', 'cakedup gurl', "she's caked up", 'th1cc gurls', 'c.a.k.e.d up girl', 'slim-thick',
    'thicc gurl', 'her bunda', 'her b.u.n.d.a', 'spicy b00ks', 'lemon fan fic', 'spicy booktok reads', 'omegavers', 'erotiska noveller'];

  const ENGINES = [
    ['Google', 'https://www.google.com/search?q='],
    ['Bing', 'https://www.bing.com/search?q='],
    ['DuckDuckGo', 'https://duckduckgo.com/?q='],
    ['YouTube', 'https://www.youtube.com/results?search_query=']
  ];

  const checks = []; // { group, label, text, want, got }
  const add = (group, label, text, want, got) => checks.push({ group, label, text, want, got });

  for (const w of words) {
    const { text } = SG.parseWord(w);
    for (const [kind, t] of disguises(text)) add('Blocked words in 7 disguises', kind, t, true, blocked(t));
  }
  for (const w of words) {
    const { text, fuzzy } = SG.parseWord(w);
    if (!fuzzy) continue;
    for (const [kind, t] of misspellings(text)) add('Misspellings of ≈ words', kind, t, true, blocked(t));
  }
  words.forEach((w, i) => {
    const { text } = SG.parseWord(w);
    const [name, base] = ENGINES[i % ENGINES.length];
    const url = base + encodeURIComponent(text.split('').join('.'));
    add('Searches on Google, Bing, DuckDuckGo, YouTube', name, url, true, !!SG.checkUrl(url, compiled, settings));
  });
  for (const site of sites) {
    const url = `https://www.${site}/`;
    add('Blocked porn sites', site, url, true, !!SG.checkUrl(url, compiled, settings));
  }
  for (const t of FOUND_IN_TESTING) add('Disguises found during testing', 'disguise', t, true, blocked(t));

  // Image search switch: image tabs are recognised, everything else is left alone.
  for (const u of ['https://www.google.com/search?q=cats&udm=2', 'https://www.google.se/search?q=cats&tbm=isch',
                   'https://www.bing.com/images/search?q=cats', 'https://duckduckgo.com/?q=cats&ia=images&iax=images',
                   'https://images.search.yahoo.com/search/images?p=cats', 'https://search.brave.com/images?q=cats'])
    add('Image search switch', 'sent to normal results', u, true, !!SG.normalResultsFor(u));
  for (const u of ['https://www.google.com/search?q=cats', 'https://www.bing.com/search?q=cats',
                   'https://duckduckgo.com/?q=cats', 'https://www.youtube.com/results?search_query=cats',
                   'https://en.wikipedia.org/wiki/Cat'])
    add('Image search switch', 'left alone', u, false, !!SG.normalResultsFor(u));

  // Allowed phrases: help searches get through, anything else blocked still closes.
  const allowedCompiled = SG.compileAllowed(SG.HELP_PHRASES);
  const withAllowed = t => !!SG.findBlocked(t, compiled, settings.options, true, allowedCompiled);
  for (const t of ['how to quit porn', 'porn addiction help', 'stop masturbating tips', 'porn recovery stories'])
    add('Allowed help phrases', 'gets through', t, false, withAllowed(t));
  for (const t of ['quit porn xxx', 'porn', 'free porn', 'porn addiction hentai'])
    add('Allowed help phrases', 'still closes', t, true, withAllowed(t));

  for (const q of EVERYDAY) add('Everyday searches stay open', 'search', q, false, blocked(q));
  for (const url of ['https://example.com/files/provpass.pdf', 'https://en.wikipedia.org/wiki/Sussex', 'https://www.bbc.co.uk/news',
                     'https://example.com/page?s=4553&term=55&q=8008', 'https://www.google.com/url?q=https://www.example.com/files/provpass.pdf']) {
    add('Links that aren’t searches stay open', 'link', url, false, !!SG.checkUrl(url, compiled, settings));
  }

  // ---------- Show results ----------
  const failed = checks.filter(c => c.want !== c.got);
  const groups = [...new Set(checks.map(c => c.group))];
  $('summary').textContent = failed.length
    ? `${failed.length} of ${checks.length.toLocaleString('en')} checks failed`
    : `All ${checks.length.toLocaleString('en')} checks passed`;
  $('summary').className = 'summary ' + (failed.length ? 'fail' : 'pass');
  $('sub').textContent = `${words.length} words and ${sites.length} sites from the default word packs, tested ${new Date().toLocaleString()}.`;

  const rows = $('rows');
  const details = $('details');
  for (const g of groups) {
    const list = checks.filter(c => c.group === g);
    const bad = list.filter(c => c.want !== c.got);
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = g;
    const res = document.createElement('td');
    res.className = 'num ' + (bad.length ? 'bad' : 'ok');
    res.textContent = `${list.length - bad.length} of ${list.length} ✓`;
    tr.append(name, res);
    rows.append(tr);

    const h = document.createElement('h3');
    h.textContent = g;
    const ul = document.createElement('ul');
    ul.className = 'detail-list';
    for (const c of [...bad, ...list.filter(c => c.want === c.got)]) {
      const li = document.createElement('li');
      const ok = c.want === c.got;
      li.className = ok ? '' : 'bad';
      li.textContent = `${ok ? '✓' : '✗'} ${c.label}: ${c.text} → ${c.got ? 'closes' : 'stays open'}`;
      ul.append(li);
    }
    details.append(h, ul);
  }
})();
