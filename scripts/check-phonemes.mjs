import { expandPhonemeToken, letterName, prepareSpokenText } from "../lib/phonemes.ts";

const checks = [
  ["/s/ is sss", expandPhonemeToken("/s/") === "sss"],
  ["/m/ is mmm", expandPhonemeToken("/m/") === "mmm"],
  ["/t/ is tuh", expandPhonemeToken("/t/") === "tuh"],
  ["/ă/ is apple cue", expandPhonemeToken("/ă/") === "a as in apple"],
  ["prompt keeps words and expands /s/", prepareSpokenText("Stamp the one that says /s/.") === "Stamp the one that says sss."],
  ["prompt expands /ă/", prepareSpokenText("Which one says /ă/?") === "Which one says a as in apple?"],
  ["letter s is ess", letterName("s") === "ess"],
  ["kind phoneme", prepareSpokenText("/n/", "phoneme") === "nnn"],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} phoneme checks failed`);
  process.exit(1);
}
console.log("\nAll phoneme checks passed.");
