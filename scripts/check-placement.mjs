import { scorePlacement, struggleStop } from "../lib/placement.ts";

function row(id, rung, ok) {
  return { id, rung, ok, dim: "words" };
}

const rileyClear = [
  ...["S1", "S2", "S3", "S4"].map((id) => row(id, "sounds", true)),
  ...["L1", "L2", "L3", "L4", "L5", "L6"].map((id) => row(id, "letters", true)),
  ...["C1", "C2", "C3", "C4"].map((id) => row(id, "cvc", true)),
];
const oneRow = [row("S1", "sounds", true)];
const mylesClear = [
  ...["M1", "M2", "M3", "M4"].map((id) => row(id, "names", true)),
  ...["M5", "M6", "M7", "M8"].map((id) => row(id, "letter-sounds", true)),
];
const twoMissSounds = [row("S1", "sounds", false), row("S1", "sounds", false)];

const checks = [
  ["Riley 14-hit is C+", scorePlacement(rileyClear, "words").grade === "C+"],
  ["Riley 14-hit kidLine is word", scorePlacement(rileyClear, "words").kidLine === "You read a real word!"],
  ["One-row history is S (the old bug)", scorePlacement(oneRow, "words").grade === "S"],
  ["Myles 8-hit is A3", scorePlacement(mylesClear, "letters").grade === "A3"],
  ["Myles one-row is A0 (the old bug)", scorePlacement(oneRow.map((r) => ({ ...r, rung: "names" })), "letters").grade === "A0"],
  ["Two misses in a row stop", struggleStop(twoMissSounds, "sounds") === true],
  ["Clean rung does not stop", struggleStop(rileyClear.filter((r) => r.rung === "sounds"), "sounds") === false],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} placement checks failed`);
  process.exit(1);
}
console.log("\nAll placement shelf checks passed.");
