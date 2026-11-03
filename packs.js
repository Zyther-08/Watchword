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
const HER_ADJ = ['juicy', 'thick', 'thicc', 'phat', 'big', 'fat', 'soft', 'round', 'nice', 'tight', 'jiggly', 'huge', 'curvy',
  'perfect', 'bouncy', 'massive', 'plump', 'sexy', 'wide', 'fine', 'stinky', 'smelly', 'sweaty', 'musky'];
const GYM_CLOTHES = ['leggings', 'yoga pants', 'gym clothes', 'gym shorts', 'tights', 'spandex', 'gym leggings'];
const PIXAR_MOMS = ['pixar mom', 'pixar moms', 'pixar mum', 'pixar mums', 'pixar mommy'];
const BODY_SHAPE = ['body', 'bodies', 'bod', 'physique', 'figure', 'curves', 'curvy', 'thighs', 'hips', 'waist', 'proportions',
  'thick', 'thicc', 'booty', 'butt', 'ass'];
const GYM_GIRLS = ['gym girl', 'gym girls', 'gym baddie', 'gym baddies', 'fitness girl', 'fitness girls', 'gym woman', 'gym women'];
// Body-shape slang is only caught next to a word for a person ("caked up gurl", "thicc women"),
// never on its own: makeup, mud and snow get "caked up" too. Not "gal", which also catches "gall".
const PEOPLE = ['girl', 'gurl', 'woman', 'women', 'lady', 'ladies', 'chick', 'babe', 'wife'];
const BODY_SLANG = [
  ...combos(['juicy', 'thick', 'thicc', 'phat', 'caked up'], BODY),
  ...combos(['caked up', 'thick', 'thicc'], PEOPLE),
  '+slim thick', '+she caked up', '+shes caked up',
  // Not "her butt" or "her bum" on their own: parents search "rash on her bum".
  ...combos(['her'], ['ass', 'ahh', 'booty', 'bunda', 'culo']),
  '+big booty', '+fat booty', '+nice ass', '+bubble butt',
  // "Buns" only after "her" or a body-shape word: cinnamon, burger and hair buns are everyday searches.
  '+her buns', ...HER_ADJ.flatMap(a => [...BODY, 'buns'].map(b => `+her ${a} ${b}`)),
  ...combos(['curvy', 'bouncy', 'thicc', 'phat', 'jiggly'], ['buns']),
  // "Booty" is never innocent; "big ass" and "huge ass" are (Big Ass Fans, "huge ass spider").
  ...combos(['round', 'bouncy', 'massive', 'huge', 'perfect', 'curvy', 'plump', 'jiggly', 'sexy', 'tight', 'soft', 'wide'], ['booty']),
  ...combos(['booty', 'ass', 'ahh', 'buns', 'bunda', 'culo'], GYM_CLOTHES.map(c => 'in ' + c)),
  ...combos(['her butt', 'her bum', 'her buns'], GYM_CLOTHES.map(c => 'in ' + c)),
  ...combos(['leggings', 'yoga pants', 'gym shorts', 'spandex'], ['booty', 'ass', 'ahh']),
  // Cartoon-mom body-type memes ("Pixar mom body"), only next to a body word: "best Pixar moms" and
  // "cartoon mom costume" are everyday searches. The plain phrases are in the suggestive pack.
  ...combos(PIXAR_MOMS, [...BODY_SHAPE, 'build', 'built', 'shape', 'shaped', 'legs', 'girl', 'gf', 'girlfriend', 'type girl',
    'gym']),
  // "Disney mom" is also a fan of Disney ("Disney mom shirt", "Disney mom women's tee"), so only pure body words.
  ...combos(['disney mom', 'disney moms', 'cartoon mom', 'cartoon moms'], BODY_SHAPE),
  ...combos(['built like a', 'built like', 'curvy', 'thick', 'thicc', 'gym girl', 'gym girls'], ['pixar mom', 'disney mom', 'cartoon mom']),
  ...combos(['elastigirl', 'helen parr', 'mrs incredible'], ['body', 'thighs', 'curves', 'hips', 'figure', 'legs', 'feet', 'thick', 'thicc', 'booty', 'butt', 'ass']),
  // Gym and fitness girls next to a body-part word. "Gym girl body" is also fitness inspiration,
  // so that and the plain phrases are in the suggestive pack.
  ...combos(GYM_GIRLS, ['curves', 'curvy', 'thighs', 'hips', 'thick', 'thicc', 'booty', 'butt', 'ass', 'pixar mom'])
];
const BODY_VERBS = ['eat', 'eating', 'ate', 'lick', 'licking', 'sniff', 'sniffing', 'smell', 'smelling'];
// More verb forms, only before "her": on their own, "squeeze butt" is a glute exercise.
const HER_VERBS = [...BODY_VERBS, 'smells', 'smelled', 'smelt', 'sniffs', 'sniffed', 'licks', 'licked', 'eats', 'grab', 'grabs',
  'grabbing', 'grabbed', 'squeeze', 'squeezing', 'squeezed', 'slap', 'slapping', 'slapped'];
