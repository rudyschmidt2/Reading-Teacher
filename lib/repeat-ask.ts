const EXACT = new Set([
  "what",
  "huh",
  "repeat",
  "again",
  "pardon",
  "wait",
  "what what",
  "huh what",
  "say again",
  "say it again",
  "say that again",
  "one more",
  "one more time",
  "please repeat",
  "come again",
  "what did you say",
  "what was that",
  "i didn't hear",
  "i did not hear",
  "didn't hear",
  "did not hear",
]);

const PHRASES = [
  "say it again",
  "say that again",
  "say again",
  "one more time",
  "what did you say",
  "what was that",
  "please repeat",
  "didn't hear",
  "did not hear",
];

export function normalizeHeard(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[?!.,']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kid asked the teacher to say the prompt again. */
export function isRepeatAsk(raw: string) {
  const t = normalizeHeard(raw);
  if (!t) return false;
  if (EXACT.has(t)) return true;
  if (PHRASES.some((p) => t.includes(p))) return true;
  const words = t.split(" ");
  if (words.length <= 4 && words.every((w) => EXACT.has(w) || w === "please" || w === "it" || w === "that" || w === "you")) {
    return words.some((w) => w === "what" || w === "huh" || w === "repeat" || w === "again");
  }
  return false;
}
