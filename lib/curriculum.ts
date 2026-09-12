export type Letter = {
  id: string;
  grapheme: string;
  sound: string;
  speak: string;
  hint: string;
};

export type CvcWord = {
  id: string;
  word: string;
  letters: string[];
  speak: string;
};

export type MatchRound = {
  letterId: string;
  choices: string[];
};

export const LETTERS: Letter[] = [
  {
    id: "m",
    grapheme: "m",
    sound: "mmm",
    speak: "mmm",
    hint: "like the start of mat",
  },
  {
    id: "a",
    grapheme: "a",
    sound: "aaa",
    speak: "ah",
    hint: "the short a in apple",
  },
  {
    id: "t",
    grapheme: "t",
    sound: "t",
    speak: "tuh",
    hint: "like the start of top",
  },
  {
    id: "s",
    grapheme: "s",
    sound: "sss",
    speak: "sss",
    hint: "like the start of sun",
  },
  {
    id: "p",
    grapheme: "p",
    sound: "p",
    speak: "puh",
    hint: "like the start of pan",
  },
];

export const WORDS: CvcWord[] = [
  { id: "mat", word: "mat", letters: ["m", "a", "t"], speak: "mat" },
  { id: "sat", word: "sat", letters: ["s", "a", "t"], speak: "sat" },
  { id: "map", word: "map", letters: ["m", "a", "p"], speak: "map" },
];

export const MATCH_ROUNDS: MatchRound[] = [
  { letterId: "m", choices: ["m", "s", "p"] },
  { letterId: "a", choices: ["t", "a", "m"] },
  { letterId: "t", choices: ["s", "p", "t"] },
  { letterId: "s", choices: ["s", "m", "a"] },
  { letterId: "p", choices: ["t", "p", "s"] },
];

export function letterById(id: string): Letter {
  const letter = LETTERS.find((item) => item.id === id);
  if (!letter) {
    throw new Error(`Unknown letter: ${id}`);
  }
  return letter;
}