const BODY_ACTS = [...combos(BODY_VERBS, BODY), ...combos(HER_VERBS.map(v => v + ' her'), [...BODY, 'buns', 'feet'])];
// Acts that are only explicit as phrases. "Humping" alone is everyday (dogs), so only next to a
// person; the bare word is in the everyday pack. Anatomy words only next to "against her" and similar.
const PEOPLE_ALL = [...PEOPLE, 'girls', 'gurls', 'chicks', 'babes', 'wives', 'her', 'she', 'shes'];
const PHRASE_ACTS = [
  ...combos(['sit on', 'sits on', 'sitting on', 'sat on'], ['face', 'my face', 'his face', 'her face', 'your face']),
  ...combos(PEOPLE_ALL, ['humping', 'humps', 'humped']), '+pillow humping',
  ...combos(['penis', 'cock'], ['against her', 'on her', 'between her', 'inside her', 'in her']),
  // On a face. Not "my face": cats, babies and brothers put things there too.
  ...combos([...BODY, 'buns', 'feet'], ['on face', 'on his face', 'on her face', 'in face', 'in his face', 'in her face']),
  '+face fart', '+face farting', ...combos(['fart', 'farts', 'farting', 'farted'], ['on face', 'on his face', 'in his face']),
  ...combos(['girl', 'girls', 'gurl', 'chick', 'babe'], ['farting']),
  // "dick" is also a name (Moby Dick), so only in phrases no title uses.
  ...combos(['dick'], ['against her', 'between her', 'inside her'])
];
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

// Fetish words that are only ever fetish words, and phrases for the rest. Not on their own: "vore"
// (Swedish for "would be"), "age play" (mixed-age play), "belly stuffing" (pork belly stuffing),
// "trampling" and "smothering" (news, recipes), "giantess" (Norse myths), "kink" (a kink in the neck).
const KINK_PHRASES = [
  'abdl', 'ddlg', 'paypig', 'feederism', 'feedee', 'ballbusting', 'shibari', '+rope bunny', '+chastity cage', '+tickle torture',
  ...combos(['foot', 'feet', 'sole', 'soles', 'boot', 'boots', 'heel', 'heels', 'toe', 'toes', 'armpit', 'sock', 'socks'], ['worship']),
  '+toe sucking', '+toes sucking', '+sucking toes', '+foot gagging', '+nylon feet', '+pantyhose feet',
  // Not feet or socks on their own: "dog licking feet" and "dog sniffing socks" are everyday searches.
  ...combos(['armpit', 'armpits', 'panty', 'panties'], ['sniffing', 'licking']),
  ...combos(['sniffing', 'licking'], ['armpits', 'panties']),
  // Exact, without repeated letters: "foot smoother" and "face smoother" are skincare products.
  ...['face', 'foot', 'feet', 'butt', 'booty', 'ass', 'boob', 'boobs'].flatMap(a => [`${a} smother`, `${a} smothering`]),
  ...combos(['mommy', 'daddy', 'choke', 'choking', 'breeding', 'praise', 'degradation', 'size', 'pet', 'foot', 'feet', 'primal',
    'brat', 'impact', 'pain'], ['kink']),
  ...combos(['giantess'], ['feet', 'foot', 'crush', 'crushing', 'vore', 'growth', 'shrink', 'shrunk', 'stomp', 'step', 'video', 'art']),
  ...combos(['vore'], ['art', 'animation', 'comic', 'comics', 'story', 'stories', 'video', 'videos', 'game', 'games']),
  ...combos(['soft', 'hard', 'same size', 'unbirth'], ['vore'])
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
      '~fap', '~jizz', '+step sis', ...BODY_ACTS, ...PHRASE_ACTS]
  },
  {
    id: 'kinks',
    title: 'Fetishes and kinks',
    about: 'Fetish and kink terms, like bdsm and bondage.',
    checked: true,
    words: ['~fetish', 'kinky', '~bdsm', 'bondage', '~femdom', 'findom', '~dominatrix', '~cuckold', 'spank',
      'spanking', '~voyeur', '~upskirt', '~down blouse', '~golden shower', '~feet pics', '~ahegao', '~futanari',
      '~ecchi', '~yaoi', '~milf', '~dilf', '~gilf', '~pawg', '~bbw', '+butt crush', '+butt crushing', ...KINK_PHRASES]
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
      '~ballsack', '~nutsack', '~twat', '~cunt', '~clit', '~coochie', '~punani', 'vag', 'belfie', ...BODY_SLANG]
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
      '+x reader', '+dark romance', '+reverse harem', '+book boyfriend', '+pixar mom', '+pixar mum', '+pixar mommy', '+gym girl', '+gym baddie', '+latex catsuit', '+latex outfit', '+leather catsuit',
      ...combos(GYM_GIRLS, ['body', 'physique', 'figure', 'legs'])]
  },
  {
    id: 'everyday',
    title: 'Words with everyday meanings too',
    about: 'Anatomy words and slang like sex, breasts, dick and “ahh” (slang for ass). Strong protection, but normal searches like “sex education”, “Moby Dick”, “paint stripper” or “goofy ahh” memes will close too.',
    checked: false,
    warn: true,
    words: ['~sex', 'ass', 'anal', '~cum', '~cock', '~dick', 'pussy', '~tits', 'penis', 'vagina', '~vulva',
      '~genitals', 'breasts', '~nipple', '~clitoris', 'erection', '~kink', '~pegging', 'stripper', '~ahh', 'humping']
  }
];

