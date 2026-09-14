import { dealChoices, dealTiles, seededShuffle } from "../lib/deal.ts";
import { BANDS_LETTERS, BANDS_WORDS } from "../lib/diagnostic.ts";

const checks = [];
const check = (name, ok) => checks.push([name, ok]);

const four = [{ id: "s" }, { id: "a" }, { id: "t" }, { id: "m" }];

// Same seed, same deal; different seed, (almost always) a different deal.
check("deterministic", JSON.stringify(seededShuffle(four, "x")) === JSON.stringify(seededShuffle(four, "x")));
check("keeps every card", dealChoices(four, "s", "seed").dealt.map((c) => c.id).sort().join() === "a,m,s,t");

// Never the slot it sat in last time, for every seed and every avoid slot.
let clash = 0;
let firstSlot = 0;
for (let i = 0; i < 400; i++) {
  for (const avoid of [0, 1, 2, 3]) {
    const { dealt, correctSlot } = dealChoices(four, "s", `q-${i}`, avoid);
    if (correctSlot === avoid) clash++;
    if (dealt[correctSlot].id !== "s") clash++;
  }
  if (dealChoices(four, "s", `q-${i}`).correctSlot === 0) firstSlot++;
}
check("correct never lands in the avoided slot (1600 deals)", clash === 0);
check("correct is not always first (was 100%)", firstSlot > 40 && firstSlot < 160);

// Three cards too.
const three = four.slice(0, 3);
let clash3 = 0;
for (let i = 0; i < 300; i++) for (const avoid of [0, 1, 2]) if (dealChoices(three, "s", `t-${i}`, avoid).correctSlot === avoid) clash3++;
check("three-card boards avoid the last slot", clash3 === 0);

// Walk the whole diagnostic the way a kid would: consecutive probes never share a slot.
for (const bands of [BANDS_WORDS, BANDS_LETTERS]) {
  let last;
  let repeats = 0;
  let firsts = 0;
  let n = 0;
  for (const band of bands) {
    for (const probe of band.probes) {
      const { correctSlot } = dealChoices(probe.choices, probe.correctId, `riley-2026-09-14-${probe.id}-0`, last);
      if (correctSlot === last) repeats++;
      if (correctSlot === 0) firsts++;
      last = correctSlot;
      n++;
    }
  }
  check(`${bands === BANDS_WORDS ? "Track A" : "Track B"}: no back-to-back repeats over ${n} probes`, repeats === 0);
  check(`${bands === BANDS_WORDS ? "Track A" : "Track B"}: first slot is not the pattern`, firsts < n * 0.6);
}

// A retry re-deals the board.
const a = dealChoices(four, "s", "riley-DX-ln-1-0").dealt.map((c) => c.id).join();
const b = dealChoices(four, "s", "riley-DX-ln-1-1").dealt.map((c) => c.id).join();
check("retry board differs from first board", a !== b);

// Tiles: never left-to-right spelling.
const tiles = ["s", "a", "t", "p"].map((id) => ({ id }));
let identity = 0;
for (let i = 0; i < 200; i++) {
  const d = dealTiles(tiles, `CVC-${i}`);
  if (d.every((t, k) => t.id === tiles[k].id)) identity++;
}
check("tiles never in authored order", identity === 0);
check("single tile untouched", dealTiles([{ id: "s" }], "x").length === 1);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} deal checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} deal checks passed.`);
