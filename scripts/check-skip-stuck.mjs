import { nextSameSkill } from "../lib/skip-stuck.ts";

function item(id, dimension, kind) {
  return { id, kind, widget: "smash", prompt: id, dimension };
}

const tapWords = item("a", "words", "tap");
const tapWordsB = item("b", "words", "tap");
const dragWords = item("c", "words", "drag");
const tapLetters = item("d", "letterRecognition", "tap");
const tapWordsC = item("e", "words", "tap");

const bank = [tapWords, tapWordsB, dragWords, tapLetters, tapWordsC];

const checks = [
  [
    "same dimension+kind preferred",
    nextSameSkill(bank, tapWords, new Set([tapWords.id]))?.id === "b",
  ],
  [
    "skip used ids",
    nextSameSkill(bank, tapWords, new Set(["a", "b", "e"]))?.id === "c",
  ],
  [
    "undefined when only one item",
    nextSameSkill([tapWords], tapWords, new Set()) === undefined,
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} skip-stuck checks failed`);
  process.exit(1);
}
console.log("\nAll skip-stuck checks passed.");
