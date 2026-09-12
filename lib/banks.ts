import type { GradeDimension, LessonItem, ModuleDef, PlacementItem, Vowel } from "./types";

function letterChoices(letters: string[]) {
  return letters.map((l) => ({ id: l, label: l }));
}

function pics(rows: [string, string, string][]) {
  return rows.map(([id, label, emoji]) => ({ id, label, emoji }));
}

function tap(
  id: string,
  prompt: string,
  choices: { id: string; label: string; emoji?: string }[],
  hit: string,
  dimension: GradeDimension,
  extra: Partial<LessonItem> = {},
): LessonItem {
  return { id, kind: "tap", widget: extra.widget ?? "smash", prompt, dimension, choices, correctId: hit, ...extra };
}

function speakItem(id: string, prompt: string, target: string, dimension: GradeDimension, extra: Partial<LessonItem> = {}): LessonItem {
  return { id, kind: "speak", widget: "say", prompt, dimension, speakTarget: target, ...extra };
}

function dragWord(id: string, word: string, tiles: string[], vowel: Vowel, speak: string, parts?: string[]): LessonItem {
  const letters = parts ?? word.replace(/[^a-z]/g, "").split("");
  const vowelSet = new Set(["a", "e", "i", "o", "u"]);
  return {
    id,
    kind: "drag",
    widget: "drag",
    prompt: `Build ${word}. Then say it.`,
    dimension: "words",
    word,
    speakTarget: speak,
    tiles: tiles.map((t) =>
      vowelSet.has(t) && t.length === 1
        ? { id: `v-${t}`, kind: "vowel" as const, label: t, vowel: t as Vowel, phoneme: `/${t}/` }
        : { id: `l-${t}`, kind: "letter" as const, label: t },
    ),
    slots: letters.map((ch, i) => ({
      id: `${id}-s${i}`,
      accepts: vowelSet.has(ch) ? (["vowel"] as const) : (["letter"] as const),
      correctTileId: vowelSet.has(ch) ? `v-${ch}` : `l-${ch}`,
      glowVowel: i === 1 && vowelSet.has(ch) ? (ch as Vowel) : undefined,
    })),
  };
}

function dragHold(id: string, prompt: string, tiles: string[], hit: string, dimension: GradeDimension): LessonItem {
  const vowelSet = new Set(["a", "e", "i", "o", "u"]);
  return {
    id,
    kind: "drag",
    widget: "feed",
    prompt,
    dimension,
    letter: hit,
    tiles: tiles.map((t) =>
      t.startsWith("/")
        ? { id: `s-${t}`, kind: "sound" as const, label: t, phoneme: t }
        : vowelSet.has(t)
          ? { id: `v-${t}`, kind: "vowel" as const, label: t, vowel: t as Vowel }
          : { id: `l-${t}`, kind: "letter" as const, label: t },
    ),
    slots: [
      {
        id: `${id}-hold`,
        accepts: tiles.some((t) => t.startsWith("/")) ? ["sound"] : ["letter", "vowel"],
        correctTileId: hit.startsWith("/") ? `s-${hit}` : vowelSet.has(hit) ? `v-${hit}` : `l-${hit}`,
        glowVowel: vowelSet.has(hit) ? (hit as Vowel) : undefined,
      },
    ],
    speakTarget: hit,
  };
}

export const PLACEMENT_A_SOUNDS: PlacementItem[] = [
  { id: "S1", rung: "sounds", widget: "ear", prompt: "Which one starts with /s/?", choices: pics([["sun", "sun", "☀️"], ["map", "map", "🗺️"], ["tap", "tap", "🚰"]]), correctId: "sun", dimension: "phonemes" },
  { id: "S2", rung: "sounds", widget: "ear", prompt: "Which one starts with /m/?", choices: pics([["moon", "moon", "🌙"], ["pin", "pin", "📌"], ["ant", "ant", "🐜"]]), correctId: "moon", dimension: "phonemes" },
  { id: "S3", rung: "sounds", widget: "smash", prompt: "Which one starts with /t/?", choices: pics([["tiger", "tiger", "🐯"], ["nest", "nest", "🪺"], ["pig", "pig", "🐷"]]), correctId: "tiger", dimension: "phonemes" },
  { id: "S4", rung: "sounds", widget: "ear", prompt: "Listen: /s/. Who says /s/?", choices: pics([["snake", "snake", "🐍"], ["dog", "dog", "🐶"], ["cup", "cup", "🥤"]]), correctId: "snake", dimension: "phonemes" },
];

