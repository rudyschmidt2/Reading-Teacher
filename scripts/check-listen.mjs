import { isSpokenHit } from "../lib/phonemes.ts";
import { isRepeatAsk, looksLikeAttempt } from "../lib/repeat-ask.ts";

const yes = ["what", "What?", "huh", "repeat", "again", "say it again", "one more time", "what did you say"];
const no = ["sat", "sss", "pin", "the", "I sit", "s"];

const checks = [
  ...yes.map((t) => [`repeat: ${t}`, isRepeatAsk(t) === true]),
  ...no.map((t) => [`not repeat: ${t}`, isRepeatAsk(t) === false]),
  ["sat hits sat", isSpokenHit("sat", "sat")],
  ["I said sat hits sat", isSpokenHit("I said sat", "sat")],
  ["sit misses sat", isSpokenHit("sit", "sat") === false],
  ["/s/ hits ssss", isSpokenHit("ssss", "/s/")],
  ["/s/ hits sss", isSpokenHit("sss", "/s/")],
  ["/ă/ hits apple", isSpokenHit("apple", "/ă/")],
  ["/ă/ hits a", isSpokenHit("a", "/ă/")],
  ["ess hits letter s", isSpokenHit("ess", "s")],
  ["sat does not hit letter s", isSpokenHit("sat", "s") === false],
  ["um is not an attempt", looksLikeAttempt("um") === false],
  ["sat is an attempt", looksLikeAttempt("sat")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} listen checks failed`);
  process.exit(1);
}
console.log("\nAll listen checks passed.");
