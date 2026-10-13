'use strict';
// Ready-made word lists. Plurals are caught automatically, and a phrase with a space
// ("cam girl") also catches it written together ("camgirl"). Words starting with "~" get
// ≈ switched on: they were checked against the 56,000 most common English words and
// 39,000 Swedish ones, and catching their misspellings doesn't block any everyday word.
// Slang phrases built from small lists, because the stand-in words keep changing ("ahh" and
// "bum" for ass). Each was checked against hundreds of thousands of normal phrases. The "+"
// marker means repeated letters count ("her ahhh") but misspellings don't: one changed
// letter would turn these into normal phrases ("her ask", "big boots").
// "bunda" (Portuguese) and "culo" (Spanish) only ever appear in these English phrases, never on
// their own: "bunda" is also Indonesian for mother and Czech for jacket.
const BODY = ['ass', 'ahh', 'booty', 'butt', 'bum', 'bunda', 'culo'];
const combos = (firsts, seconds) => firsts.flatMap(a => seconds.map(b => `+${a} ${b}`));
// Body-shape slang is only caught next to a word for a person ("caked up gurl", "thicc women"),
// never on its own: makeup, mud and snow get "caked up" too. Not "gal", which also catches "gall".
const PEOPLE = ['girl', 'gurl', 'woman', 'women', 'lady', 'ladies', 'chick', 'babe', 'wife'];
const BODY_SLANG = [
  ...combos(['juicy', 'thick', 'thicc', 'phat', 'caked up'], BODY),
  ...combos(['caked up', 'thick', 'thicc'], PEOPLE),
  '+slim thick', '+she caked up', '+shes caked up',
  // Not "her butt" or "her bum" on their own: parents search "rash on her bum".
  ...combos(['her'], ['ass', 'ahh', 'booty', 'bunda', 'culo']),
  '+big booty', '+fat booty', '+nice ass', '+bubble butt'
];
const BODY_VERBS = ['eat', 'eating', 'ate', 'lick', 'licking', 'sniff', 'sniffing', 'smell', 'smelling'];
const BODY_ACTS = [...combos(BODY_VERBS, BODY), ...combos(BODY_VERBS.map(v => v + ' her'), [...BODY, 'feet'])];
// Written and audio erotica is often searched with softer words: "spicy" and "steamy" books,
// "lemon" fan fiction. Only as phrases: "spicy chicken", "steamy shower" and "lemon cake" stay open.
const READING = ['romance', 'book', 'scene', 'chapter', 'fanfic', 'fanfiction', 'fic', 'fiction', 'manhwa', 'manga',
  'webtoon', 'audio', 'audiobook', 'asmr', 'story', 'stories', 'novel', 'read', 'booktok', 'kindle', 'wattpad', 'ao3'];
const STORIES = [
  ...combos(['spicy', 'steamy'], READING),
  ...combos(['lemon', 'lime'], ['fanfic', 'fanfiction', 'fic', 'one shot', 'oneshot']),
  '+x reader lemon', '+fanfic lemon', '+fanfiction lemon', '+monster romance', '+sex story', '+sex stories', '+dirty talk',
  // App and site names, as phrases where the name alone is also something else (Harley Quinn, the Dipsea trail).
  '+lush stories', '+quinn app', '+quinn audio', '+dipsea app', '+dipsea stories', '+dipsea story', '+dipsea audio'
];