export const PLACEMENT_A_LETTERS: PlacementItem[] = [
  { id: "L1", rung: "letters", widget: "stamp", prompt: "Stamp the letter s.", choices: letterChoices(["s", "a", "t", "m"]), correctId: "s", dimension: "letterRecognition" },
  { id: "L2", rung: "letters", widget: "feed", prompt: "Which letter says /ă/?", parentHint: "short a, apple", choices: letterChoices(["a", "i", "n", "p"]), correctId: "a", dimension: "vowelPhonics" },
  { id: "L3", rung: "letters", widget: "smash", prompt: "Find t.", choices: letterChoices(["t", "p", "n", "s"]), correctId: "t", dimension: "letterRecognition" },
  { id: "L4", rung: "letters", widget: "ear", prompt: "Which letter says /m/?", choices: letterChoices(["m", "s", "i", "p"]), correctId: "m", dimension: "phonemes" },
  { id: "L5", rung: "letters", widget: "stamp", prompt: "Stamp the letter p.", choices: letterChoices(["p", "t", "a", "n"]), correctId: "p", dimension: "letterRecognition" },
  { id: "L6", rung: "letters", widget: "feed", prompt: "Which letter says /ĭ/?", parentHint: "short i, igloo", choices: letterChoices(["i", "a", "n", "s"]), correctId: "i", dimension: "vowelPhonics" },
];

export const PLACEMENT_A_CVC: PlacementItem[] = [
  { id: "C1", rung: "cvc", widget: "ear", prompt: "/s/ /ă/ /t/ … what word?", choices: pics([["sat", "sat", "💺"], ["pin", "pin", "📌"], ["man", "man", "🧑"]]), correctId: "sat", dimension: "words" },
  { id: "C2", rung: "cvc", widget: "smash", prompt: "p-i-n. What is it?", choices: pics([["pin", "pin", "📌"], ["pan", "pan", "🍳"], ["sit", "sit", "🪑"]]), correctId: "pin", dimension: "words" },
  { id: "C3", rung: "cvc", widget: "feed", prompt: "Tap the word I say: tap.", choices: pics([["tap", "tap", "🚰"], ["man", "man", "🧑"], ["sit", "sit", "🪑"]]), correctId: "tap", dimension: "words" },
  { id: "C4", rung: "cvc", widget: "stamp", prompt: "m-a-n. What is it?", choices: pics([["man", "man", "🧑"], ["mat", "mat", "🟩"], ["pin", "pin", "📌"]]), correctId: "man", dimension: "words" },
];

export const PLACEMENT_B_NAMES: PlacementItem[] = [
  { id: "M1", rung: "names", widget: "stamp", prompt: "Stamp s.", choices: letterChoices(["s", "t", "m"]), correctId: "s", dimension: "letterRecognition" },
  { id: "M2", rung: "names", widget: "smash", prompt: "Find a.", choices: letterChoices(["a", "o", "t"]), correctId: "a", dimension: "letterRecognition" },
  { id: "M3", rung: "names", widget: "feed", prompt: "Give me m.", choices: letterChoices(["m", "s", "p"]), correctId: "m", dimension: "letterRecognition" },
  { id: "M4", rung: "names", widget: "stamp", prompt: "Stamp t.", choices: letterChoices(["t", "i", "n"]), correctId: "t", dimension: "letterRecognition" },
];

