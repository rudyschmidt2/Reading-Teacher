import { dragChunks, dragHold, dragWord, letterChoices, pics, speakItem, tap } from "./banks.ts";
import type {
  BandReport,
  BandStatus,
  Choice,
  DiagnosticProgress,
  DiagnosticReport,
  DiagnosticRow,
  GradeDimension,
  LessonItem,
  ModuleDef,
  PlacementItem,
  PlacementShelf,
  ScoutDraft,
  ScoutReport,
  Track,
  Vowel,
  Widget,
} from "./types";

/**
 * Detailed diagnostic: one band per rung of the ladder, several probes per
 * band, one skill "bit" per probe (a letter, a vowel, a digraph, a word...).
 * Every band ends with one speak probe (say the sound, name the letter, read
 * the word, read the line) graded through the same ear as a lesson. The kid
 * sees an adventure. The parent gets a map of exactly which bits are known,
 * shaky, or unknown, how fast the real hits came, and the path is built from
 * that map.
 */

export type Probe = PlacementItem & { band: string; bit: string };

export type Band = {
  id: string;
  title: string;
  kidEyebrow: string;
  teaches: string;
  bankModule?: string;
  dimensions: GradeDimension[];
  probes: Probe[];
  /** Lesson items that work on one bit of this band. */
  items: (bit: string) => LessonItem[];
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const VOWEL_SOUND: Record<Vowel, string> = { a: "/ă/", e: "/ĕ/", i: "/ĭ/", o: "/ŏ/", u: "/ŭ/" };
const VOWEL_WORD: Record<Vowel, string> = { a: "sat", e: "red", i: "pin", o: "hop", u: "mug" };

const soundOf = (letter: string) => (VOWELS.has(letter) ? VOWEL_SOUND[letter as Vowel] : `/${letter}/`);

/** Picture bank for first-sound probes, keyed by phoneme. No two share a first sound. */
const PICTURES: Record<string, [string, string][]> = {
  "/s/": [["sun", "☀️"], ["snake", "🐍"], ["sock", "🧦"]],
  "/m/": [["moon", "🌙"], ["map", "🗺️"], ["mug", "☕"]],
  "/t/": [["tiger", "🐯"], ["tap", "🚰"], ["tent", "⛺"]],
  "/p/": [["pig", "🐷"], ["pin", "📌"], ["pot", "🫕"]],
  "/n/": [["nest", "🪺"], ["net", "🥅"], ["nut", "🥜"]],
  "/ă/": [["apple", "🍎"], ["ant", "🐜"], ["ax", "🪓"]],
  "/d/": [["dog", "🐶"], ["duck", "🦆"], ["drum", "🥁"]],
  "/b/": [["bug", "🐛"], ["bed", "🛏️"], ["ball", "⚽"]],
  "/h/": [["hat", "🎩"], ["hen", "🐔"], ["horse", "🐴"]],
  "/c/": [["cup", "🥤"], ["cat", "🐱"], ["cow", "🐄"]],
};

function picChoices(target: string, foils: [string, string], variant = 0): Choice[] {
  const pick = (ph: string) => PICTURES[ph][variant % PICTURES[ph].length];
  return pics([target, ...foils].map((ph) => {
    const [word, emoji] = pick(ph);
    return [word, word, emoji];
  }));
}

function probe(
  id: string,
  band: string,
  bit: string,
  widget: Widget,
  prompt: string,
  choices: Choice[],
  correctId: string,
  dimension: GradeDimension,
  parentHint?: string,
): Probe {
  return { id, rung: band, band, bit, widget, prompt, choices, correctId, dimension, parentHint };
}

/**
 * One spoken probe. `print` is what the kid reads; the teacher only says the
 * prompt, never the answer. No print means the prompt itself carries the cue
 * ("the first sound in sun").
 */
function speakProbe(id: string, band: string, bit: string, prompt: string, target: string, print?: string, parentHint?: string): Probe {
  return {
    id,
    rung: band,
    band,
    bit,
    kind: "speak",
    widget: "say",
    prompt,
    choices: [],
    correctId: target,
    speakTarget: target,
    print,
    dimension: "speaking",
    parentHint,
  };
}

const WIDGETS: Widget[] = ["stamp", "smash", "feed", "ear"];
const widgetAt = (i: number) => WIDGETS[i % WIDGETS.length];

// ---------------------------------------------------------------------------
// Item makers shared by several bands
// ---------------------------------------------------------------------------

function firstSoundItems(prefix: string, phoneme: string, foils: [string, string]): LessonItem[] {
  const [word] = PICTURES[phoneme][1];
  return [
    tap(`${prefix}-pic1`, `Which one starts with ${phoneme}?`, picChoices(phoneme, foils, 0), PICTURES[phoneme][0][0], "phonemes", { widget: "ear", speakTarget: phoneme }),
    tap(`${prefix}-pic2`, `Listen: ${phoneme}. Who says ${phoneme}?`, picChoices(phoneme, foils, 1), word, "phonemes", { widget: "smash", speakTarget: phoneme }),
    speakItem(`${prefix}-say`, `Say the sound ${phoneme}.`, phoneme, "speaking"),
  ];
}

function letterNameItems(prefix: string, letter: string, decoys: string[]): LessonItem[] {
  return [
    tap(`${prefix}-stamp`, `Stamp ${letter}.`, letterChoices([letter, ...decoys]), letter, "letterRecognition", { widget: "stamp", letter, speakTarget: letter }),
    dragHold(`${prefix}-feed`, `Give me ${letter}.`, [letter, ...decoys.slice(0, 2)], letter, "letterRecognition"),
    tap(`${prefix}-trace`, `Trace ${letter} with your finger.`, letterChoices([letter, ...decoys]), letter, "letterRecognition", { widget: "trace", letter }),
    speakItem(`${prefix}-say`, `Say the name of ${letter}.`, letter, "speaking", { letter }),
  ];
}

function letterSoundItems(prefix: string, letter: string, decoys: string[]): LessonItem[] {
  const ph = soundOf(letter);
  const dim: GradeDimension = VOWELS.has(letter) ? "vowelPhonics" : "phonemes";
  return [
    tap(`${prefix}-ear`, `Which letter says ${ph}?`, letterChoices([letter, ...decoys]), letter, dim, { widget: "ear", letter, speakTarget: ph }),
    dragHold(`${prefix}-park`, `Park the letter that says ${ph}.`, [letter, ...decoys.slice(0, 2)], letter, dim),
    speakItem(`${prefix}-say`, `Say the sound of ${letter}.`, ph, "speaking", { letter }),
  ];
}

function vowelItems(prefix: string, vowel: Vowel): LessonItem[] {
  const word = VOWEL_WORD[vowel];
  const others = (["a", "e", "i", "o", "u"] as Vowel[]).filter((v) => v !== vowel);
  const foilVowel = others[0];
  return [
    tap(`${prefix}-ear`, `Which letter says ${VOWEL_SOUND[vowel]}?`, letterChoices([vowel, others[0], others[1]]), vowel, "vowelPhonics", { widget: "feed", letter: vowel, speakTarget: VOWEL_SOUND[vowel] }),
    tap(`${prefix}-mid`, `Make ${word}. Which vowel?`, letterChoices([vowel, others[2], others[3]]), vowel, "vowelPhonics", { word }),
    dragWord(`${prefix}-build`, word, [...word.split(""), foilVowel], vowel, word),
    speakItem(`${prefix}-say`, `Say ${word}.`, word, "speaking", { word }),
  ];
}

type WordBit = { word: string; foils: [string, string]; chunks?: string[]; extraTiles?: string[]; emoji?: string };

function readItems(prefix: string, w: WordBit, dimension: GradeDimension = "words"): LessonItem[] {
  const items: LessonItem[] = [
    tap(`${prefix}-find`, `Find ${w.word}.`, [{ id: w.word, label: w.word, emoji: w.emoji }, ...w.foils.map((f) => ({ id: f, label: f }))], w.word, dimension, { word: w.word, speakTarget: w.word }),
  ];
  if (w.chunks && w.chunks.length === 2) {
    items.push(dragChunks(`${prefix}-build`, w.word, w.chunks, w.extraTiles ?? [], `Build ${w.chunks.join("-")}. Two stalls.`));
  } else if (w.chunks) {
    const vowel = w.chunks.find((c) => c.length === 1 && VOWELS.has(c)) as Vowel | undefined;
    items.push(dragWord(`${prefix}-build`, w.word, [...w.chunks, ...(w.extraTiles ?? [])], vowel ?? "a", w.word, w.chunks));
  }
  items.push(speakItem(`${prefix}-say`, `Say ${w.word}.`, w.word, "speaking", { word: w.word }));
  return items;
}

// ---------------------------------------------------------------------------
// Track A — Riley / Hudson: the full phonics ladder
// ---------------------------------------------------------------------------

const A_FIRST_SOUNDS: { ph: string; foils: [string, string] }[] = [
  { ph: "/s/", foils: ["/m/", "/t/"] },
  { ph: "/m/", foils: ["/p/", "/ă/"] },
  { ph: "/t/", foils: ["/n/", "/p/"] },
  { ph: "/p/", foils: ["/s/", "/d/"] },
  { ph: "/n/", foils: ["/m/", "/b/"] },
  { ph: "/ă/", foils: ["/s/", "/c/"] },
];

const A_LETTER_NAMES: { letter: string; decoys: string[] }[] = [
  { letter: "s", decoys: ["a", "t", "m"] },
  { letter: "a", decoys: ["e", "o", "t"] },
  { letter: "t", decoys: ["f", "i", "s"] },
  { letter: "p", decoys: ["b", "d", "q"] },
  { letter: "i", decoys: ["l", "j", "a"] },
  { letter: "n", decoys: ["m", "h", "u"] },
  { letter: "b", decoys: ["d", "p", "h"] },
  { letter: "d", decoys: ["b", "p", "g"] },
];

const A_LETTER_SOUNDS: { letter: string; decoys: string[] }[] = [
  { letter: "s", decoys: ["z", "c", "t"] },
  { letter: "t", decoys: ["d", "p", "k"] },
  { letter: "p", decoys: ["b", "d", "t"] },
  { letter: "n", decoys: ["m", "h", "r"] },
  { letter: "m", decoys: ["n", "w", "b"] },
  { letter: "d", decoys: ["b", "t", "g"] },
  { letter: "h", decoys: ["n", "k", "f"] },
  { letter: "c", decoys: ["s", "g", "k"] },
];

const A_CVC: Record<Vowel, WordBit> = {
  a: { word: "sat", foils: ["sit", "set"], chunks: ["s", "a", "t"], extraTiles: ["i"], emoji: "💺" },
  e: { word: "red", foils: ["rod", "rid"], chunks: ["r", "e", "d"], extraTiles: ["a"], emoji: "🟥" },
  i: { word: "pin", foils: ["pan", "pen"], chunks: ["p", "i", "n"], extraTiles: ["a"], emoji: "📌" },
  o: { word: "hop", foils: ["hip", "hup"], chunks: ["h", "o", "p"], extraTiles: ["a"], emoji: "🐇" },
  u: { word: "mug", foils: ["mag", "mog"], chunks: ["m", "u", "g"], extraTiles: ["a"], emoji: "☕" },
};

const A_DIGRAPHS: Record<string, WordBit> = {
  sh: { word: "ship", foils: ["sip", "hip"], chunks: ["sh", "i", "p"], extraTiles: ["ch"], emoji: "🚢" },
  ch: { word: "chop", foils: ["shop", "hop"], chunks: ["ch", "o", "p"], extraTiles: ["sh"], emoji: "🥪" },
  th: { word: "thin", foils: ["tin", "pin"], chunks: ["th", "i", "n"], extraTiles: ["t"], emoji: "➖" },
  ck: { word: "duck", foils: ["dug", "dock"], chunks: ["d", "u", "ck"], extraTiles: ["k"], emoji: "🦆" },
};

const A_BLENDS: Record<string, WordBit> = {
  st: { word: "stop", foils: ["sop", "top"], chunks: ["st", "o", "p"], extraTiles: ["s"], emoji: "🛑" },
  bl: { word: "blot", foils: ["bot", "lot"], chunks: ["bl", "o", "t"], extraTiles: ["b"] },
  tr: { word: "trip", foils: ["tip", "rip"], chunks: ["tr", "i", "p"], extraTiles: ["t"], emoji: "👟" },
  sn: { word: "snap", foils: ["nap", "sap"], chunks: ["sn", "a", "p"], extraTiles: ["s"], emoji: "🫰" },
};

const A_HEART: Record<string, WordBit> = {
  the: { word: "the", foils: ["to", "a"] },
  to: { word: "to", foils: ["the", "I"] },
  and: { word: "and", foils: ["an", "at"] },
  is: { word: "is", foils: ["it", "in"] },
  I: { word: "I", foils: ["a", "it"] },
};

const A_SILENT_E: Record<string, WordBit> = {
  "a_e": { word: "made", foils: ["mad", "mid"], chunks: ["m", "a", "d", "e"], extraTiles: ["i"] },
  "i_e": { word: "like", foils: ["lick", "lake"], chunks: ["l", "i", "k", "e"], extraTiles: ["a"], emoji: "👍" },
  "o_e": { word: "hope", foils: ["hop", "hip"], chunks: ["h", "o", "p", "e"], extraTiles: ["a"] },
  "u_e": { word: "cute", foils: ["cut", "cat"], chunks: ["c", "u", "t", "e"], extraTiles: ["a"], emoji: "🐣" },
};

const A_TEAMS: Record<string, WordBit> = {
  ai: { word: "rain", foils: ["ran", "run"], chunks: ["r", "ai", "n"], extraTiles: ["ay"], emoji: "🌧️" },
  ay: { word: "day", foils: ["dad", "did"], chunks: ["d", "ay"], extraTiles: ["ai", "y"], emoji: "🌞" },
  ee: { word: "see", foils: ["sat", "set"], chunks: ["s", "ee"], extraTiles: ["ea", "e"], emoji: "👀" },
  oa: { word: "boat", foils: ["bat", "bit"], chunks: ["b", "oa", "t"], extraTiles: ["ow"], emoji: "⛵" },
};

const A_R: Record<string, WordBit> = {
  ar: { word: "car", foils: ["cat", "can"], chunks: ["c", "ar"], extraTiles: ["or", "t"], emoji: "🚗" },
  or: { word: "for", foils: ["far", "fur"], chunks: ["f", "or"], extraTiles: ["ar", "er"] },
  er: { word: "her", foils: ["hat", "hit"], chunks: ["h", "er"], extraTiles: ["ar", "ir"] },
};

const A_SYLLABLES: Record<string, WordBit> = {
  napkin: { word: "napkin", foils: ["nap", "kin"], chunks: ["nap", "kin"], extraTiles: ["sun", "set"] },
  basket: { word: "basket", foils: ["bat", "sit"], chunks: ["bas", "ket"], extraTiles: ["nap", "sun"], emoji: "🧺" },
  sunset: { word: "sunset", foils: ["sun", "set"], chunks: ["sun", "set"], extraTiles: ["nap", "kin"], emoji: "🌇" },
};

const A_ENDINGS: Record<string, WordBit> = {
  "-s": { word: "cats", foils: ["cat", "can"], emoji: "🐱" },
  "-ing": { word: "sitting", foils: ["sit", "sat"] },
  "-ed": { word: "jumped", foils: ["jump", "jam"] },
};

const A_SENTENCES: Record<string, WordBit> = {
  "I sit.": { word: "I sit.", foils: ["A pin.", "The man."] },
  "The ant sat.": { word: "The ant sat.", foils: ["I tap it.", "A pin."] },
  "I hop to the red mug.": { word: "I hop to the red mug.", foils: ["I sit.", "The ship sat."] },
};

function wordBand(
  id: string,
  title: string,
  kidEyebrow: string,
  teaches: string,
  bankModule: string,
  bits: Record<string, WordBit>,
  dimension: GradeDimension = "words",
  dimensions: GradeDimension[] = ["words", "speaking"],
): Band {
  const entries = Object.entries(bits);
  const [sayBit, sayWord] = entries[0];
  const line = dimension === "sentences";
  return {
    id,
    title,
    kidEyebrow,
    teaches,
    bankModule,
    dimensions,
    probes: [
      ...entries.map(([bit, w], i) =>
        probe(`DX-${id}-${i + 1}`, id, bit, widgetAt(i), `Find ${w.word}`.replace(/\.$/, "") + ".", [{ id: w.word, label: w.word }, ...w.foils.map((f) => ({ id: f, label: f }))], w.word, dimension),
      ),
      speakProbe(`DX-${id}-say`, id, sayBit, line ? "Read this line out loud." : "Read this word out loud.", sayWord.word.replace(/\.$/, ""), sayWord.word),
    ],
    items: (bit) => (bits[bit] ? readItems(`dx-${id}-${bit.replace(/[^a-z]/gi, "")}`, bits[bit], dimension) : []),
  };
}

export const BANDS_WORDS: Band[] = [
  {
    id: "first-sounds",
    title: "First sounds",
    kidEyebrow: "Sound hunt",
    teaches: "Hear the first sound in a word, no print",
    bankModule: "rh-sound-speed",
    dimensions: ["phonemes", "speaking"],
    probes: [
      ...A_FIRST_SOUNDS.map(({ ph, foils }, i) =>
        probe(`DX-fs-${i + 1}`, "first-sounds", ph, i % 2 ? "smash" : "ear", `Which one starts with ${ph}?`, picChoices(ph, foils, i % 3), PICTURES[ph][i % 3][0], "phonemes"),
      ),
      speakProbe("DX-fs-say", "first-sounds", "/s/", "Say just the first sound in sun.", "/s/", undefined, "sss, not the whole word"),
    ],
    items: (bit) => {
      const row = A_FIRST_SOUNDS.find((r) => r.ph === bit);
      return row ? firstSoundItems(`dx-fs-${bit.replace(/\//g, "")}`, bit, row.foils) : [];
    },
  },
  {
    id: "letter-names",
    title: "Letter names",
    kidEyebrow: "Letter hunt",
    teaches: "Name the letter on sight, lookalikes apart",
    bankModule: "rh-letters",
    dimensions: ["letterRecognition", "speaking"],
    probes: [
      ...A_LETTER_NAMES.map(({ letter, decoys }, i) =>
        probe(`DX-ln-${i + 1}`, "letter-names", letter, widgetAt(i), `${i % 2 ? "Find" : "Stamp"} ${letter}.`, letterChoices([letter, ...decoys]), letter, "letterRecognition"),
      ),
      speakProbe("DX-ln-say", "letter-names", "p", "What is this letter's name?", "p", "p"),
    ],
    items: (bit) => {
      const row = A_LETTER_NAMES.find((r) => r.letter === bit);
      return row ? letterNameItems(`dx-ln-${bit}`, bit, row.decoys) : [];
    },
  },
  {
    id: "letter-sounds",
    title: "Letter sounds",
    kidEyebrow: "Sound to letter",
    teaches: "Hear a sound, find the letter",
    bankModule: "rh-letters",
    dimensions: ["phonemes", "letterRecognition", "speaking"],
    probes: [
      ...A_LETTER_SOUNDS.map(({ letter, decoys }, i) =>
        probe(`DX-ls-${i + 1}`, "letter-sounds", letter, i % 2 ? "feed" : "ear", `Which letter says /${letter}/?`, letterChoices([letter, ...decoys]), letter, "phonemes"),
      ),
      speakProbe("DX-ls-say", "letter-sounds", "m", "What sound does this letter make?", "/m/", "m"),
    ],
    items: (bit) => {
      const row = A_LETTER_SOUNDS.find((r) => r.letter === bit);
      return row ? letterSoundItems(`dx-ls-${bit}`, bit, row.decoys) : [];
    },
  },
  {
    id: "short-vowels",
    title: "Short vowels",
    kidEyebrow: "Vowel faces",
    teaches: "The five short vowel sounds by face and letter",
    bankModule: "rh-vowel-contrast",
    dimensions: ["vowelPhonics", "words", "speaking"],
    probes: [
      ...(["a", "e", "i", "o", "u"] as Vowel[]).map((v, i) => {
        const others = (["a", "e", "i", "o", "u"] as Vowel[]).filter((x) => x !== v);
        return probe(`DX-sv-${i + 1}`, "short-vowels", v, i % 2 ? "feed" : "ear", `Which letter says ${VOWEL_SOUND[v]}?`, letterChoices([v, others[i % 4], others[(i + 2) % 4]]), v, "vowelPhonics", `short ${v}`);
      }),
      speakProbe("DX-sv-say", "short-vowels", "a", "What sound does this vowel make?", "/ă/", "a", "short a, apple"),
    ],
    items: (bit) => (VOWELS.has(bit) ? vowelItems(`dx-sv-${bit}`, bit as Vowel) : []),
  },
  wordBand("cvc", "CVC words", "Real words", "Blend three sounds into a word, every short vowel", "rh-cvc-smash", A_CVC, "words", ["words", "vowelPhonics", "speaking", "speed"]),
  wordBand("digraphs", "Digraphs", "Two letters, one sound", "sh, ch, th, ck", "rh-digraphs", A_DIGRAPHS, "words", ["words", "phonemes", "speaking", "speed"]),
  wordBand("blends", "Beginning blends", "Sound stacks", "st, bl, tr, sn", "rh-blends", A_BLENDS, "words", ["words", "phonemes", "speaking", "speed"]),
  wordBand("heart-words", "Heart words", "Heart words", "the, to, and, is, I on sight", "rh-heart", A_HEART),
  wordBand("silent-e", "Silent-e", "Magic e", "Long vowel with a quiet e", "rh-silent-e", A_SILENT_E, "words", ["words", "vowelPhonics", "speaking"]),
  wordBand("vowel-teams", "Vowel teams", "Vowel teams", "ai, ay, ee, oa", "rh-vowel-teams", A_TEAMS, "words", ["words", "vowelPhonics", "speaking"]),
  wordBand("r-controlled", "r-controlled", "Bossy r", "ar, or, er", "rh-r-controlled", A_R, "words", ["words", "vowelPhonics", "speaking"]),
  wordBand("syllables", "Two-syllable chunks", "Clap and read", "Read a word in two claps", "rh-two-syllable", A_SYLLABLES),
  wordBand("endings", "Endings", "Word tails", "-s, -ing, -ed", "rh-endings", A_ENDINGS),
  wordBand("sentences", "Sentences", "Read the line", "Decodable lines with taught patterns", "rh-sentences", A_SENTENCES, "sentences", ["sentences", "words", "speaking", "speed"]),
];

// ---------------------------------------------------------------------------
// Track B — Myles: letters and sounds only, three tiles, eight letters
// ---------------------------------------------------------------------------

const B_LETTERS = ["s", "a", "t", "p", "i", "n", "m", "o"];
const bDecoys = (letter: string) => B_LETTERS.filter((l) => l !== letter).slice(0, 2);

export const BANDS_LETTERS: Band[] = [
  {
    id: "my-names",
    title: "Letter names",
    kidEyebrow: "Letter hunt",
    teaches: "Eight letter names, three tiles",
    bankModule: "my-letter-names",
    dimensions: ["letterRecognition", "speaking"],
    probes: [
      ...B_LETTERS.map((letter, i) =>
        probe(`DX-mn-${i + 1}`, "my-names", letter, ["stamp", "smash", "feed"][i % 3] as Widget, `${["Stamp", "Find", "Give me"][i % 3]} ${letter}.`, letterChoices([letter, ...bDecoys(letter)]), letter, "letterRecognition"),
      ),
      speakProbe("DX-mn-say", "my-names", "s", "What is this letter's name?", "s", "s"),
    ],
    items: (bit) => (B_LETTERS.includes(bit) ? letterNameItems(`dx-mn-${bit}`, bit, bDecoys(bit)) : []),
  },
  {
    id: "my-sounds",
    title: "Letter sounds",
    kidEyebrow: "Which letter says",
    teaches: "Eight letter sounds, three tiles",
    bankModule: "my-letter-sounds",
    dimensions: ["phonemes", "speaking"],
    probes: [
      ...B_LETTERS.map((letter, i) =>
        probe(`DX-ms-${i + 1}`, "my-sounds", letter, i % 2 ? "feed" : "ear", `Which letter says ${soundOf(letter)}?`, letterChoices([letter, ...bDecoys(letter)]), letter, "phonemes"),
      ),
      speakProbe("DX-ms-say", "my-sounds", "s", "What sound does this letter make?", "/s/", "s"),
    ],
    items: (bit) => (B_LETTERS.includes(bit) ? letterSoundItems(`dx-ms-${bit}`, bit, bDecoys(bit)) : []),
  },
  {
    id: "my-first-sounds",
    title: "First sounds",
    kidEyebrow: "Sound hunt",
    teaches: "Hear the first sound in a picture word",
    bankModule: "my-find-it",
    dimensions: ["phonemes", "speaking"],
    probes: [
      ...A_FIRST_SOUNDS.slice(0, 4).map(({ ph, foils }, i) =>
        probe(`DX-mf-${i + 1}`, "my-first-sounds", ph, "ear", `Which one starts with ${ph}?`, picChoices(ph, foils, i % 3), PICTURES[ph][i % 3][0], "phonemes"),
      ),
      speakProbe("DX-mf-say", "my-first-sounds", "/s/", "Say just the first sound in sun.", "/s/", undefined, "sss, not the whole word"),
    ],
    items: (bit) => {
      const row = A_FIRST_SOUNDS.find((r) => r.ph === bit);
      return row ? firstSoundItems(`dx-mf-${bit.replace(/\//g, "")}`, bit, row.foils) : [];
    },
  },
];

export function bandsFor(track: Track): Band[] {
  return track === "letters" ? BANDS_LETTERS : BANDS_WORDS;
}

export function bandById(track: Track, id: string) {
  return bandsFor(track).find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Engine: adaptive, resumable
// ---------------------------------------------------------------------------

/** Probes answered in one sitting before the kid gets the done page. The map resumes next time. */
export const SITTING_CAP = 20;

export function startDiagnostic(track: Track, now = new Date()): DiagnosticProgress {
  return { track, rows: [], cursor: { band: 0, probe: 0 }, startedAt: now.toISOString() };
}

/** Pure stand-in for render: same shape as a fresh map, no clock. The store stamps the real start. */
export function emptyDiagnostic(track: Track): DiagnosticProgress {
  return { track, rows: [], cursor: { band: 0, probe: 0 }, startedAt: "" };
}

export function currentProbe(progress: DiagnosticProgress): Probe | undefined {
  if (!progress.cursor) return undefined;
  return bandsFor(progress.track)[progress.cursor.band]?.probes[progress.cursor.probe];
}

export function currentBand(progress: DiagnosticProgress): Band | undefined {
  if (!progress.cursor) return undefined;
  return bandsFor(progress.track)[progress.cursor.band];
}

/** Rows that count: a spoken answer still waiting for a parent ear is neither a hit nor a miss. */
const graded = (rows: DiagnosticRow[]) => rows.filter((r) => !r.pending);

/** Stop a band early on two misses in a row, or fewer than two hits in the first four. */
export function bandShouldStop(rows: DiagnosticRow[]) {
  const real = graded(rows);
  const last2 = real.slice(-2);
  if (last2.length === 2 && last2.every((r) => !r.ok)) return true;
  if (real.length >= 4 && real.filter((r) => r.ok).length < 2) return true;
  return false;
}

/**
 * Known needs 80% of the band's probes hit; pending spoken probes drop out of
 * the denominator so an ungraded ear never holds a band back. `total` defaults
 * to the whole band; a scout passes the number it actually asked.
 */
export function bandStatus(band: Band, rows: DiagnosticRow[], total = band.probes.length): BandStatus {
  if (rows.length === 0) return "not-reached";
  const real = graded(rows);
  if (real.length === 0) return "not-reached";
  const hits = real.filter((r) => r.ok).length;
  const denom = Math.max(1, total - (rows.length - real.length));
  if (hits >= Math.ceil(denom * 0.8) && (total < band.probes.length ? real.length >= 2 : true)) return "known";
  if (hits >= 2 || hits / real.length >= 0.5) return "shaky";
  return "unknown";
}

export type SpokenAnswer = { pending?: boolean; heard?: string };

export function answerProbe(
  progress: DiagnosticProgress,
  probe: Probe,
  ok: boolean,
  ms: number,
  now = new Date(),
  spoken?: SpokenAnswer,
): DiagnosticProgress {
  if (!progress.cursor) return progress;
  const bands = bandsFor(progress.track);
  const row: DiagnosticRow = { probeId: probe.id, band: probe.band, bit: probe.bit, ok: ok && !spoken?.pending, ms, at: now.toISOString() };
  if (probe.kind === "speak") row.kind = "speak";
  if (spoken?.pending) row.pending = true;
  if (spoken?.heard) row.heard = spoken.heard;
  const rows = [...progress.rows, row];
  const bi = progress.cursor.band;
  const band = bands[bi];
  const bandRows = rows.filter((r) => r.band === band.id);
  const ended = bandRows.length >= band.probes.length || bandShouldStop(bandRows);
  if (!ended) {
    return { ...progress, rows, cursor: { band: bi, probe: bandRows.length } };
  }
  const status = bandStatus(band, bandRows);
  const prev = bi > 0 ? bandStatus(bands[bi - 1], rows.filter((r) => r.band === bands[bi - 1].id)) : undefined;
  const finished = status === "unknown" || (status === "shaky" && prev === "shaky") || bi + 1 >= bands.length;
  if (finished) {
    return { ...progress, rows, cursor: null, finishedAt: now.toISOString() };
  }
  return { ...progress, rows, cursor: { band: bi + 1, probe: 0 } };
}

export function progressSummary(progress: DiagnosticProgress) {
  const bands = bandsFor(progress.track);
  const band = currentBand(progress);
  return {
    answered: progress.rows.length,
    hits: progress.rows.filter((r) => r.ok).length,
    bandIndex: progress.cursor?.band ?? bands.length,
    bandCount: bands.length,
    bandTitle: band?.title,
    finished: !progress.cursor,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/** Average ms over real tap hits. Spoken rows include the teacher talking, so they never count. */
export function speedMs(rows: DiagnosticRow[]): number | undefined {
  const timed = rows.filter((r) => r.ok && !r.pending && r.kind !== "speak" && r.ms > 0);
  return timed.length ? Math.round(timed.reduce((s, r) => s + r.ms, 0) / timed.length) : undefined;
}

function distinct(list: string[]) {
  return list.filter((x, i) => list.indexOf(x) === i);
}

/**
 * One report row per band. `scope: "map"` grades against the whole band;
 * `scope: "scout"` grades against what was asked, so a six-item tunnel can
 * still say known / shaky / unknown about the bands it touched.
 */
export function bandReportsFor(track: Track, allRows: DiagnosticRow[], scope: "map" | "scout" = "map"): BandReport[] {
  return bandsFor(track).map((band) => {
    const rows = allRows.filter((r) => r.band === band.id);
    const real = graded(rows);
    const speak = rows.filter((r) => r.kind === "speak");
    const missedBits = distinct(real.filter((r) => !r.ok).map((r) => r.bit));
    const report: BandReport = {
      id: band.id,
      title: band.title,
      status: bandStatus(band, rows, scope === "scout" ? rows.length : band.probes.length),
      hits: real.filter((r) => r.ok).length,
      answered: rows.length,
      total: scope === "scout" ? rows.length : band.probes.length,
      // A bit is known only when every graded probe on it hit.
      known: distinct(real.filter((r) => r.ok).map((r) => r.bit)).filter((bit) => !missedBits.includes(bit)),
      missed: missedBits,
    };
    const avg = speedMs(rows);
    if (avg !== undefined) report.avgMs = avg;
    if (speak.length) {
      report.speak = {
        hits: speak.filter((r) => r.ok && !r.pending).length,
        misses: speak.filter((r) => !r.ok && !r.pending).length,
        pending: speak.filter((r) => r.pending).length,
      };
    }
    return report;
  });
}

export function bandReports(progress: DiagnosticProgress): BandReport[] {
  return bandReportsFor(progress.track, progress.rows, "map");
}

/** Letters track: words may open once letter sounds and first sounds are both known. The parent still confirms. */
export function printWordsReady(track: Track, reports: BandReport[]): boolean {
  if (track !== "letters") return true;
  const status = (id: string) => reports.find((b) => b.id === id)?.status;
  return status("my-sounds") === "known" && status("my-first-sounds") === "known";
}

/** Parent graded a spoken placement answer later; the row stops being pending. */
export function regradeRow(progress: DiagnosticProgress, probeId: string, ok: boolean): DiagnosticProgress {
  if (!progress.rows.some((r) => r.probeId === probeId && r.pending)) return progress;
  return {
    ...progress,
    rows: progress.rows.map((r) => (r.probeId === probeId && r.pending ? { ...r, ok, pending: false } : r)),
  };
}

export function speedLine(ms?: number) {
  return ms === undefined ? undefined : `${(ms / 1000).toFixed(1)} s per hit`;
}

/**
 * One word, one meaning: the frontier is the first band that is not known
 * (shaky or unknown) — the same band `report.frontier` names and the desk and
 * grades pages show. Teaching starts there.
 */
function describeMap(reports: BandReport[], rows: DiagnosticRow[]) {
  const known = reports.filter((b) => b.status === "known").map((b) => b.title);
  const frontier = reports.find((b) => b.status === "shaky" || b.status === "unknown");
  const shaky = reports.filter((b) => b.status === "shaky" && b !== frontier);
  const unknown = reports.find((b) => b.status === "unknown" && b !== frontier);
  const parts: string[] = [];
  if (known.length) parts.push(`Known: ${known.join(", ")}.`);
  if (frontier) {
    const missed = frontier.missed.length ? `, missed ${frontier.missed.join(", ")}` : "";
    parts.push(`Frontier: ${frontier.title.toLowerCase()} (${frontier.status}, ${frontier.hits}/${frontier.answered}${missed}).`);
  }
  for (const b of shaky) parts.push(`Shaky ${b.title.toLowerCase()}: missed ${b.missed.join(", ")}.`);
  if (unknown) parts.push(`Stopped at ${unknown.title.toLowerCase()} (${unknown.hits}/${unknown.answered}).`);
  if (!known.length && !frontier) parts.push("No bands answered.");
  const speed = speedMs(rows);
  if (speed !== undefined) parts.push(`Speed: ${speedLine(speed)}.`);
  const pending = rows.filter((r) => r.pending).length;
  if (pending) parts.push(`${pending} spoken ${pending === 1 ? "answer waits" : "answers wait"} for your ear.`);
  return parts.join(" ");
}

export function shelfFor(track: Track, bands: BandReport[]): PlacementShelf {
  const status = (id: string) => bands.find((b) => b.id === id)?.status;
  if (track === "letters") {
    const names = status("my-names") === "known";
    const sounds = status("my-sounds") === "known";
    if (names && sounds) return "A3";
    if (names) return "A1";
    if (sounds) return "A2";
    return "A0";
  }
  const frontier = bands.find((b) => b.status !== "known")?.id;
  if (!frontier) return "C+";
  if (frontier === "first-sounds") return "S";
  if (frontier === "letter-names" || frontier === "letter-sounds" || frontier === "short-vowels") return "L";
  if (frontier === "cvc") return "C";
  return "C+";
}

// ---------------------------------------------------------------------------
// Build the path from the map
// ---------------------------------------------------------------------------

function targetedModule(kidId: string, band: Band, focus: string[], review: string[], stamp: string, prefix = "dx", title?: string): ModuleDef {
  const items: LessonItem[] = [];
  for (const bit of focus) items.push(...band.items(bit));
  for (const bit of review.slice(0, 2)) items.push(...band.items(bit).slice(0, 1));
  const seen = new Set<string>();
  const unique = items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true))).slice(0, 12);
  return {
    id: `${prefix}-${kidId}-${band.id}-${stamp}`,
    title: title || `${band.title}: ${focus.join(", ")}`,
    track: band.id.startsWith("my-") ? "letters" : "words",
    skill: band.teaches,
    stretch: "stretch-hard",
    dimensions: band.dimensions,
    items: unique.length
      ? unique
      : band.probes
          .filter((p) => p.kind !== "speak")
          .slice(0, 3)
          .map((p) => ({ ...p, kind: "tap" as const })),
    custom: true,
  };
}

/**
 * A practice module the parent asked for: this band's own item makers on the
 * bits they picked. Prefixed `pr-` so a fresh map (which replaces `dx-`
 * modules) leaves it alone.
 */
export function buildBandModule(kidId: string, track: Track, bandId: string, bits: string[], stamp = Date.now().toString(36), title?: string): ModuleDef | undefined {
  const band = bandById(track, bandId);
  if (!band) return undefined;
  const valid = bits.filter((b) => band.items(b).length > 0);
  const focus = valid.length ? valid : distinct(band.probes.map((p) => p.bit));
  return targetedModule(kidId, band, focus, [], stamp, "pr", title);
}

export type PracticePrefill = { title: string; skill: string; seeds: string; bandId: string; bits: string[] };

/** What "Practice these" drops into the Create-a-module form. */
export function practicePrefill(band: Band, bits: string[]): PracticePrefill {
  const picked = distinct(bits).filter((b) => band.items(b).length > 0);
  const use = picked.length ? picked : distinct(band.probes.map((p) => p.bit));
  return {
    title: `${band.title}: ${use.join(", ")}`,
    skill: band.teaches,
    seeds: use.join(", "),
    bandId: band.id,
    bits: use,
  };
}

/** Seeds typed into the form, back to band bits. Accepts `sh, ck` or one per line. */
export function seedsToBits(seeds: string): string[] {
  return distinct(
    seeds
      .split(/[,|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export type BuiltPath = {
  path: string[];
  modules: ModuleDef[];
  passed: string[];
  built: DiagnosticReport["built"];
};

export function buildPath(kidId: string, progress: DiagnosticProgress, reports: BandReport[], stamp = Date.now().toString(36)): BuiltPath {
  const bands = bandsFor(progress.track);
  const path: string[] = [];
  const modules: ModuleDef[] = [];
  const passed: string[] = [];
  const built: DiagnosticReport["built"] = [];
  const push = (id: string) => {
    if (!path.includes(id)) path.push(id);
  };

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const r = reports[i];
    if (r.status === "known") {
      if (band.bankModule && !path.includes(band.bankModule) && !passed.includes(band.bankModule)) passed.push(band.bankModule);
      continue;
    }
    if (r.status === "shaky") {
      const mod = targetedModule(kidId, band, r.missed, r.known, stamp);
      modules.push(mod);
      push(mod.id);
      built.push({ moduleId: mod.id, title: mod.title, why: `Shaky: missed ${r.missed.join(", ")} (${r.hits}/${r.answered}).` });
      if (band.bankModule) push(band.bankModule);
      continue;
    }
    if (r.status === "unknown") {
      if (band.bankModule) push(band.bankModule);
      const allBits = distinct(band.probes.map((p) => p.bit));
      const mod = targetedModule(kidId, band, allBits.filter((b) => !r.known.includes(b)), r.known, stamp);
      modules.push(mod);
      push(mod.id);
      built.push({ moduleId: mod.id, title: mod.title, why: `Frontier: ${r.hits}/${r.answered} here. Teach the whole band.` });
      const next = bands[i + 1];
      if (next?.bankModule) push(next.bankModule);
      break;
    }
    break;
  }

  if (path.length === 0) {
    const last = bands[bands.length - 1];
    if (last.bankModule) push(last.bankModule);
    if (progress.track === "letters") push("my-air-trace");
  }

  // A bank module shared by two bands (rh-letters) only counts as passed when
  // no band still needs it on the path.
  return { path, modules, passed: passed.filter((id) => !path.includes(id)), built };
}

const frontierOf = (reports: BandReport[]) => reports.find((b) => b.status !== "known" && b.status !== "not-reached")?.id;

export function finishDiagnostic(kidId: string, progress: DiagnosticProgress, stamp?: string): { report: DiagnosticReport; built: BuiltPath } {
  const reports = bandReports(progress);
  const builtPath = buildPath(kidId, progress, reports, stamp);
  const report: DiagnosticReport = {
    track: progress.track,
    at: progress.finishedAt ?? new Date().toISOString(),
    bands: reports,
    frontier: frontierOf(reports),
    shelf: shelfFor(progress.track, reports),
    note: describeMap(reports, progress.rows),
    pathNote: `Built ${builtPath.modules.length} targeted module${builtPath.modules.length === 1 ? "" : "s"}; ${builtPath.passed.length} bank module${builtPath.passed.length === 1 ? "" : "s"} marked passed.`,
    kidLine: progress.track === "letters" ? "You beamed up every letter on the map!" : "You scouted the whole map!",
    built: builtPath.built,
    speedMs: speedMs(progress.rows),
    readyForPrintWords: progress.track === "letters" ? printWordsReady("letters", reports) : undefined,
  };
  return { report, built: builtPath };
}

/**
 * Same map, re-read after a parent graded a spoken answer. Bands, shelf,
 * frontier, speed, and the readiness flag move; what was built and the path
 * do not — the parent owns path changes.
 */
export function refreshReport(report: DiagnosticReport, progress: DiagnosticProgress): DiagnosticReport {
  const reports = bandReports(progress);
  return {
    ...report,
    bands: reports,
    frontier: frontierOf(reports),
    shelf: shelfFor(progress.track, reports),
    note: describeMap(reports, progress.rows),
    speedMs: speedMs(progress.rows),
    readyForPrintWords: progress.track === "letters" ? printWordsReady("letters", reports) : report.readyForPrintWords,
  };
}

/** Bands a module stands for: its bank module, or a map / practice module built from it for this kid. */
export function bandsForModule(track: Track, moduleId: string, kidId: string): Band[] {
  return bandsFor(track).filter(
    (b) => b.bankModule === moduleId || moduleId.startsWith(`dx-${kidId}-${b.id}-`) || moduleId.startsWith(`pr-${kidId}-${b.id}-`),
  );
}

export type StartHere = {
  path: string[];
  modules: ModuleDef[];
  /** Bank modules of the bands before the start, marked passed. */
  passed: string[];
  /** Everything now on the path; any earlier pass verdict on these is cleared. */
  unpassed: string[];
};

/**
 * The parent picked a band to begin at. Every earlier band's bank module is
 * marked passed (unless a later band shares it), the path restarts at this
 * band's bank module — plus a targeted module on its missed bits, when the map
 * has any — and climbs the rest of the ladder. Modules the parent made by hand
 * stay on the path, after the ladder.
 */
export function startHere(
  kidId: string,
  track: Track,
  reports: BandReport[],
  bandId: string,
  currentPath: string[],
  stamp = Date.now().toString(36),
): StartHere | undefined {
  const bands = bandsFor(track);
  const idx = bands.findIndex((b) => b.id === bandId);
  if (idx === -1) return undefined;
  const later = new Set(bands.slice(idx).map((b) => b.bankModule).filter(Boolean) as string[]);
  const passed = distinct(bands.slice(0, idx).map((b) => b.bankModule).filter((id): id is string => Boolean(id) && !later.has(id as string)));
  const path: string[] = [];
  const modules: ModuleDef[] = [];
  const push = (id?: string) => {
    if (id && !path.includes(id)) path.push(id);
  };
  const start = bands[idx];
  push(start.bankModule);
  const report = reports.find((b) => b.id === start.id);
  if (report && report.missed.length) {
    const mod = targetedModule(kidId, start, report.missed, report.known, stamp, "dx");
    modules.push(mod);
    push(mod.id);
  }
  for (const band of bands.slice(idx + 1)) push(band.bankModule);
  if (track === "letters") push("my-air-trace");
  const bankIds = new Set(bands.map((b) => b.bankModule));
  for (const id of currentPath) {
    if (!bankIds.has(id) && !id.startsWith(`dx-${kidId}-`) && id !== "my-air-trace") push(id);
  }
  return { path, modules, passed, unpassed: [...path] };
}

// ---------------------------------------------------------------------------
// Scout: the same engine over a secret-tunnel sitting
// ---------------------------------------------------------------------------

const HEART = new Set(["the", "to", "and", "is", "i", "a"]);

/** Which word-ladder band a word belongs to, and the bit the band's item makers understand. */
export function classifyWord(raw: string): { band: string; bit: string } {
  const word = raw.trim();
  const w = word.toLowerCase().replace(/[^a-z ]/g, "");
  if (w.includes(" ")) return { band: "sentences", bit: word };
  if (HEART.has(w)) return { band: "heart-words", bit: w === "i" ? "I" : w };
  if (/ing$/.test(w) && w.length > 4) return { band: "endings", bit: "-ing" };
  if (/ed$/.test(w) && w.length > 4) return { band: "endings", bit: "-ed" };
  if (/[^s]s$/.test(w) && w.length >= 4) return { band: "endings", bit: "-s" };
  if (w.length >= 6) return { band: "syllables", bit: w };
  const team = w.match(/(ai|ay|ee|oa)/);
  if (team) return { band: "vowel-teams", bit: team[1] };
  const r = w.match(/(ar|or|er)/);
  if (r) return { band: "r-controlled", bit: r[1] };
  const cvce = w.match(/^[^aeiou]+([aeiou])[^aeiou]+e$/);
  if (cvce) return { band: "silent-e", bit: `${cvce[1]}_e` };
  const dig = w.match(/(sh|ch|th|ck)/);
  if (dig) return { band: "digraphs", bit: dig[1] };
  if (/^[^aeiou]{2}/.test(w)) return { band: "blends", bit: w.slice(0, 2) };
  const vowel = w.match(/[aeiou]/)?.[0] ?? "a";
  return { band: "cvc", bit: vowel };
}

/** Where one lesson item lands on the skills map. */
export function bandBitForItem(track: Track, item: LessonItem): { band: string; bit: string } {
  const letter = item.letter ?? (item.correctId && item.correctId.length === 1 ? item.correctId : undefined);
  const word = item.word ?? item.speakTarget ?? item.correctId ?? "";
  if (track === "letters") {
    if (item.dimension === "letterRecognition") return { band: "my-names", bit: letter ?? word };
    if (letter) return { band: item.kind === "speak" && /name/i.test(item.prompt) ? "my-names" : "my-sounds", bit: letter };
    return { band: "my-first-sounds", bit: word };
  }
  if (item.dimension === "sentences") return { band: "sentences", bit: word };
  if (item.dimension === "letterRecognition") return { band: "letter-names", bit: letter ?? word };
  if (item.dimension === "vowelPhonics") {
    const v = letter ?? item.word?.match(/[aeiou]/)?.[0] ?? "a";
    return { band: "short-vowels", bit: v };
  }
  if (item.dimension === "phonemes") {
    if (letter) return { band: "letter-sounds", bit: letter };
    return { band: "first-sounds", bit: word };
  }
  if (item.dimension === "speaking" && letter && !item.word) {
    return { band: /name/i.test(item.prompt) ? "letter-names" : "letter-sounds", bit: letter };
  }
  return classifyWord(word);
}

export type ScoutRow = { item: LessonItem; ok: boolean; ms: number; pending?: boolean; heard?: string };

/** Turn one scout sitting into a real report: bands touched, ceiling, floor, drafts from the missed bits. */
export function scoutReportFrom(kidId: string, track: Track, answers: ScoutRow[], now = new Date()): ScoutReport {
  const rows: DiagnosticRow[] = answers.map((a) => {
    const where = bandBitForItem(track, a.item);
    const row: DiagnosticRow = { probeId: a.item.id, band: where.band, bit: where.bit, ok: a.ok && !a.pending, ms: a.ms, at: now.toISOString() };
    if (a.item.kind === "speak") row.kind = "speak";
    if (a.pending) row.pending = true;
    if (a.heard) row.heard = a.heard;
    return row;
  });
  const reports = bandReportsFor(track, rows, "scout");
  const touched = reports.filter((b) => b.answered > 0);
  const knownBands = touched.filter((b) => b.status === "known");
  const weak = touched.filter((b) => b.status === "shaky" || b.status === "unknown");
  const bands = bandsFor(track);
  const drafts: ScoutDraft[] = weak
    .filter((b) => b.missed.length)
    .map((b) => {
      const band = bands.find((x) => x.id === b.id)!;
      return {
        title: `${band.title}: ${b.missed.join(", ")}`,
        skill: band.teaches,
        seeds: b.missed.join(", "),
        stretch: "stretch-hard" as const,
        bandId: band.id,
        bits: b.missed,
      };
    });
  return {
    kidId,
    pack: track === "letters" ? "MY-1" : "RH-1",
    ceiling: knownBands.length ? knownBands[knownBands.length - 1].title : "none yet",
    floor: weak.length ? weak[0].title : "none found",
    bands: touched.map((b) => ({
      id: b.id,
      name: b.title,
      tag: b.status === "known" ? "known" : b.status === "shaky" ? "shaky" : "unknown",
      hits: b.hits,
      answered: b.answered,
      missed: b.missed,
    })),
    drafts,
    readyForPrintWords: track === "letters" ? printWordsReady("letters", reports) : undefined,
    status: "pending",
    at: now.toISOString(),
    answered: rows.length,
    hits: rows.filter((r) => r.ok).length,
  };
}

export const PAUSED_KID_LINE = "Map saved. More scouting next time!";
