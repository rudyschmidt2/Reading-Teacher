import {
  BANK_MODULES,
  MY_STARTER_PATH,
  PLACEMENT_A_CVC,
  PLACEMENT_A_LETTERS,
  PLACEMENT_A_SOUNDS,
  PLACEMENT_B_NAMES,
  PLACEMENT_B_SOUNDS,
  RH_STARTER_PATH,
} from "./banks";
import type {
  Child,
  GradeDimension,
  LessonItem,
  ModuleDef,
  ThemeId,
  Tile,
  Vowel,
} from "./types";

export {
  BANK_MODULES,
  MY_STARTER_PATH,
  PLACEMENT_A_CVC,
  PLACEMENT_A_LETTERS,
  PLACEMENT_A_SOUNDS,
  PLACEMENT_B_NAMES,
  PLACEMENT_B_SOUNDS,
  RH_STARTER_PATH,
  SCOUT_MY1,
  SCOUT_RH1,
} from "./banks";
export { pathForPlacement } from "./banks";

export const THEMES: {
  id: ThemeId;
  label: string;
  emoji: string;
  host: string;
  hostEmoji: string;
  miss: string;
  win: string;
}[] = [
  {
    id: "large-animals",
    label: "Large animals",
    emoji: "🦁",
    host: "Pip the fox",
    hostEmoji: "🦊",
    miss: "Pip hiccups. Not that one.",
    win: "Pip gobbles it up!",
  },
  {
    id: "airplanes",
    label: "Airplanes",
    emoji: "✈️",
    host: "Zip the plane",
    hostEmoji: "✈️",
    miss: "Wobbly wings. Not that one.",
    win: "Zip flies through!",
  },
  {
    id: "planets-space",
    label: "Planets and space",
    emoji: "🪐",
    host: "Orbit",
    hostEmoji: "🪐",
    miss: "Soft bounce. Not that one.",
    win: "Orbit lands. Rings sparkle!",
  },
  {
    id: "bugs",
    label: "Bugs",
    emoji: "🪲",
    host: "Bop the beetle",
    hostEmoji: "🪲",
    miss: "Bop slides off. Not that one.",
    win: "Splat-jump! Stars pop!",
  },
  {
    id: "spaceships",
    label: "Spaceships",
    emoji: "🚀",
    host: "Captain Beam",
    hostEmoji: "🚀",
    miss: "Beam misses. Visor bonk. Not that one.",
    win: "Beamed up! Stars lock!",
  },
];

export function themeOf(id?: ThemeId) {
  return THEMES.find((t) => t.id === id) ?? THEMES[2];
}

export const VOWEL_FACE: Record<
  Vowel,
  { name: string; color: string; mark: string; sound: string }
> = {
  a: { name: "apple", color: "#e11d48", mark: "◡", sound: "/ă/" },
  e: { name: "egg", color: "#ca8a04", mark: "◔", sound: "/ĕ/" },
  i: { name: "igloo", color: "#4338ca", mark: "▲", sound: "/ĭ/" },
  o: { name: "octopus", color: "#ea580c", mark: "○", sound: "/ŏ/" },
  u: { name: "umbrella", color: "#7e22ce", mark: "∪", sound: "/ŭ/" },
};

export function ageFromBirthday(birthday: string, today = new Date()) {
  const b = new Date(`${birthday}T00:00:00`);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age -= 1;
  return Math.max(0, age);
}

export const STARTER_KIDS: Child[] = [
  {
    id: "riley",
    name: "Riley",
    birthday: "2019-03-14",
    status: "active",
    track: "words",
    stars: 0,
    path: RH_STARTER_PATH,
    stretch: "stretch-hard",
    sessionLength: "standard",
    readyForPrintWords: true,
    parentUnlockedWords: true,
  },
  {
    id: "hudson",
    name: "Hudson",
    birthday: "2020-07-22",
    status: "active",
    track: "words",
    stars: 0,
    path: RH_STARTER_PATH,
    stretch: "stretch-hard",
    sessionLength: "standard",
    readyForPrintWords: true,
    parentUnlockedWords: true,
  },
  {
    id: "myles",
    name: "Myles",
    birthday: "2023-04-09",
    status: "active",
    track: "letters",
    stars: 0,
    path: MY_STARTER_PATH,
    stretch: "stretch-hard",
    sessionLength: "standard",
    readyForPrintWords: false,
    parentUnlockedWords: false,
  },
  {
    id: "cassidy",
    name: "Cassidy",
    birthday: "2025-06-18",
    status: "waiting",
    track: "letters",
    stars: 0,
    path: [],
    stretch: "stretch-hard",
    sessionLength: "standard",
    readyForPrintWords: false,
    parentUnlockedWords: false,
  },
];