globalThis.WORD_PACKS = [
  {
    id: 'explicit',
    title: 'Porn and explicit content',
    about: 'Words like porn, xxx and nsfw.',
    checked: true,
    words: ['~porn', 'porno', '~pornography', '~porn star', '~pron', '~xxx', '~nsfw', '~smut', '~lewd', 'horny',
      '~nude', '~nudity', 'naked', '~topless', '~sexy', 'erotic', '~erotica', '~softcore', '~hentai', '~rule 34',
      '~r34', '~x rated', '~sex video', '~sex tape', 'sexting', '~sex chat', '~sex cam', '~cam girl', '~cam boy',
      '~cam model', '~striptease', '~strip club', '~lap dance']
  },
  {
    id: 'acts',
    title: 'Sex acts',
    about: 'Common words and phrases for sex acts.',
    checked: true,
    words: ['~blow job', '~hand job', '~foot job', '~tit job', '~rim job', '~cum shot', '~creampie', '~deep throat',
      '~gang bang', '~bukkake', '~orgy', '~orgies', 'threesome', 'fisting', 'squirting', '~face sitting',
      '~doggy style', '+sex position', '~masturbate', '~masturbating', 'masturbation', 'masterbate', 'masterbation', 'mastrubation', '~jerk off', '~jack off',
      '~fap', '~jizz', '+step sis', ...BODY_ACTS]
  },
  {
    id: 'kinks',
    title: 'Fetishes and kinks',
    about: 'Fetish and kink terms, like bdsm and bondage.',
    checked: true,
    words: ['~fetish', 'kinky', '~bdsm', 'bondage', '~femdom', 'findom', '~dominatrix', '~cuckold', 'spank',
      'spanking', '~voyeur', '~upskirt', '~down blouse', '~golden shower', '~feet pics', '~ahegao', '~futanari',
      '~ecchi', '~yaoi', '~milf', '~dilf', '~gilf', '~pawg', '~bbw']
  },
  {
    id: 'stories',
    title: 'Erotic stories, audio and fan fiction',
    about: 'Written and audio erotica, often searched with softer words like “spicy books”, “steamy romance” or “lemon” fan fiction. Also blocks the main erotic story and audio apps.',
    checked: true,
    words: ['~omegaverse', 'smutty', '~literotica', 'erotik', 'erotisk', 'erotiska', '~sexnovell', '~sexnoveller', ...STORIES],
    sites: ['literotica.com', 'lushstories.com', 'tryquinn.com', 'dipseastories.com']
  },
  {
    id: 'slang',
    title: 'Crude slang for body parts',
    about: 'Slang that is almost never used innocently, including phrases like “juicy ahh”, “her booty” and “caked up girl”.',
    checked: true,
    words: ['~boob', 'boobie', 'titty', '~titties', '~tiddies', '~butthole', '~ass hole', '~ass hol', '~camel toe', 'boner', '~schlong',
      '~ballsack', '~nutsack', '~twat', '~cunt', '~clit', '~coochie', '~punani', 'vag', ...BODY_SLANG]
  },
  {
    id: 'sites',
    title: 'Porn sites',
    about: 'Blocks searches for their names, and adds the sites themselves to Blocked sites.',
    checked: true,
    words: ['~pornhub', '~xvideos', '~xhamster', '~xnxx', '~redtube', '~youporn', '~spankbang', 'tube8', '~beeg',
      '~eporner', '~brazzers', '~bangbros', '~only fans', '~fansly', '~chaturbate', '~stripchat', '~livejasmin',
      '~bongacams', '~camsoda', '~manyvids', '~nhentai', 'hanime', '~e hentai'],
    sites: ['pornhub.com', 'xvideos.com', 'xhamster.com', 'xnxx.com', 'redtube.com', 'youporn.com',
      'spankbang.com', 'tube8.com', 'beeg.com', 'eporner.com', 'brazzers.com', 'bangbros.com',
      'onlyfans.com', 'fansly.com', 'chaturbate.com', 'stripchat.com', 'livejasmin.com', 'bongacams.com',
      'camsoda.com', 'manyvids.com', 'nhentai.net', 'hanime.tv', 'e-hentai.org', 'rule34.xxx']
  },
  {
    id: 'suggestive',
    title: 'Suggestive, not explicit',
    about: 'Lingerie, leggings, twerking, shirtless men, romantic roleplay ASMR, “dark romance” books and similar. Useful if softer content is a trigger.',
    checked: false,
    words: ['~lingerie', 'bikini', 'thong', 'panties', 'booty', 'thicc', 'twerk', 'twerking', '~cleavage',
      '~nip slip', '~wardrobe malfunction', '~hot girl', '~thirst trap', '~yoga pants', '~yoga shorts', '~leggings', '~spandex', '~see through', '~braless', 'tight dress',
      '~instagram model', '~gravure', ...combos(['curvy'], PEOPLE),
      'shirtless', '+hot guy', '+hot men', '+asmr boyfriend', '+boyfriend asmr', '+asmr girlfriend', '+girlfriend asmr',
      '+boyfriend roleplay', '+girlfriend roleplay', '+asmr kissing', '+kissing asmr', '+kissing scene', '+kiss scene',
      '+x reader', '+dark romance', '+reverse harem', '+book boyfriend']
  },
  {
    id: 'everyday',
    title: 'Words with everyday meanings too',
    about: 'Anatomy words and slang like sex, breasts, dick and “ahh” (slang for ass). Strong protection, but normal searches like “sex education”, “Moby Dick”, “paint stripper” or “goofy ahh” memes will close too.',
    checked: false,
    warn: true,
    words: ['~sex', 'ass', 'anal', '~cum', '~cock', '~dick', 'pussy', '~tits', 'penis', 'vagina', '~vulva',
      '~genitals', 'breasts', '~nipple', '~clitoris', 'erection', '~kink', '~pegging', 'stripper', '~ahh']
  }
];