export const PLACEMENT_B_SOUNDS: PlacementItem[] = [
  { id: "M5", rung: "letter-sounds", widget: "ear", prompt: "Which letter says /s/?", choices: letterChoices(["s", "a", "m"]), correctId: "s", dimension: "phonemes" },
  { id: "M6", rung: "letter-sounds", widget: "feed", prompt: "Which letter says /m/?", choices: letterChoices(["m", "t", "p"]), correctId: "m", dimension: "phonemes" },
  { id: "M7", rung: "letter-sounds", widget: "smash", prompt: "Which letter says /t/?", choices: letterChoices(["t", "i", "n"]), correctId: "t", dimension: "phonemes" },
  { id: "M8", rung: "letter-sounds", widget: "ear", prompt: "Which letter says /ă/?", parentHint: "short a, apple", choices: letterChoices(["a", "o", "s"]), correctId: "a", dimension: "phonemes" },
];

export const BANK_MODULES: ModuleDef[] = [
  {
    id: "rh-sound-speed",
    title: "Sound speed",
    track: "words",
    skill: "SATPIN sounds, no blend",
    stretch: "stretch-hard",
    dimensions: ["phonemes", "letterRecognition", "vowelPhonics", "speaking", "speed"],
    items: [
      tap("SS-01", "Stamp the one that says /s/.", letterChoices(["s", "a", "t"]), "s", "phonemes", { widget: "stamp", speakTarget: "/s/" }),
      tap("SS-02", "Which one says /ă/?", letterChoices(["a", "i", "p"]), "a", "vowelPhonics", { widget: "feed", speakTarget: "/ă/" }),
      tap("SS-03", "Find /t/.", letterChoices(["t", "p", "n"]), "t", "phonemes", { speakTarget: "/t/" }),
      tap("SS-04", "Stamp /p/.", letterChoices(["p", "t", "s"]), "p", "phonemes", { widget: "stamp" }),
      tap("SS-05", "Which one says /ĭ/?", letterChoices(["i", "a", "n"]), "i", "vowelPhonics", { widget: "feed" }),
      tap("SS-06", "Find /n/.", letterChoices(["n", "m", "s"]), "n", "phonemes"),
      dragHold("SS-07", "Park /s/ on the letter s.", ["/s/", "/t/", "/p/"], "/s/", "phonemes"),
      speakItem("SS-09", "Say the sound of t.", "/t/", "speaking", { letter: "t" }),
      speakItem("SS-10", "Say the sound of a.", "/ă/", "speaking", { letter: "a" }),
    ],
  },
  {
    id: "rh-letters",
    title: "Letter names and sounds",
    track: "words",
    skill: "SATPIN+M print",
    stretch: "stretch-hard",
    dimensions: ["letterRecognition", "phonemes", "vowelPhonics", "speaking"],
    items: [
      tap("L1-daily", "Stamp s.", letterChoices(["s", "a", "t", "m"]), "s", "letterRecognition", { widget: "stamp" }),
      tap("L2-daily", "Which letter says /ă/?", letterChoices(["a", "i", "n", "p"]), "a", "vowelPhonics", { widget: "feed" }),
      dragHold("D-s1", "Park the letter that says /s/.", ["s", "a", "t"], "s", "letterRecognition"),
      speakItem("SPK-01", "Say the sound of s.", "/s/", "speaking"),
    ],
  },
  {
    id: "rh-cvc-smash",
    title: "CVC smash",
    track: "words",
    skill: "sat, pin, hop, mug, red",
    stretch: "stretch-hard",
    dimensions: ["words", "vowelPhonics", "phonemes", "speaking", "speed"],
    items: [
      tap("CVC-01-smash", "Find sat.", [{ id: "sat", label: "sat" }, { id: "pin", label: "pin" }, { id: "hop", label: "hop" }], "sat", "words", { word: "sat" }),
      dragWord("CVC-01", "sat", ["s", "a", "t", "p"], "a", "sat"),
      speakItem("SPK-07", "Say sat.", "sat", "speaking", { word: "sat" }),
      dragWord("CVC-05", "pin", ["p", "i", "n", "t"], "i", "pin"),
      speakItem("SPK-08", "Say pin.", "pin", "speaking", { word: "pin" }),
      dragWord("CVC-20", "hop", ["h", "o", "p", "a"], "o", "hop"),
      dragWord("CVC-23", "mug", ["m", "u", "g", "a"], "u", "mug"),
      dragWord("CVC-26", "red", ["r", "e", "d", "a"], "e", "red"),
      speakItem("SPK-09", "Say hop.", "hop", "speaking", { word: "hop" }),
    ],
  },
  {
    id: "rh-vowel-contrast",
    title: "Short-vowel contrast",
    track: "words",
    skill: "a / i / o in the middle",
    stretch: "stretch-hard",
    dimensions: ["vowelPhonics", "words", "speaking"],
    items: [
      tap("VOW-01", "Make sat. Which vowel?", letterChoices(["a", "i", "o"]), "a", "vowelPhonics", { word: "sat" }),
      tap("VOW-02", "Make sit. Which vowel?", letterChoices(["a", "i"]), "i", "vowelPhonics", { word: "sit" }),
      dragWord("CVC-02", "sit", ["s", "i", "t", "a"], "i", "sit"),
      tap("VOW-04", "Make top. Which vowel?", letterChoices(["a", "i", "o"]), "o", "vowelPhonics", { word: "top" }),
      speakItem("VOW-09", "Say this sound. Point a.", "/ă/", "speaking"),
    ],
  },
  {
    id: "rh-digraphs",
    title: "Digraphs",
    track: "words",
    skill: "sh ch th ck",
    stretch: "stretch-hard",
    dimensions: ["words", "phonemes", "speaking", "speed"],
    items: [
      tap("DIG-01-read", "What word?", [{ id: "ship", label: "ship" }, { id: "sip", label: "sip" }, { id: "hip", label: "hip" }], "ship", "words", { word: "ship" }),
      dragWord("DIG-01", "ship", ["sh", "i", "p", "ch"], "i", "ship", ["sh", "i", "p"]),
      tap("DIG-03-read", "What word?", [{ id: "chop", label: "chop" }, { id: "shop", label: "shop" }, { id: "hop", label: "hop" }], "chop", "words"),
      tap("DIG-05-read", "What word?", [{ id: "thin", label: "thin" }, { id: "tin", label: "tin" }, { id: "pin", label: "pin" }], "thin", "words"),
      tap("DIG-07-read", "What word?", [{ id: "duck", label: "duck" }, { id: "dug", label: "dug" }, { id: "dock", label: "dock" }], "duck", "words"),
      speakItem("DIG-10", "Say chop.", "chop", "speaking", { word: "chop" }),
    ],
  },
  {
    id: "rh-blends",
    title: "Beginning blends",
    track: "words",
    skill: "st bl tr sn",
    stretch: "stretch-hard",
    dimensions: ["words", "phonemes", "speaking", "speed"],
    items: [
      tap("BLD-01-read", "What word?", [{ id: "stop", label: "stop" }, { id: "sop", label: "sop" }, { id: "top", label: "top" }], "stop", "words"),
      dragWord("BLD-01", "stop", ["st", "o", "p", "s"], "o", "stop", ["st", "o", "p"]),
      tap("BLD-03-read", "What word?", [{ id: "blot", label: "blot" }, { id: "bot", label: "bot" }, { id: "lot", label: "lot" }], "blot", "words"),
      tap("BLD-04-read", "What word?", [{ id: "trip", label: "trip" }, { id: "tip", label: "tip" }, { id: "rip", label: "rip" }], "trip", "words"),
      speakItem("BLD-08", "Say stop.", "stop", "speaking", { word: "stop" }),
    ],
  },
  {
    id: "rh-heart",
    title: "Tiny heart set",
    track: "words",
    skill: "the, I, a, to",
    stretch: "stretch-hard",
    dimensions: ["words", "speaking"],
    items: [
      tap("HRT-01", "This word is I. Smash I.", [{ id: "I", label: "I" }, { id: "a", label: "a" }, { id: "to", label: "to" }], "I", "words"),
      tap("HRT-02", "Smash a. The word, not the sound.", [{ id: "a", label: "a" }, { id: "I", label: "I" }, { id: "the", label: "the" }], "a", "words"),
      tap("HRT-03", "Smash the.", [{ id: "the", label: "the" }, { id: "to", label: "to" }, { id: "a", label: "a" }], "the", "words"),
      tap("HRT-04", "Smash to.", [{ id: "to", label: "to" }, { id: "the", label: "the" }, { id: "I", label: "I" }], "to", "words"),
      tap("HRT-05", "Make: I sat.", [{ id: "I sat.", label: "I sat." }, { id: "A pin.", label: "A pin." }, { id: "The ant.", label: "The ant." }], "I sat.", "sentences"),
    ],
  },
  {
    id: "rh-sentences",
    title: "Decodable sentences",
    track: "words",
    skill: "Taught-pattern lines",
    stretch: "stretch-hard",
    dimensions: ["sentences", "words", "speaking", "speed"],
    items: [
      tap("SEN-01", "Find: I sit.", [{ id: "I sit.", label: "I sit." }, { id: "A pin.", label: "A pin." }, { id: "The man.", label: "The man." }], "I sit.", "sentences"),
      speakItem("SEN-01-say", "Say: I sit.", "I sit", "speaking"),
      tap("SEN-03", "Find: The ant sat.", [{ id: "The ant sat.", label: "The ant sat." }, { id: "I tap it.", label: "I tap it." }, { id: "A pin.", label: "A pin." }], "The ant sat.", "sentences"),
      tap("SEN-12", "Find: I hop to the red mug.", [{ id: "I hop to the red mug.", label: "I hop to the red mug." }, { id: "I sit.", label: "I sit." }, { id: "The ship sat.", label: "The ship sat." }], "I hop to the red mug.", "sentences"),
    ],
  },
  {
    id: "rh-silent-e",
    title: "Silent-e",
    track: "words",
    skill: "made, like, hope, cute",
    stretch: "stretch-hard",
    dimensions: ["words", "vowelPhonics", "speaking"],
    items: [
      tap("CVE-01-read", "What word?", [{ id: "made", label: "made" }, { id: "mad", label: "mad" }, { id: "mid", label: "mid" }], "made", "words"),
      tap("CVE-03-read", "What word?", [{ id: "hope", label: "hope" }, { id: "hop", label: "hop" }, { id: "hip", label: "hip" }], "hope", "words"),
      speakItem("CVE-08", "Say hope.", "hope", "speaking", { word: "hope" }),
    ],
  },
  {
    id: "my-letter-names",
    title: "Letter names",
    track: "letters",
    skill: "SATPIN names — Myles only",
    stretch: "stretch-hard",
    dimensions: ["letterRecognition", "speaking"],
    items: [
      tap("N-s3", "Stamp s.", letterChoices(["s", "a", "t"]), "s", "letterRecognition", { widget: "stamp", letter: "s" }),
      tap("N-a1", "Find a.", letterChoices(["a", "s", "t"]), "a", "letterRecognition", { letter: "a" }),
      tap("N-t3", "Give me t.", letterChoices(["t", "p", "s"]), "t", "letterRecognition", { widget: "feed", letter: "t" }),
      tap("N-p1", "Stamp p.", letterChoices(["p", "t", "n"]), "p", "letterRecognition", { widget: "stamp" }),
      dragHold("D-s3", "Give me the letter that says /s/.", ["s", "p", "n"], "s", "letterRecognition"),
      speakItem("K-s1", "Say the name of s.", "s", "speaking", { letter: "s" }),
    ],
  },
  {
    id: "my-letter-sounds",
    title: "Letter sounds",
    track: "letters",
    skill: "Isolated phonemes — no words",
    stretch: "stretch-hard",
    dimensions: ["phonemes", "speaking"],
    items: [
      tap("P-s1", "Which one starts with /s/?", pics([["snake", "snake", "🐍"], ["tiger", "tiger", "🐯"], ["apple", "apple", "🍎"]]), "snake", "phonemes", { widget: "ear" }),
      tap("S-s1", "Which letter says /s/?", letterChoices(["s", "a", "t"]), "s", "phonemes", { widget: "ear" }),
      tap("S-a1", "Which letter says /ă/?", letterChoices(["a", "i", "s"]), "a", "phonemes", { widget: "ear" }),
      tap("S-t1", "Which letter says /t/?", letterChoices(["t", "i", "n"]), "t", "phonemes"),
      dragHold("D-s1", "Park the letter that says /s/.", ["s", "a", "t"], "s", "phonemes"),
      speakItem("K-s2", "Say the sound of s.", "/s/", "speaking", { letter: "s" }),
    ],
  },
  {
    id: "my-find-it",
    title: "Find it",
    track: "letters",
    skill: "Name → sound → find",
    stretch: "stretch-hard",
    dimensions: ["letterRecognition", "phonemes", "speaking"],
    items: [
      tap("N-mix1", "Stamp a.", letterChoices(["a", "i", "s"]), "a", "letterRecognition", { widget: "stamp" }),
      tap("N-mix2", "Find p.", letterChoices(["p", "t", "i"]), "p", "letterRecognition"),
      dragHold("D-a1", "Park the letter that says /ă/.", ["a", "i", "s"], "a", "phonemes"),
      tap("S-i1", "Which letter says /ĭ/?", letterChoices(["i", "a", "n"]), "i", "phonemes", { widget: "feed" }),
      speakItem("K-t1", "Say the name of t.", "t", "speaking", { letter: "t" }),
    ],
  },
];

