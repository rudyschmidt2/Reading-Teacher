export type SpeakKind = "prompt" | "phoneme" | "letter";

/**
 * Isolated letter sounds, written as English the TTS can say cleanly.
 * Long letter-runs ("ssss") and comma-split cues ("aaa, apple") make the
 * model slur or list the pieces. Continuants stay short; vowels use "as in".
 */
const SOUNDS: Record<string, string> = {
  s: "sss",
  m: "mmm",
  n: "nnn",
  f: "fff",
  l: "lll",
  r: "rrr",
  z: "zzz",
  v: "vvv",
  h: "huh",
  w: "wuh",
  sh: "shh",
  th: "th",
  ch: "ch",
  ng: "ng",
  t: "tuh",
  p: "puh",
  b: "buh",
  d: "duh",
  k: "kuh",
  g: "guh",
  c: "kuh",
  j: "juh",
  y: "yuh",
  x: "ks",
  q: "kwuh",
  ă: "a as in apple",
  ĕ: "e as in egg",
  ĭ: "i as in igloo",
  ŏ: "o as in octopus",
  ŭ: "u as in umbrella",
  a: "a as in apple",
  e: "e as in egg",
  i: "i as in igloo",
  o: "o as in octopus",
  u: "u as in umbrella",
};

const LETTER_NAMES: Record<string, string> = {
  a: "ay",
  b: "bee",
  c: "see",
  d: "dee",
  e: "ee",
  f: "eff",
  g: "jee",
  h: "aych",
  i: "eye",
  j: "jay",
  k: "kay",
  l: "ell",
  m: "em",
  n: "en",
  o: "oh",
  p: "pee",
  q: "cue",
  r: "ar",
  s: "ess",
  t: "tee",
  u: "you",
  v: "vee",
  w: "double you",
  x: "ex",
  y: "why",
  z: "zee",
};

const VOWEL_LETTER: Record<string, string> = {
  ă: "a",
  ĕ: "e",
  ĭ: "i",
  ŏ: "o",
  ŭ: "u",
};

const SKIP_CUE = new Set(["as", "in"]);
const SLASH_PHONEME = /\/([^/]{1,4})\//g;
const BREVE = /[ăĕĭŏŭ]/g;

export function expandPhonemeToken(raw: string): string {
  const trimmed = raw.trim();
  const inner = trimmed.replace(/^\/+|\/+$/g, "");
  return SOUNDS[inner] ?? SOUNDS[inner.toLowerCase()] ?? inner;
}

export function letterName(raw: string): string {
  const ch = raw.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  return LETTER_NAMES[ch] ?? ch;
}

export function expandPrompt(text: string): string {
  return text
    .replace(SLASH_PHONEME, (_, token: string) => expandPhonemeToken(token))
    .replace(BREVE, (ch) => SOUNDS[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

/** Parent-facing hint text (screen readers / desk). */
export function phonemeHint(text: string): string {
  return expandPrompt(text);
}

export function prepareSpokenText(text: string, kind: SpeakKind = "prompt"): string {
  const raw = text.trim();
  if (!raw) return "";
  if (kind === "letter") return letterName(raw);
  if (kind === "phoneme") return expandPhonemeToken(raw);
  return expandPrompt(raw);
}

function heardNorm(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[?!.,']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(s: string) {
  return s.replace(/[\s,/]/g, "");
}

function listenAliases(target: string): string[] {
  const inner = target.trim().replace(/^\/+|\/+$/g, "");
  const spoken = expandPhonemeToken(target);
  const aliases = new Set<string>();
  const add = (value: string) => {
    const c = compact(heardNorm(value));
    if (c) aliases.add(c);
  };
  add(inner);
  add(spoken);
  add(letterName(inner));
  const base = VOWEL_LETTER[inner] ?? VOWEL_LETTER[inner.toLowerCase()];
  if (base) add(base);
  for (const part of spoken.split(/[\s,]+/).filter(Boolean)) {
    if (!SKIP_CUE.has(part.toLowerCase())) add(part);
  }
  return [...aliases];
}

/** Heard speech matches a speak-item target (word, letter, or /phoneme/). */
export function isSpokenHit(heard: string, target: string) {
  const words = heardNorm(heard).split(" ").filter(Boolean);
  const h = compact(heardNorm(heard));
  if (!h) return false;
  const inner = target.trim().replace(/^\/+|\/+$/g, "");
  const raw = compact(heardNorm(inner));
  const sound = compact(heardNorm(expandPhonemeToken(target)));
  const name = compact(heardNorm(letterName(inner)));
  const names = new Set([raw, sound, name, ...listenAliases(target)].filter(Boolean));
  if (words.some((w) => names.has(compact(w)))) return true;
  const base = VOWEL_LETTER[raw] ?? raw;
  if (raw.length === 1 && /^([a-zăĕĭŏŭ])\1+$/i.test(h) && (h[0]?.toLowerCase() === raw || h[0]?.toLowerCase() === base)) {
    return true;
  }
  if (raw.length >= 3 && words.some((w) => compact(w).includes(raw))) return true;
  if (sound.length >= 3 && (h === sound || words.some((w) => compact(w) === sound))) return true;
  return false;
}

export function parseSpeakKind(value: string | null | undefined): SpeakKind {
  if (value === "phoneme" || value === "letter") return value;
  return "prompt";
}
