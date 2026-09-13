import { isRepeatAsk } from "../lib/repeat-ask.ts";

const yes = ["what", "What?", "huh", "repeat", "again", "say it again", "one more time", "what did you say"];
const no = ["sat", "sss", "pin", "the", "I sit", "s"];

const checks = [
  ...yes.map((t) => [`repeat: ${t}`, isRepeatAsk(t) === true]),
  ...no.map((t) => [`not repeat: ${t}`, isRepeatAsk(t) === false]),
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} listen checks failed`);
  process.exit(1);
}
console.log("\nAll listen checks passed.");