export const SCOUT_RH1: LessonItem[] = [
  tap("RH1-1", "What word?", [{ id: "sit", label: "sit" }, { id: "sat", label: "sat" }, { id: "sip", label: "sip" }], "sit", "words"),
  dragWord("RH1-2", "pin", ["p", "i", "n", "a"], "i", "pin"),
  tap("RH1-3", "What word?", [{ id: "stop", label: "stop" }, { id: "sop", label: "sop" }, { id: "top", label: "top" }], "stop", "words"),
  tap("RH1-5", "What word?", [{ id: "made", label: "made" }, { id: "mad", label: "mad" }, { id: "mid", label: "mid" }], "made", "words"),
  speakItem("RH1-6", "Say this word.", "like", "speaking", { word: "like" }),
  tap("RH1-7", "Read the line.", [{ id: "I like a pig.", label: "I like a pig." }, { id: "I sit.", label: "I sit." }, { id: "A pin.", label: "A pin." }], "I like a pig.", "sentences"),
];

export const SCOUT_MY1: LessonItem[] = [
  tap("MY1-1", "Stamp s.", letterChoices(["s", "a", "t"]), "s", "letterRecognition", { widget: "stamp" }),
  tap("MY1-2", "Find p.", letterChoices(["p", "t", "n"]), "p", "letterRecognition"),
  tap("MY1-4", "Which letter says /m/?", letterChoices(["m", "n", "s"]), "m", "phonemes", { widget: "ear" }),
  tap("MY1-5", "Which letter says /ĭ/?", letterChoices(["i", "e", "a"]), "i", "phonemes", { widget: "feed" }),
  dragHold("MY1-6", "Park the letter that says /t/.", ["t", "d", "p"], "t", "letterRecognition"),
  tap("MY1-7", "sun. What sound does it start with? No printed word.", [{ id: "/s/", label: "/s/" }, { id: "/m/", label: "/m/" }, { id: "/t/", label: "/t/" }], "/s/", "phonemes", { widget: "ear" }),
];

export function pathForPlacement(grade?: string, track: "letters" | "words" = "words"): string[] {
  if (track === "letters") {
    if (grade === "A0") return ["my-letter-names"];
    if (grade === "A1") return ["my-letter-sounds", "my-find-it"];
    if (grade === "A2") return ["my-letter-names", "my-find-it"];
    return ["my-letter-names", "my-letter-sounds", "my-find-it"];
  }
  if (grade === "S") return ["rh-sound-speed"];
  if (grade === "L") return ["rh-letters", "rh-sound-speed"];
  if (grade === "C") return ["rh-letters", "rh-cvc-smash", "rh-vowel-contrast"];
  return ["rh-cvc-smash", "rh-vowel-contrast", "rh-digraphs", "rh-blends", "rh-heart", "rh-sentences"];
}

export const RH_STARTER_PATH = ["rh-sound-speed", "rh-cvc-smash", "rh-vowel-contrast", "rh-digraphs", "rh-blends", "rh-heart", "rh-sentences"];
export const MY_STARTER_PATH = ["my-letter-names", "my-letter-sounds", "my-find-it"];
