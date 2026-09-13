export type SpeakKind = "prompt" | "phoneme" | "letter";

/** Isolated letter sounds. Continuants stretch; stops keep a light vowel so kids can hear them. */
const SOUNDS: Record<string, string> = {
  s: "ssss",
  m: "mmm",
  n: "nnn",
  f: "fff",
  l: "lll",
  r: "rrr",
  z: "zzz",
  v: "vvv",
  h: "hhh",
  w: "www",
  sh: "shhh",
  th: "thhh",
  ch: "ch",
  ng: "nng",
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
  ă: "aaa, apple",
  ĕ: "ehh, egg",
  ĭ: "ihh, igloo",
  ŏ: "ahh, octopus",
  ŭ: "uhh, umbrella",
  a: "aaa, apple",
  e: "ehh, egg",
  i: "ihh, igloo",
  o: "ahh, octopus",
  u: "uhh, umbrella",
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

/** Heard speech matches a speak-item target (word, letter, or /phoneme/). */
export function isSpokenHit(heard: string, target: string) {
  const words = heardNorm(heard).split(" ").filter(Boolean);
  const h = compact(heardNorm(heard));
  if (!h) return false;
  const inner = target.trim().replace(/^\/+|\/+$/g, "");
  const raw = compact(heardNorm(inner));
  const sound = compact(heardNorm(expandPhonemeToken(target)));
  const name = compact(heardNorm(letterName(inner)));
  const names = new Set([raw, sound, name].filter(Boolean));
  if (words.some((w) => names.has(compact(w)))) return true;
  if (raw.length === 1 && /^([a-zăĕĭŏŭ])\1+$/i.test(h) && h[0]?.toLowerCase() === raw) return true;
  if (raw.length >= 3 && words.some((w) => compact(w).includes(raw))) return true;
  if (sound.length >= 3 && (h === sound || words.some((w) => compact(w) === sound))) return true;
  return false;
}

export function parseSpeakKind(value: string | null | undefined): SpeakKind {
  if (value === "phoneme" || value === "letter") return value;
  return "prompt";
}