function letterTile(letter: string): Tile {
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  if (vowels.has(letter)) {
    return {
      id: `v-${letter}`,
      kind: "vowel",
      label: letter,
      vowel: letter as Vowel,
      phoneme: VOWEL_FACE[letter as Vowel].sound,
    };
  }
  return { id: `l-${letter}`, kind: "letter", label: letter, phoneme: `/${letter}/` };
}

function soundTile(letter: string, phoneme: string): Tile {
  return { id: `s-${letter}`, kind: "sound", label: phoneme, phoneme };
}

function cvcDrag(word: string): LessonItem {
  const letters = word.split("");
  const tiles = [
    ...letters.map(letterTile),
    letterTile(word[0] === "s" ? "m" : "s"),
    letterTile(word[1] === "a" ? "i" : "a"),
  ];
  return {
    id: `drag-${word}`,
    kind: "drag",
    widget: "drag",
    prompt: `Build ${word}. Hear /${letters[0]}/ /${letters[1]}/ /${letters[2]}/.`,
    parentHint: `Sound it out. Do not guess from a picture.`,
    dimension: "words",
    word,
    tiles,
    slots: letters.map((ch, i) => ({
      id: `slot-${word}-${i}`,
      accepts: ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u" ? ["vowel"] : ["letter"],
      correctTileId: letterTile(ch).id,
      glowVowel: i === 1 && (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u") ? (ch as Vowel) : undefined,
    })),
    speakTarget: word,
  };
}

function wordTap(word: string, others: string[], emoji: string): LessonItem {
  return {
    id: `tap-${word}`,
    kind: "tap",
    widget: "smash",
    prompt: `Find ${word}.`,
    dimension: "words",
    word,
    choices: [
      { id: word, label: word, emoji },
      ...others.map((o) => ({ id: o, label: o })),
    ],
    correctId: word,
    speakTarget: word,
  };
}

function speakWord(word: string): LessonItem {
  return {
    id: `say-${word}`,
    kind: "speak",
    widget: "say",
    prompt: `Say ${word}.`,
    dimension: "speaking",
    word,
    speakTarget: word,
  };
}

function letterName(letter: string, decoys: string[]): LessonItem {
  return {
    id: `name-${letter}`,
    kind: "tap",
    widget: "stamp",
    prompt: `Stamp ${letter}.`,
    dimension: "letterRecognition",
    letter,
    choices: [letter, ...decoys].map((l) => ({ id: l, label: l })),
    correctId: letter,
    speakTarget: letter,
  };
}

function letterSound(letter: string, phoneme: string, decoys: string[]): LessonItem {
  return {
    id: `sound-${letter}`,
    kind: "tap",
    widget: "ear",
    prompt: `Which letter says ${phoneme}?`,
    dimension: "phonemes",
    letter,
    choices: [letter, ...decoys].map((l) => ({ id: l, label: l })),
    correctId: letter,
    speakTarget: phoneme,
  };
}

function letterDrag(letter: string, decoys: string[]): LessonItem {
  const tiles = [letter, ...decoys].map(letterTile);
  return {
    id: `drag-letter-${letter}`,
    kind: "drag",
    widget: "feed",
    prompt: `Give me ${letter}.`,
    dimension: "letterRecognition",
    letter,
    tiles,
    slots: [
      {
        id: `hold-${letter}`,
        accepts: ["letter", "vowel"],
        correctTileId: letterTile(letter).id,
        glowVowel: letter === "a" || letter === "e" || letter === "i" || letter === "o" || letter === "u" ? (letter as Vowel) : undefined,
      },
    ],
    speakTarget: letter,
  };
}

function soundDrag(letter: string, phoneme: string): LessonItem {
  return {
    id: `drag-sound-${letter}`,
    kind: "drag",
    widget: "ear",
    prompt: `Which sound is ${phoneme}?`,
    dimension: "phonemes",
    letter,
    tiles: [soundTile(letter, phoneme), soundTile("x", "/m/"), soundTile("y", "/t/")],
    slots: [
      {
        id: `ear-${letter}`,
        accepts: ["sound"],
        correctTileId: `s-${letter}`,
      },
    ],
    speakTarget: phoneme,
  };
}

function speakLetter(letter: string, mode: "name" | "sound"): LessonItem {
  const phoneme = letter === "a" ? "/ă/" : `/${letter}/`;
  return {
    id: `say-${mode}-${letter}`,
    kind: "speak",
    widget: "say",
    prompt: mode === "name" ? `Say the name of ${letter}.` : `Say the sound ${phoneme}.`,
    dimension: "speaking",
    letter,
    speakTarget: mode === "name" ? letter : phoneme,
  };
}

export const STARTER_MODULES: ModuleDef[] = BANK_MODULES;

export const TRACK_A_SOUNDS = PLACEMENT_A_SOUNDS;
export const TRACK_A_LETTERS = PLACEMENT_A_LETTERS;
export const TRACK_A_CVC = PLACEMENT_A_CVC;
export const TRACK_B_NAMES = PLACEMENT_B_NAMES;
export const TRACK_B_SOUNDS = PLACEMENT_B_SOUNDS;

export const DIMENSION_LABEL: Record<GradeDimension, string> = {
  letterRecognition: "Letter recognition",
  vowelPhonics: "Vowel phonics",
  phonemes: "Phonemes",
  words: "Words",
  sentences: "Sentences",
  speed: "Speed",
  speaking: "Speaking",
};

export function wordsUnlocked(child: Child) {
  return child.track === "words" || (child.readyForPrintWords && child.parentUnlockedWords);
}

export function buildCustomModule(input: {
  title: string;
  track: "letters" | "words";
  skill: string;
  stretch?: ModuleDef["stretch"];
  seeds: string;
}): ModuleDef {
  const stretch = input.stretch ?? "stretch-hard";
  const tokens = input.seeds
    .split(/[,|\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const id = `custom-${Date.now()}`;
  const items: LessonItem[] = [];
  if (input.track === "letters") {
    for (const tok of tokens) {
      const letter = tok[0];
      items.push(letterName(letter, ["s", "t", "m"].filter((x) => x !== letter).slice(0, 2)));
      items.push(letterDrag(letter, ["s", "a"].filter((x) => x !== letter)));
      items.push(speakLetter(letter, "sound"));
    }
  } else {
    for (const tok of tokens) {
      if (tok.includes(" ")) {
        items.push({
          id: `custom-sent-${tok.replace(/\s+/g, "-")}`,
          kind: "tap",
          widget: "smash",
          prompt: `Find: ${tok}`,
          dimension: "sentences",
          choices: [
            { id: tok, label: tok },
            { id: "alt-1", label: "I sat." },
            { id: "alt-2", label: "The pin." },
          ],
          correctId: tok,
          speakTarget: tok,
        });
        items.push({
          id: `custom-say-${tok.replace(/\s+/g, "-")}`,
          kind: "speak",
          widget: "say",
          prompt: `Say: ${tok}`,
          dimension: "speaking",
          speakTarget: tok,
        });
      } else if (tok.length === 3) {
        items.push(wordTap(tok, ["sat", "pin"].filter((w) => w !== tok), "⭐"));
        items.push(cvcDrag(tok));
        items.push(speakWord(tok));
      } else {
        items.push(letterName(tok[0], ["s", "t"]));
      }
    }
  }
  return {
    id,
    title: input.title || "New module",
    track: input.track,
    skill: input.skill || "Custom",
    stretch,
    dimensions: input.track === "letters" ? ["letterRecognition", "phonemes", "speaking"] : ["words", "vowelPhonics", "speaking", "speed"],
    items: items.length ? items : [letterName("s", ["t", "m"])],
    custom: true,
  };
}
